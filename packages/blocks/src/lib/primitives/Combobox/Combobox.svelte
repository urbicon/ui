<script lang="ts" generics="T extends string | number | boolean = string">
  import { useBlocksI18n, mintAttachment } from '$lib';
  import CoreFieldMessage from '$lib/internal/core/CoreFieldMessage.svelte';
  import { tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { comboboxVariants, type ComboboxVariants } from './combobox.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import { useFormField, getTierContext, useFloatingPanel, floatingPanelHidden } from '$lib/utils';
  import type { ComboboxProps, ComboboxOption } from './index';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);
  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  const CheckMarkIcon = resolveIcon('check', CheckIconDefault);

  let {
    options = [],
    groups,
    value = $bindable(null),
    query = $bindable(''),
    multiple = false,
    maxItems,
    onRemoveTag,
    customTag,
    placeholder = 'Search…',
    label,
    helper,
    error,
    required = false,
    filter,
    queryFn,
    debounceMs = 250,
    loadingText = 'Loading…',
    onError,
    seedOptions = [],
    tier,
    variant = 'outlined',
    size = 'md',
    clearable = false,
    disabled = false,
    name,
    noResultsText = 'No results found',
    onValueChange,
    open = $bindable(false),
    onOpenChange,
    customOption,
    closeOnEscape = true,
    closeOnClickOutside = true,
    onEscape,
    onClickOutside,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id: idProp,
    'aria-describedby': ariaDescribedby,
    'aria-label': ariaLabel,
    ...restProps
  }: ComboboxProps<T> = $props();

  // The exported `ComboboxProps<T>` is a discriminated union over `multiple`, so
  // externally `<Combobox multiple bind:value={x: T[]}>` and the single form
  // narrow correctly. Internally we dispatch through a loose alias so the
  // component can hand either shape into `onValueChange` without per-branch
  // casts at every call site (mirrors Select).
  const dispatchValueChange = $derived(onValueChange as ((v: unknown) => void) | undefined);

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  // ARIA wiring is shared with every form primitive — see XC-2.
  const propsId = $props.id();
  const id = $derived(idProp ?? `combobox-${propsId}`);
  const ff = useFormField(() => ({
    fieldId: id,
    helper,
    error,
    required,
    disabled
  }));

  // Consumer-supplied `aria-describedby` (e.g. an external hint) merges with the
  // internal error/helper chain instead of being dropped — restProps land on the
  // wrapper div, so without this the description would never reach the focusable
  // input. Internal descriptions first, the consumer's supplemental one last
  // (mirrors Select + Input).
  const describedBy = $derived(
    [ff.describedBy, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let inputEl = $state<HTMLInputElement>();
  let wrapperEl = $state<HTMLElement>();
  let listboxEl = $state<HTMLElement>();
  let activeIndex = $state(-1);

  const defaultFilter = (opt: ComboboxOption<T>, q: string) =>
    opt.label.toLowerCase().includes(q.toLowerCase());

  const filterFn = $derived(filter ?? defaultFilter);

  // ── Async / server-side search (queryFn) ──────────────────────────────
  // Options resolved by the last settled `queryFn` call, and whether one is in
  // flight. In async mode these replace `options`/`groups` entirely.
  let asyncOptions = $state<ComboboxOption<T>[]>([]);
  let loading = $state(false);
  // Remembers the option the user picked so its label survives a later result
  // set that no longer contains it (the classic async-combobox label-loss).
  let selectedCache = $state<ComboboxOption<T> | null>(null);

  // `groups` takes precedence over `options` (mirrors Select); in async mode the
  // server-resolved list wins over both. Flattened for value lookup + keyboard nav.
  const allOptions = $derived(
    queryFn ? asyncOptions : groups ? groups.flatMap((g) => g.options) : options
  );

  // Single-mode selected option. `undefined` in multi mode, which makes every
  // single-only path keyed on it (the label-restore effect, the query shortcut
  // in `matchesQuery`, the click-outside/chevron label restore) inert without a
  // per-site `!multiple` guard. Lookup order: live options → the pick-cache →
  // the consumer's `seedOptions` (labels for values pre-bound before any
  // options exist, e.g. async mode on mount) — the seed is last so it can
  // never shadow a live option.
  const selectedOption = $derived(
    multiple
      ? undefined
      : (allOptions.find((o) => o.value === value) ??
          (selectedCache && selectedCache.value === value ? selectedCache : undefined) ??
          seedOptions.find((o) => o.value === value))
  );

  // ── Multi-select state (multiple) ─────────────────────────────────────────
  // Selected values, normalized to an array regardless of what `value` holds
  // (a stray `null`/non-array default binds to an empty selection).
  const selectedValues = $derived<T[]>(multiple && Array.isArray(value) ? value : []);

  // Remembers the option behind each picked value so its tag keeps its label
  // when the option list changes (async results, or a filtered-out option) —
  // the multi-select analogue of `selectedCache`.
  const tagCache = new SvelteMap<T, ComboboxOption<T>>();

  // Resolved options for the selected values, in selection order. Lookup order
  // mirrors `selectedOption`: live options → the pick-cache → `seedOptions`,
  // then a bare `{ label: String(value) }` for a true orphan (bound but in no
  // source) so the tag still renders and stays removable rather than silently
  // vanishing from the array.
  //
  // The dev-warn covers BOTH modes since `seedOptions` exists: a value that is
  // in neither the options, the cache, nor the seed is a consumer gap in async
  // mode too — the warn names the API that closes it. (Before the seed there
  // was no way to supply async labels, so warning there would have cried wolf.)
  //
  // Warn dedup: `selectedTags` recomputes on every fresh `options` array a
  // parent re-render passes in (the common `options={items.map(…)}` idiom), so
  // an unguarded warn would re-fire per recompute. A plain Set — deliberately
  // outside the reactive graph, so adding to it never invalidates the derived —
  // makes it one warn per orphan value for the instance's lifetime (mirrors
  // Select).
  const warnedOrphanValues = new Set<T>();
  const selectedTags = $derived.by<ComboboxOption<T>[]>(() =>
    selectedValues.map((v) => {
      const found =
        allOptions.find((o) => o.value === v) ??
        tagCache.get(v) ??
        seedOptions.find((o) => o.value === v);
      if (found) return found;
      if (import.meta.env?.DEV && !warnedOrphanValues.has(v)) {
        warnedOrphanValues.add(v);
        console.warn(
          `[Combobox] value ${JSON.stringify(v)} has no matching option — tag falls back to its raw value. ` +
            'For pre-selected values (e.g. async mode on mount), supply its label via `seedOptions`.'
        );
      }
      return { label: String(v), value: v } satisfies ComboboxOption<T>;
    })
  );

  const isSelected = (opt: ComboboxOption<T>): boolean =>
    multiple ? selectedValues.includes(opt.value) : opt.value === value;

  // At the max-items cap, options that aren't already selected can't be added.
  const atCap = $derived(multiple && maxItems != null && selectedValues.length >= maxItems);

  // An option is effectively disabled when it declares `disabled`, or when the
  // cap is reached and it isn't already selected (so it can't be added, but a
  // selected one can still be toggled off). Drives both keyboard-nav skipping
  // and the rendered `disabled`/`aria-disabled`.
  const isOptionDisabled = (opt: ComboboxOption<T> | undefined): boolean =>
    !!opt && (!!opt.disabled || (atCap && !isSelected(opt)));

  // Whether the clear affordance is shown (and what it resets). Single mode uses
  // `value != null` (not a truthy check) so a legitimately-selected falsy value
  // — `0`, `''`, `false` under `T extends string | number | boolean` — is still
  // clearable rather than stranding the field with no way to reset it.
  const hasValue = $derived(multiple ? selectedValues.length > 0 : value != null);

  // In multi mode the placeholder is suppressed once there are tags — sitting a
  // "Search…" hint next to chips reads as clutter. Single mode always shows it.
  const effectivePlaceholder = $derived(multiple && selectedValues.length > 0 ? '' : placeholder);

  // Does an option survive the current query? In async mode the server already
  // filtered, so everything shows. Otherwise the same rules the flat list always
  // used: an empty query and a field still showing the selected label both show
  // everything; else the (custom) filter decides.
  const matchesQuery = (opt: ComboboxOption<T>): boolean => {
    if (queryFn) return true;
    if (selectedOption && query === selectedOption.label) return true;
    if (!query.trim()) return true;
    return filterFn(opt, query.trim());
  };

  // Grouped view for rendering: each group's surviving options, empty groups
  // dropped. `null` for a flat `options` list or async mode (server results are flat).
  const filteredGroups = $derived.by(() => {
    if (!groups || queryFn) return null;
    return groups
      .map((g) => ({ label: g.label, options: g.options.filter(matchesQuery) }))
      .filter((g) => g.options.length > 0);
  });

  // Flat list backing keyboard nav + aria-activedescendant. Kept in lockstep
  // with `filteredGroups` (same predicate, same option refs) so the virtual
  // cursor index always addresses a rendered option.
  const filtered = $derived(
    filteredGroups ? filteredGroups.flatMap((g) => g.options) : allOptions.filter(matchesQuery)
  );

  // Flat index of each option within `filtered`, precomputed so the grouped
  // render path reads an option's keyboard-cursor index in O(1) instead of
  // `filtered.indexOf(opt)` per option (O(n²) per keystroke on a large grouped
  // list). Same first-occurrence semantics as `indexOf`.
  const filteredIndexByOption = $derived.by(() => {
    const map = new Map<ComboboxOption<T>, number>();
    filtered.forEach((opt, i) => {
      if (!map.has(opt)) map.set(opt, i);
    });
    return map;
  });

  // Debounced query runner. The effect tracks `query` (+ debounceMs); each change
  // resets the timer, and the fetch runs a tick later so bursty typing collapses
  // into one request. A per-run AbortController lets a newer query cancel an
  // older in-flight one, so a slow stale response can't overwrite a fresh result.
  let inFlight: AbortController | undefined;
  $effect(() => {
    // Gated on `open` so no request fires in the background before the user
    // engages the field; opening (focus) searches with the current query.
    if (!queryFn || !open) {
      loading = false;
      return;
    }
    const q = query;
    // Mark loading *synchronously*: a search is pending the moment the query
    // changes, not only once the debounced fetch starts. Otherwise the empty
    // `asyncOptions` would render the "no results" row for the whole debounce
    // window before "loading" appears — the opposite of the truth.
    loading = true;
    const timer = setTimeout(() => {
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      queryFn(q, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          asyncOptions = result;
          activeIndex = -1;
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError')
            return;
          // Failure contract: the loading state ends (`finally`) and the
          // previous — now stale — options stay in place (no result-set
          // clobber; a UI error slot remains an open debt). The rejection is
          // handed to `onError`; without one it is surfaced DEV-only instead
          // of vanishing silently (ConfirmDialog onConfirm precedent). A
          // throwing `onError` is a consumer bug and deliberately escapes
          // (fail-loud, mirrors createCronRunner).
          if (onError) {
            onError(err);
          } else if (import.meta.env?.DEV) {
            console.warn('[Combobox] queryFn rejected:', err);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) loading = false;
        });
    }, debounceMs);
    // Abort the in-flight request as well as clearing the timer, so a
    // superseded / closed / unmounted search doesn't run to completion in the
    // background — the whole point of threading the AbortSignal through.
    return () => {
      clearTimeout(timer);
      inFlight?.abort();
    };
  });

  // `error` is the same signal that drives `aria-invalid` (`ff.invalid`), so
  // the visible frame and the announced state can never disagree. It also
  // reaches `resolveSlotClasses`, so a consumer `overrides` entry can target
  // the invalid state.
  const variantProps: ComboboxVariants = $derived({
    variant,
    tier: effectiveTier,
    size,
    open,
    disabled,
    // `|| undefined` rather than a plain `false`, matching Input: these props
    // are also matched against `BlocksProvider` `overrides`, where an entry
    // keyed `{ error: false }` must not fire on a valid field.
    error: ff.invalid || undefined
  });
  const styles = $derived(comboboxVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Combobox', preset, variantProps, slotClassesProp)
  );

  // Focus-restoration policy follows the ARIA Combobox pattern:
  //   • selection → focus returns to the input (`select`, `clear`)
  //   • Escape    → focus already lives on the input (keydown came from
  //                  the input), so no explicit restore is needed
  //   • outside   → focus stays where the user clicked (no restore)
  // Focus never leaves the `<input>` while open — the active option is
  // surfaced via `aria-activedescendant`, not by moving DOM focus into
  // the listbox.
  //
  // The focus restore in `select`/`clear` must NOT re-open the listbox the way
  // a user-initiated focus does. `inputEl.focus()` dispatches `focus`
  // synchronously, so without this guard `handleFocus` would flip `open = true`
  // again on the very next line — negating the `open = false` above and leaving
  // the listbox open after every mouse-click selection/clear (Codeberg #19).
  // The flag is raised immediately before `focus()` and lowered immediately
  // after, so it masks only that one synchronous event; when `focus()` is a
  // no-op (input already focused, e.g. an Enter-key selection) it fires no
  // `focus` event and the flag is simply lowered again — never left dangling
  // for the next genuine focus.
  let suppressFocusOpen = false;

  function focusInputWithoutOpening() {
    suppressFocusOpen = true;
    inputEl?.focus();
    suppressFocusOpen = false;
  }

  // Single mutation point for internally-driven open changes, so
  // `onOpenChange` fires exactly once per transition (and never when the
  // consumer writes `bind:open` directly). The no-change guard also keeps
  // repeat opens quiet — e.g. typing while already open (`handleInput`) or
  // a focus event on an already-open field (`handleFocus`).
  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    onOpenChange?.(next);
  }

  function select(opt: ComboboxOption<T>) {
    if (opt.disabled) return;
    value = opt.value;
    query = opt.label;
    selectedCache = opt;
    setOpen(false);
    activeIndex = -1;
    // Dispatch through the loose alias — the union's `onValueChange` param type
    // is the contravariant intersection `(T | null) & T[]`, which nothing is
    // assignable to; the alias erases the mode split (mirrors Select).
    dispatchValueChange?.(opt.value);
    focusInputWithoutOpening();
  }

  function clear() {
    if (multiple) {
      // Clear all tags. `onRemoveTag` is reserved for single-value removals
      // (× / Backspace / toggle-off); a bulk clear signals through
      // `onValueChange([])` only. The listbox open state is left untouched.
      tagCache.clear();
      value = [] as T[];
      query = '';
      activeIndex = -1;
      dispatchValueChange?.([]);
      focusInputWithoutOpening();
      return;
    }
    value = null;
    query = '';
    setOpen(false);
    activeIndex = -1;
    dispatchValueChange?.(null);
    focusInputWithoutOpening();
  }

  // Add or remove a value in multi mode. Selecting keeps the listbox open (so
  // several picks flow without re-opening) and clears the query to search the
  // next one; toggling an already-selected option off removes its tag.
  function toggleValue(opt: ComboboxOption<T>) {
    if (opt.disabled) return;
    const values = [...selectedValues];
    const idx = values.indexOf(opt.value);
    if (idx === -1) {
      // Adding — respect the cap. (A selected option is never blocked here.)
      if (maxItems != null && values.length >= maxItems) return;
      values.push(opt.value);
      tagCache.set(opt.value, opt);
      value = values;
      dispatchValueChange?.(values);
    } else {
      values.splice(idx, 1);
      tagCache.delete(opt.value);
      value = values;
      onRemoveTag?.(opt.value);
      dispatchValueChange?.(values);
    }
    query = '';
    activeIndex = -1;
    focusInputWithoutOpening();
  }

  // Remove a single tag (× button or Backspace). Does not change the open state.
  function removeTag(v: T) {
    if (disabled) return;
    const values = selectedValues.filter((x) => x !== v);
    tagCache.delete(v);
    value = values;
    onRemoveTag?.(v);
    dispatchValueChange?.(values);
    focusInputWithoutOpening();
  }

  function handleInput() {
    setOpen(true);
    activeIndex = -1;
    // Single mode: editing the query away from the selected label clears the
    // selection. Multi mode leaves the array alone — the query is transient
    // search text, independent of the tags.
    if (!multiple && value && query !== selectedOption?.label) {
      value = null;
      dispatchValueChange?.(null);
    }
  }

  function handleFocus() {
    if (suppressFocusOpen) return;
    if (!disabled) setOpen(true);
  }

  // Chevron toggle. The input opens on focus but has no way to close itself
  // (re-clicking a focused field is a no-op — the "trigger doesn't close it"
  // report), so the chevron button is the explicit open/close affordance.
  // Focus stays on the input throughout (the chevron's onmousedown calls
  // preventDefault), so closing here doesn't blur-then-reopen via handleFocus.
  function toggleOpen() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      // Multi: drop the transient search text so a leftover filter doesn't
      // linger. Single: restore the selected label if the query was left
      // dangling (mirrors the click-outside path), so the field doesn't read
      // as blank after closing.
      if (multiple) query = '';
      else if (!value && selectedOption) query = selectedOption.label;
    } else {
      setOpen(true);
      inputEl?.focus();
    }
  }

  function scrollToActive() {
    tick().then(() => {
      if (!listboxEl) return;
      const el = listboxEl.querySelector('[data-active="true"]');
      if (el) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const next = activeIndex + 1;
        if (next < filtered.length) {
          activeIndex = next;
          // Skip disabled / at-cap options (see isOptionDisabled).
          while (activeIndex < filtered.length && isOptionDisabled(filtered[activeIndex]))
            activeIndex++;
          if (activeIndex >= filtered.length) activeIndex = filtered.length - 1;
        }
        scrollToActive();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const prev = activeIndex - 1;
        if (prev >= 0) {
          activeIndex = prev;
          while (activeIndex >= 0 && isOptionDisabled(filtered[activeIndex])) activeIndex--;
          if (activeIndex < 0) activeIndex = 0;
        }
        scrollToActive();
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (
          open &&
          activeIndex >= 0 &&
          filtered[activeIndex] &&
          !isOptionDisabled(filtered[activeIndex])
        ) {
          const opt = filtered[activeIndex];
          if (multiple) toggleValue(opt);
          else select(opt);
        }
        break;
      }
      case 'Backspace': {
        // Multi: Backspace on an empty query removes the last tag (standard
        // tokenizer UX). Only when the query is empty, so it never eats a real
        // character delete.
        if (multiple && query === '' && selectedValues.length > 0) {
          event.preventDefault();
          removeTag(selectedValues[selectedValues.length - 1]);
        }
        break;
      }
      case 'Escape': {
        if (!open) break;
        if (!closeOnEscape) break;
        event.preventDefault();
        setOpen(false);
        activeIndex = -1;
        onEscape?.();
        break;
      }
      case 'Home': {
        if (open) {
          event.preventDefault();
          activeIndex = 0;
          scrollToActive();
        }
        break;
      }
      case 'End': {
        if (open) {
          event.preventDefault();
          activeIndex = filtered.length - 1;
          scrollToActive();
        }
        break;
      }
    }
  }

  function handleClickOutside(event: PointerEvent) {
    const target = event.target as Node;
    // Exclude the whole input wrapper (input + chevron toggle + clear button),
    // so clicking the chevron to close doesn't race this handler into a
    // close-then-reopen. The listbox lives in the top layer (separate subtree).
    if (!wrapperEl?.contains(target) && !listboxEl?.contains(target)) {
      if (!closeOnClickOutside) return;
      setOpen(false);
      if (multiple) {
        query = '';
      } else if (!value && selectedOption) {
        query = selectedOption.label;
      }
      onClickOutside?.();
    }
  }

  $effect(() => {
    if (open) {
      // `pointerdown` (not `mousedown`) for reliable outside-dismiss on touch:
      // iOS fires `pointerdown` immediately on tap, whereas a synthetic
      // `mousedown` can be delayed or dropped when the tapped element is the
      // moving top-layer popover. Mirrors Popover's manual-mode dismiss.
      document.addEventListener('pointerdown', handleClickOutside);
      return () => document.removeEventListener('pointerdown', handleClickOutside);
    }
  });

  $effect(() => {
    if (selectedOption && !query) {
      query = selectedOption.label;
    }
  });

  const panel = useFloatingPanel({
    reference: () => inputEl,
    floating: () => listboxEl,
    open: () => open,
    // The listbox always tracks the input width exactly; the generic panel
    // helper defaults to no width-sync, so the listbox pattern opts in.
    syncWidth: () => true
  });

  const listboxId = $derived(`${id}-listbox`);
  const activeDescendant = $derived(
    activeIndex >= 0 && filtered[activeIndex]
      ? `${listboxId}-option-${filtered[activeIndex].value}`
      : undefined
  );
