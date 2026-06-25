<script lang="ts" generics="T extends string | number | boolean = string">
  import { useBlocksI18n, mintRegistry } from '$lib';
  import { tick } from 'svelte';
  import { comboboxVariants, type ComboboxVariants } from './combobox.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import { useFormField, getTierContext, useFloatingPanel, floatingPanelStyle } from '$lib/utils';
  import type { ComboboxProps, ComboboxOption } from './index';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);
  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  const CheckMarkIcon = resolveIcon('check', CheckIconDefault);

  let {
    options,
    value = $bindable(null),
    query = $bindable(''),
    placeholder = 'Search…',
    label,
    helper,
    error,
    required = false,
    filter,
    tier,
    size = 'md',
    clearable = false,
    disabled = false,
    name,
    noResultsText = 'No results found',
    onValueChange,
    open = $bindable(false),
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
    ...restProps
  }: ComboboxProps<T> = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  // ARIA wiring is shared with every form primitive — see XC-2.
  const propsId = $props.id();
  const id = $derived(idProp ?? `combobox-${propsId}`);
  const ff = useFormField(() => ({
    fieldId: id,
    hint: helper,
    error,
    required,
    disabled
  }));

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let inputEl = $state<HTMLInputElement>();
  let wrapperEl = $state<HTMLElement>();
  let listboxEl = $state<HTMLElement>();
  let activeIndex = $state(-1);

  $effect(() => {
    if (inputEl && mint && mint !== 'none' && !disabled) {
      return mintRegistry.apply(inputEl, mint);
    }
  });

  const defaultFilter = (opt: ComboboxOption<T>, q: string) =>
    opt.label.toLowerCase().includes(q.toLowerCase());

  const filterFn = $derived(filter ?? defaultFilter);

  const selectedOption = $derived(options.find((o) => o.value === value));

  const filtered = $derived.by(() => {
    if (selectedOption && query === selectedOption.label) return options;
    if (!query.trim()) return options;
    return options.filter((o) => filterFn(o, query.trim()));
  });

  const variantProps: ComboboxVariants = $derived({ tier: effectiveTier, size, open, disabled });
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
  function select(opt: ComboboxOption<T>) {
    if (opt.disabled) return;
    value = opt.value;
    query = opt.label;
    open = false;
    activeIndex = -1;
    onValueChange?.(opt.value);
    inputEl?.focus();
  }

  function clear() {
    value = null;
    query = '';
    open = false;
    activeIndex = -1;
    onValueChange?.(null);
    inputEl?.focus();
  }

  function handleInput() {
    if (!open) open = true;
    activeIndex = -1;
    if (value && query !== selectedOption?.label) {
      value = null;
      onValueChange?.(null);
    }
  }

  function handleFocus() {
    if (!disabled) open = true;
  }

  // Chevron toggle. The input opens on focus but has no way to close itself
  // (re-clicking a focused field is a no-op — the "trigger doesn't close it"
  // report), so the chevron button is the explicit open/close affordance.
  // Focus stays on the input throughout (the chevron's onmousedown calls
  // preventDefault), so closing here doesn't blur-then-reopen via handleFocus.
  function toggleOpen() {
    if (disabled) return;
    if (open) {
      open = false;
      // Restore the selected label if the query was left dangling (mirrors the
      // click-outside path), so the field doesn't read as blank after closing.
      if (!value && selectedOption) query = selectedOption.label;
    } else {
      open = true;
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
          open = true;
          return;
        }
        const next = activeIndex + 1;
        if (next < filtered.length) {
          activeIndex = next;
          while (activeIndex < filtered.length && filtered[activeIndex]?.disabled) activeIndex++;
          if (activeIndex >= filtered.length) activeIndex = filtered.length - 1;
        }
        scrollToActive();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          open = true;
          return;
        }
        const prev = activeIndex - 1;
        if (prev >= 0) {
          activeIndex = prev;
          while (activeIndex >= 0 && filtered[activeIndex]?.disabled) activeIndex--;
          if (activeIndex < 0) activeIndex = 0;
        }
        scrollToActive();
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (open && activeIndex >= 0 && filtered[activeIndex]) {
          select(filtered[activeIndex]);
        }
        break;
      }
      case 'Escape': {
        if (!open) break;
        if (!closeOnEscape) break;
        event.preventDefault();
        open = false;
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
      open = false;
      if (!value && selectedOption) {
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
    <input
      bind:this={inputEl}
      id={ff.fieldId}
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={activeDescendant}
      aria-autocomplete="list"
      aria-invalid={ff.invalid ? 'true' : undefined}
      aria-describedby={ff.describedBy}
      autocomplete="off"
      class={unstyled ? (slotClasses?.input ?? '') : styles.input({ class: slotClasses?.input })}
      {placeholder}
      {disabled}
      required={ff.required || undefined}
      bind:value={query}
      oninput={handleInput}
      onfocus={handleFocus}
      onkeydown={handleKeydown}
    />

    {#if clearable && value}
      <button
        type="button"
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
      <input
        type="hidden"
        {name}
        value={value === null || value === undefined ? '' : String(value)}
      />
    {/if}

    <!--
      Listbox stays mounted so `bind:this` and `aria-controls` are stable across
      open/close cycles. In top-layer mode the `popover="manual"` UA-rule
      `[popover]:not(:popover-open)` hides it until `showPopover()` runs; inside a
      modal dialog (`panel.topLayer === false`) the popover attribute is dropped
      and `floatingPanelStyle` drives visibility via `display` instead, so the
      listbox renders in the dialog's own top-layer subtree (Codeberg #23).
    -->
    <div
      bind:this={listboxEl}
      id={listboxId}
      role="listbox"
      popover={panel.topLayer ? 'manual' : null}
      tabindex={-1}
      class={unstyled
        ? (slotClasses?.listbox ?? '')
        : styles.listbox({ class: slotClasses?.listbox })}
      style={floatingPanelStyle(panel, open, 'overflow-y: auto; ')}
    >
      {#if open}
        {#if filtered.length === 0}
          <div
            class={unstyled
              ? (slotClasses?.noResults ?? '')
              : styles.noResults({ class: slotClasses?.noResults })}
          >
            {noResultsText}
          </div>
        {:else}
          {#each filtered as opt, i (opt.value)}
            {@const isActive = i === activeIndex}
            {@const isSelected = opt.value === value}
            <button
              id="{listboxId}-option-{opt.value}"
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-disabled={opt.disabled}
              data-active={isActive}
              disabled={opt.disabled}
              class={unstyled
                ? [
                    slotClasses?.option,
                    isActive ? slotClasses?.optionActive : undefined,
                    isSelected ? slotClasses?.optionSelected : undefined
                  ]
                    .filter(Boolean)
                    .join(' ')
                : styles.option({
                    class: [
                      slotClasses?.option,
                      isActive
                        ? styles.optionActive({ class: slotClasses?.optionActive })
                        : undefined,
                      isSelected
                        ? styles.optionSelected({ class: slotClasses?.optionSelected })
                        : undefined
                    ].filter(Boolean)
                  })}
              onclick={() => select(opt)}
              onmouseenter={() => {
                activeIndex = i;
              }}
            >
              {#if customOption}
                {@render customOption(opt, isSelected)}
              {:else}
                <span class="flex-1 truncate">{opt.label}</span>
                {#if isSelected}
                  <CheckMarkIcon class="text-primary h-4 w-4 shrink-0" />
                {/if}
              {/if}
            </button>
          {/each}
        {/if}
      {/if}
    </div>
  </div>

  {#if ff.errorId}
    <div
      id={ff.errorId}
      role="alert"
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {error}
    </div>
  {:else if ff.hintId}
    <div
      id={ff.hintId}
      class={unstyled ? (slotClasses?.hint ?? '') : styles.hint({ class: slotClasses?.hint })}
    >
      {helper}
    </div>
  {/if}
</div>