</script>

<div
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  {...restProps}
>
  {#if label}
    <label
      for={ff.fieldId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}
      {#if ff.required}<span
          class={unstyled
            ? (slotClasses?.requiredMark ?? '')
            : styles.requiredMark({ class: slotClasses?.requiredMark })}
          aria-hidden="true">*</span
        >{/if}
    </label>
  {/if}

  <div
    bind:this={wrapperEl}
    class={unstyled
      ? (slotClasses?.inputWrapper ?? '')
      : styles.inputWrapper({ class: slotClasses?.inputWrapper })}
  >
    {#if multiple}
      <!--
        Multi-select tokenizer frame. The visible border/background/focus-ring
        lives on this `control` div (not the borderless search input inside it),
        so selected tags and the search field share one bordered box that grows
        as tags wrap. Single mode keeps the input-as-frame layout untouched.
      -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class={unstyled
          ? (slotClasses?.control ?? '')
          : styles.control({ class: slotClasses?.control })}
        onmousedown={(e) => {
          // Clicking the empty frame area (not a tag or the input) focuses the
          // input; `preventDefault` keeps focus from leaving on the mousedown.
          if (e.target === e.currentTarget) {
            e.preventDefault();
            inputEl?.focus();
          }
        }}
      >
        <!--
          Keyed with a positional suffix (matching the hidden inputs below), not
          the bare value: a malformed bound array with a repeated value would
          otherwise throw `each_key_duplicate`. Internal mutations never create
          duplicates (toggleValue guards on indexOf), so for valid input this is
          a stable per-position key.
        -->
        {#each selectedTags as opt, i (`${String(opt.value)}-${i}`)}
          {#if customTag}
            {@render customTag(opt, () => removeTag(opt.value))}
          {:else}
            <span
              class={unstyled ? (slotClasses?.tag ?? '') : styles.tag({ class: slotClasses?.tag })}
            >
              <span
                class={unstyled
                  ? (slotClasses?.tagLabel ?? '')
                  : styles.tagLabel({ class: slotClasses?.tagLabel })}>{opt.label}</span
              >
              <button
                type="button"
                {disabled}
                class={unstyled
                  ? (slotClasses?.tagRemove ?? '')
                  : styles.tagRemove({ class: slotClasses?.tagRemove })}
                onclick={() => removeTag(opt.value)}
                aria-label={bt('accessibility.removeTag', { label: opt.label })}
              >
                <CloseIcon />
              </button>
            </span>
          {/if}
        {/each}
        {@render searchField(
          unstyled ? (slotClasses?.search ?? '') : styles.search({ class: slotClasses?.search })
        )}
      </div>
    {:else}
      {@render searchField(
        unstyled ? (slotClasses?.input ?? '') : styles.input({ class: slotClasses?.input })
      )}
    {/if}

    {#if clearable && hasValue}
      <button
        type="button"
        {disabled}
        class={unstyled ? (slotClasses?.clear ?? '') : styles.clear({ class: slotClasses?.clear })}
        onclick={clear}
        aria-label={bt('accessibility.clearSelection')}
      >
        <CloseIcon class="h-3.5 w-3.5" />
      </button>
    {:else}
      <button
        type="button"
        tabindex={-1}
        {disabled}
        aria-label={bt('accessibility.toggleOptions')}
        aria-controls={listboxId}
        aria-expanded={open}
        onmousedown={(e) => e.preventDefault()}
        onclick={toggleOpen}
        class={unstyled
          ? (slotClasses?.chevronButton ?? '')
          : styles.chevronButton({ class: slotClasses?.chevronButton })}
      >
        <ChevronDownIcon
          class={unstyled
            ? (slotClasses?.chevron ?? '')
            : styles.chevron({ class: slotClasses?.chevron })}
        />
      </button>
    {/if}

    {#if name}
      {#if multiple}
        <!-- One hidden input per selected value, so the form payload shape is
             consistent (zero-or-more) regardless of how many tags are picked. -->
        {#each selectedTags as opt, i (`${String(opt.value)}-${i}`)}
          <input type="hidden" {name} value={String(opt.value)} />
        {/each}
      {:else}
        <input
          type="hidden"
          {name}
          value={value === null || value === undefined ? '' : String(value)}
        />
      {/if}
    {/if}

    <!--
      Listbox stays mounted so `bind:this` and `aria-controls` are stable across
      open/close cycles. In top-layer mode the `popover="manual"` UA-rule
      `[popover]:not(:popover-open)` hides it until `showPopover()` runs; inside a
      modal dialog (`panel.topLayer === false`) the popover attribute is dropped
      and `display` drives visibility instead, so the listbox renders in the
      dialog's own top-layer subtree (Codeberg #23).

      The positioning frame is applied with per-property `style:` directives, NOT
      a single `style={…}` string: a dynamic `style={…}` compiles to
      `setAttribute('style')`, replacing the whole attribute and wiping the
      `left`/`top` Floating UI writes imperatively (the iOS `inset: auto` clobber
      behind Codeberg #23). `style:` directives and Floating UI's writes are both
      per-property and never overwrite one another.
    -->
    <div
      bind:this={listboxEl}
      id={listboxId}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      popover={panel.topLayer ? 'manual' : null}
      tabindex={-1}
      class={unstyled
        ? (slotClasses?.listbox ?? '')
        : styles.listbox({ class: slotClasses?.listbox })}
      style:position={panel.strategy}
      style:inset="auto"
      style:margin="0"
      style:overflow-y="auto"
      style:display={floatingPanelHidden(panel, open) ? 'none' : null}
    >
      {#if open}
        {#if loading}
          <div
            class={unstyled
              ? (slotClasses?.loading ?? '')
              : styles.loading({ class: slotClasses?.loading })}
            role="status"
          >
            {loadingText}
          </div>
        {:else if filtered.length === 0}
          <div
            class={unstyled
              ? (slotClasses?.noResults ?? '')
              : styles.noResults({ class: slotClasses?.noResults })}
          >
            {noResultsText}
          </div>
        {:else if filteredGroups}
          {#each filteredGroups as group, i (`${group.label}-${i}`)}
            <div
              class={unstyled
                ? (slotClasses?.group ?? '')
                : styles.group({ class: slotClasses?.group })}
              role="group"
              aria-label={group.label}
            >
              <div
                class={unstyled
                  ? (slotClasses?.groupLabel ?? '')
                  : styles.groupLabel({ class: slotClasses?.groupLabel })}
              >
                {group.label}
              </div>
              {#each group.options as opt (opt.value)}
                {@render optionButton(opt, filteredIndexByOption.get(opt) ?? -1)}
              {/each}
            </div>
          {/each}
        {:else}
          {#each filtered as opt, i (opt.value)}
            {@render optionButton(opt, i)}
          {/each}
        {/if}
      {/if}
    </div>
  </div>

  <!-- Combobox is the one field whose helper has a slot of its own: the two
       tones are slot constants here, not a `messageType` axis, so the helper
       arm keeps reading quiet while the field is invalid. -->
  <CoreFieldMessage
    {error}
    {helper}
    errorId={ff.errorId}
    helperId={ff.helperId}
    class={unstyled
      ? (slotClasses?.message ?? '')
      : styles.message({ class: slotClasses?.message })}
    helperClass={unstyled
      ? (slotClasses?.helper ?? '')
      : styles.helper({ class: slotClasses?.helper })}
  />
</div>

<!--
  Single option renderer, shared by the flat and grouped listbox paths. `i` is
  the option's index in the flattened `filtered` array — the same index the
  keyboard cursor (`activeIndex`) and `aria-activedescendant` address, so a
  grouped option highlights and selects identically to a flat one.
-->
{#snippet optionButton(opt: ComboboxOption<T>, i: number)}
  {@const isActive = i === activeIndex}
  {@const selected = isSelected(opt)}
  {@const optDisabled = isOptionDisabled(opt)}
  <button
    id="{listboxId}-option-{opt.value}"
    type="button"
    role="option"
    aria-selected={selected}
    aria-disabled={optDisabled || undefined}
    data-active={isActive}
    disabled={optDisabled}
    class={unstyled
      ? [
          slotClasses?.option,
          isActive ? slotClasses?.optionActive : undefined,
          selected ? slotClasses?.optionSelected : undefined
        ]
          .filter(Boolean)
          .join(' ')
      : styles.option({
          class: [
            slotClasses?.option,
            isActive ? styles.optionActive({ class: slotClasses?.optionActive }) : undefined,
            selected ? styles.optionSelected({ class: slotClasses?.optionSelected }) : undefined
          ].filter(Boolean)
        })}
    onclick={() => (multiple ? toggleValue(opt) : select(opt))}
    onmouseenter={() => {
      if (!optDisabled) activeIndex = i;
    }}
  >
    {#if customOption}
      {@render customOption(opt, selected)}
    {:else}
      <span class="flex-1 truncate">{opt.label}</span>
      <!--
        Always rendered (reserved space) and faded in via opacity — parity
        with Select's optionCheck mechanic, so selecting never shifts layout.
      -->
      <CheckMarkIcon
        class={unstyled
          ? (slotClasses?.optionCheck ?? '')
          : styles.optionCheck({
              class: [slotClasses?.optionCheck, selected ? 'opacity-100' : undefined]
            })}
      />
    {/if}
  </button>
{/snippet}

<!--
  The single search input, shared by both modes. Single mode styles it as the
  full bordered frame (`input` slot); multi mode renders it borderless (`search`
  slot) inside the tokenizer `control`. Factored into a snippet so the ARIA
  wiring lives in one place. `required` is single-mode only — in multi the input
  is transient search text (cleared after each pick), so a native `required` on
  it would wrongly block submit even with tags selected.

  A consumer `aria-label` is forwarded onto the input (destructured out of
  restProps so it never lands on the role-less wrapper `<div>` — axe
  aria-prohibited-attr), but ONLY when no visible `label` renders. Unlike Select —
  which names its trigger via `aria-labelledby` (HIGHER ARIA precedence than
  aria-label) — Combobox names the input via a native `<label for>` (LOWER
  precedence than aria-label), so an unconditional aria-label would override a
  visible label. Gating on `label` keeps the visible label authoritative.
-->
{#snippet searchField(cls: string)}
  <input
    bind:this={inputEl}
    {@attach mintAttachment(mint, { enabled: !disabled })}
    id={ff.fieldId}
    type="text"
    role="combobox"
    aria-expanded={open}
    aria-controls={listboxId}
    aria-activedescendant={activeDescendant}
    aria-autocomplete="list"
    aria-invalid={ff.invalid ? 'true' : undefined}
    aria-describedby={describedBy}
    aria-label={label ? undefined : ariaLabel}
    autocomplete="off"
    class={cls}
    placeholder={effectivePlaceholder}
    {disabled}
    required={(!multiple && ff.required) || undefined}
    bind:value={query}
    oninput={handleInput}
    onfocus={handleFocus}
    onkeydown={handleKeydown}
  />
{/snippet}
