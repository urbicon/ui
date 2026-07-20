<script lang="ts" generics="T extends string | number | boolean = string">
  import { useBlocksI18n, mintRegistry } from '$lib';
  import { useFormField, getTierContext, useFloatingPanel, floatingPanelHidden } from '$lib/utils';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import type { SelectProps, SelectOption } from './index';
  import { selectVariants, type SelectVariants } from './select.variants';

  const bt = useBlocksI18n();

  const ChevronIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    options = [],
    groups,
    value = $bindable(null),
    multiple = false,
    selectionIndicator,
    closeOnSelect,
    multiPlaceholder,
    placeholder = 'Select...',
    label,
    error,
    helper,
    clearable = false,
    nullOption,
    tier,
    variant = 'outlined',
    size = 'md',
    disabled = false,
    required = false,
    name,
    mint = 'none',
    onValueChange,
    open = $bindable(false),
    onOpenChange,
    usePortal = true,
    syncWidth = true,
    customTrigger,
    customTriggerContent,
    customItem,
    closeOnEscape = true,
    closeOnClickOutside = true,
    onEscape,
    onClickOutside,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id: idProp,
    'aria-describedby': ariaDescribedby,
    'aria-label': ariaLabel,
    ...restProps
  }: SelectProps<T> = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  // The exported `SelectProps<T>` is a discriminated union over `multiple`.
  // Externally this lets `<Select multiple bind:value={x: T[]}>` and
  // `<Select bind:value={x: T | null}>` narrow correctly. Internally we
  // dispatch through a loose alias so the component code can hand either
  // shape into `onValueChange` without per-branch casts at every call site.
  const dispatchValueChange = $derived(onValueChange as ((v: any) => void) | undefined);

  /** Resolved null option config — `null` when prop is unset or `groups` is in use. */
  const nullOptionConfig = $derived.by(() => {
    if (!nullOption || groups || multiple) return null;
    const label = typeof nullOption === 'string' ? nullOption : nullOption.label;
    const disabledOpt = typeof nullOption === 'string' ? false : (nullOption.disabled ?? false);
    return { label, disabled: disabledOpt };
  });

  /**
   * Pseudo-option representing the null choice. We cast `null` to `T` for
   * structural compatibility — the actual null is preserved at the boundary
   * (selectOption / selectedOption / value), so consumers always see `T | null`.
   */
  const nullOptionAsOption = $derived(
    nullOptionConfig
      ? ({
          label: nullOptionConfig.label,
          value: null as unknown as T,
          disabled: nullOptionConfig.disabled
        } satisfies SelectOption<T>)
      : null
  );

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // ARIA wiring is shared with every form primitive — see XC-2.
  // All IDs are `$derived` so they react if the consumer changes `idProp`
  // or `label` after mount (e.g. dynamic form labels).
  const propsId = $props.id();
  const uid = $derived(idProp || `select-${propsId}`);
  const triggerId = $derived(`${uid}-trigger`);
  const listboxId = $derived(`${uid}-listbox`);
  const labelId = $derived(label ? `${uid}-label` : undefined);
  const ff = useFormField(() => ({
    fieldId: uid,
    helper,
    error,
    required,
    disabled
  }));

  // Consumer-supplied `aria-describedby` (e.g. an external hint rendered
  // outside the component) merges with the internal error/helper chain —
  // restProps land on the wrapper div, so without this the description
  // would never reach the focusable trigger.
  const describedBy = $derived(
    [ff.describedBy, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  let activeIndex = $state(-1);
  // Tracks whether the most recent open was keyboard-driven, so the initial
  // active-option highlight only defaults to the first row for keyboard users.
  // Plain `let`: read in the open effect, intentionally not a reactive dep.
  let openedViaKeyboard = false;
  let triggerRef = $state<HTMLElement>();
  let listboxRef = $state<HTMLDivElement>();

  function focusTrigger() {
    if (customTrigger && triggerRef) {
      const child = triggerRef.querySelector<HTMLElement>('button, a, [role="button"]');
      (child ?? triggerRef).focus();
    } else {
      triggerRef?.focus();
    }
  }

  // Effective close-on-select default: single closes, multi keeps open so
  // users can tick multiple options without re-opening — matches established
  // multi-select listbox UX.
  const effectiveCloseOnSelect = $derived(closeOnSelect ?? !multiple);

  // Default selection indicator: checkmark for single, checkbox for multi.
  // Consumers using customItem typically want 'none' so their snippet owns
  // the indicator placement.
  const effectiveIndicator = $derived<'checkmark' | 'checkbox' | 'none'>(
    selectionIndicator ?? (multiple ? 'checkbox' : 'checkmark')
  );

  const allOptions = $derived.by((): SelectOption<T>[] => {
    if (groups) return groups.flatMap((g) => g.options);
    if (nullOptionAsOption) return [nullOptionAsOption, ...options];
    return options;
  });

  const enabledOptions = $derived(allOptions.filter((o) => !o.disabled));

  // Flat index of each enabled option, precomputed so a grouped or flat option
  // reads its keyboard-cursor index in O(1) rather than an O(n) `indexOf` per
  // render — which made a large grouped listbox O(n²) per keystroke. Disabled
  // options are absent from `enabledOptions`, so they resolve to -1 here, exactly
  // as the previous `enabledOptions.indexOf(option)` did.
  const enabledIndexByOption = $derived.by(() => {
    const map = new Map<SelectOption<T>, number>();
    enabledOptions.forEach((o, i) => {
      if (!map.has(o)) map.set(o, i);
    });
    return map;
  });

  /**
   * Currently selected option(s), normalized to an array regardless of mode.
   *
   * Stale-value detection: when a bound `value` references an id that has no
   * matching option (typically because options loaded later than the value,
   * or an option was removed mid-session), we surface a `console.warn` in
   * dev so the consumer notices the orphan. The orphan is also filtered out
   * of the hidden form input, so the submitted form stays consistent with
   * what the trigger shows.
   *
   * Warn dedup: `selectedOptions` recomputes on every fresh `options` array a
   * parent re-render passes in (the common `options={items.map(…)}` idiom), so
   * an unguarded warn would re-fire per recompute. A plain Set — deliberately
   * outside the reactive graph, so adding to it never invalidates the derived —
   * makes it one warn per orphan value for the instance's lifetime (mirrors
   * Combobox).
   */
  const warnedOrphanValues = new Set<unknown>();
  const selectedOptions = $derived.by((): SelectOption<T>[] => {
    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      return values
        .map((v) => {
          const found = allOptions.find((o) => o.value === v);
          if (!found && import.meta.env?.DEV && !warnedOrphanValues.has(v)) {
            warnedOrphanValues.add(v);
            console.warn(
              `[Select] value ${JSON.stringify(v)} has no matching option — dropped from selection.`
            );
          }
          return found;
        })
        .filter((o): o is SelectOption<T> => o !== undefined);
    }
    if (value === null || value === undefined) return [];
    const found = allOptions.find((o) => o.value === value);
    if (!found && import.meta.env?.DEV && !warnedOrphanValues.has(value)) {
      warnedOrphanValues.add(value);
      console.warn(
        `[Select] value ${JSON.stringify(value)} has no matching option — trigger will fall back to placeholder.`
      );
    }
    return found ? [found] : [];
  });

  /** Backward-compatible single-mode accessor. */
  const selectedOption = $derived(multiple ? null : (selectedOptions[0] ?? null));

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the select's active variants.
  const variantProps: SelectVariants = $derived({
    tier: effectiveTier,
    variant,
    size,
    open: open || undefined,
    disabled: disabled || undefined,
    error: !!error || undefined,
    required: required || undefined,
    messageType: error ? 'error' : 'helper'
  });

  const styles = $derived(selectVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Select', preset, variantProps, slotClassesProp)
  );

  $effect(() => {
    if (triggerRef && mint && mint !== 'none' && !disabled) {
      return mintRegistry.apply(triggerRef, mint);
    }
  });

  // Initial active-option highlight when the listbox opens. Where the virtual
  // cursor starts:
  //   • the selected option, if any — shows the user where they are
  //   • else the first option ONLY on keyboard-open — gives arrows a starting
  //     point and matches the keyboard expectation of a focused first row
  //   • else nothing (-1) on pointer-open — avoids the "first element always
  //     marked" phantom highlight; the first ArrowDown then moves to row 0.
  // The `activeIndex >= 0` guard preserves an in-progress cursor so multi-
  // select (listbox stays open across picks) doesn't reset on every toggle.
  $effect(() => {
    if (!open || !listboxRef) return;
    if (activeIndex >= 0) return;
    let next = -1;
    const selectedIdx = multiple ? -1 : enabledOptions.findIndex((o) => o.value === value);
    if (selectedIdx >= 0) next = selectedIdx;
    else if (openedViaKeyboard) next = 0;
    activeIndex = next;
  });

  const panel = useFloatingPanel({
    reference: () => triggerRef,
    floating: () => listboxRef,
    open: () => open,
    portal: () => usePortal,
    syncWidth: () => syncWidth
  });

  // Single mutation point for internally-driven open changes, so
  // `onOpenChange` fires exactly once per transition (and never when the
  // consumer writes `bind:open` directly).
  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    onOpenChange?.(next);
  }

  function toggle() {
    if (disabled) return;
    // Pointer-driven open (trigger onclick). Mark modality so the open effect
    // doesn't pre-highlight the first row for a mouse/touch user.
    if (!open) openedViaKeyboard = false;
    setOpen(!open);
    if (!open) activeIndex = -1;
  }

  function isOptionSelected(option: SelectOption<T>): boolean {
    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      return values.includes(option.value);
    }
    return option.value === value;
  }

  function selectOption(option: SelectOption<T>) {
    if (option.disabled) return;
    if (multiple) {
      const values = Array.isArray(value) ? [...value] : [];
      const idx = values.indexOf(option.value);
      if (idx === -1) {
        values.push(option.value);
      } else {
        values.splice(idx, 1);
      }
      value = values as T[];
      dispatchValueChange?.(values);
    } else {
      // Null option carries `null as T`; preserve real `null` at the boundary.
      const nextValue = option.value === (null as unknown as T) ? null : option.value;
      value = nextValue;
      dispatchValueChange?.(nextValue);
    }
    if (effectiveCloseOnSelect) {
      setOpen(false);
      activeIndex = -1;
      focusTrigger();
    }
  }

  function clear(event?: MouseEvent) {
    event?.stopPropagation();
    if (multiple) {
      value = [] as T[];
      dispatchValueChange?.([]);
    } else {
      value = null;
      dispatchValueChange?.(null);
    }
    focusTrigger();
  }

  // Focus-restoration policy follows the ARIA Listbox/Button pattern:
  //   • selection → focus returns to the trigger button (`selectOption`)
  //   • Escape    → focus returns to the trigger button (handleTriggerKeydown)
  //   • Tab       → focus moves naturally to the next tab stop (no restore)
  //   • outside   → focus stays where the user clicked (no restore — user
  //                  explicitly intent to focus elsewhere)
  function dismissByEscape() {
    if (!closeOnEscape) return false;
    setOpen(false);
    activeIndex = -1;
    onEscape?.();
    return true;
  }

  // Single keyboard model, attached to the trigger (the focused element). The
  // ARIA listbox pattern keeps DOM focus on the trigger and moves a virtual
  // cursor via `aria-activedescendant`, so the listbox element never receives
  // key events — every key is handled here, branching on `open`.
  //
  // (Previously a second handler lived on the listbox `div`; since focus never
  // entered it, arrows were preventDefault'd but never advanced the cursor —
  // the "keyboard does nothing / fights the page" report. Consolidated here.)
  function handleTriggerKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          openedViaKeyboard = true;
          setOpen(true);
        } else {
          activeIndex = activeIndex < enabledOptions.length - 1 ? activeIndex + 1 : 0;
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) {
          openedViaKeyboard = true;
          setOpen(true);
        } else {
          activeIndex = activeIndex > 0 ? activeIndex - 1 : enabledOptions.length - 1;
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!open) {
          openedViaKeyboard = true;
          setOpen(true);
        } else if (activeIndex >= 0 && activeIndex < enabledOptions.length) {
          selectOption(enabledOptions[activeIndex]);
        }
        break;
      case 'Escape':
        if (open && dismissByEscape()) {
          event.preventDefault();
          focusTrigger();
        }
        break;
      case 'Tab':
        // Tab leaves the widget — close (focus moves on via the default tab),
        // independent of closeOnEscape/closeOnClickOutside.
        if (open) {
          setOpen(false);
          activeIndex = -1;
        }
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          activeIndex = 0;
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          activeIndex = enabledOptions.length - 1;
        }
        break;
    }
  }

  function handleClickOutside(event: PointerEvent) {
    const target = event.target as Node;
    if (
      open &&
      triggerRef &&
      listboxRef &&
      !triggerRef.contains(target) &&
      !listboxRef.contains(target)
    ) {
      if (!closeOnClickOutside) return;
      setOpen(false);
      activeIndex = -1;
      onClickOutside?.();
    }
  }

  function getOptionId(index: number) {
    return `${uid}-option-${index}`;
  }

  /** Trigger label text for single + multi modes. */
  const triggerText = $derived.by(() => {
    if (multiple) {
      if (selectedOptions.length === 0) return null;
      if (typeof multiPlaceholder === 'function') return multiPlaceholder(selectedOptions);
      if (typeof multiPlaceholder === 'string') return multiPlaceholder;
      return selectedOptions.map((o) => o.label).join(', ');
    }
    return selectedOption?.label ?? null;
  });

  const hasSelection = $derived(multiple ? selectedOptions.length > 0 : selectedOption !== null);
</script>

<svelte:window onpointerdown={handleClickOutside} />

<div
  class={unstyled
    ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
>
  {#if label}
    <label
      id={labelId}
      for={triggerId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}
    </label>
  {/if}

  <div
    class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}
    {...restProps}
  >
    {#if customTrigger}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span bind:this={triggerRef} class="inline-flex" onkeydown={handleTriggerKeydown}>
        {@render customTrigger(selectedOptions, open, clear)}
      </span>
    {:else}
      <button
        bind:this={triggerRef}
        id={triggerId}
        type="button"
        class={unstyled
          ? (slotClasses?.trigger ?? '')
          : styles.trigger({ class: slotClasses?.trigger })}
        {disabled}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={ff.invalid ? 'true' : undefined}
        aria-activedescendant={activeIndex >= 0 ? getOptionId(activeIndex) : undefined}
        onclick={toggle}
        onkeydown={handleTriggerKeydown}
      >
        {#if customTriggerContent}
          <span
            class={unstyled
              ? (slotClasses?.triggerText ?? '')
              : styles.triggerText({ class: slotClasses?.triggerText })}
          >
            {@render customTriggerContent(selectedOptions)}
          </span>
        {:else if triggerText !== null}
          <span
            class={unstyled
              ? (slotClasses?.triggerText ?? '')
              : styles.triggerText({ class: slotClasses?.triggerText })}
          >
            {triggerText}
          </span>
        {:else}
          <span
            class={unstyled
              ? (slotClasses?.placeholder ?? '')
              : styles.placeholder({ class: slotClasses?.placeholder })}
          >
            {placeholder}
          </span>
        {/if}

        {#if !(clearable && hasSelection)}
          <ChevronIcon
            class={unstyled
              ? (slotClasses?.chevron ?? '')
              : styles.chevron({ class: slotClasses?.chevron })}
          />
        {/if}
      </button>

      {#if clearable && hasSelection}
        <button
          type="button"
          class={unstyled
            ? (slotClasses?.clear ?? '')
            : styles.clear({ class: slotClasses?.clear })}
          onclick={clear}
          aria-label={bt('accessibility.clearSelection')}
          tabindex={disabled ? -1 : 0}
          {disabled}
        >
          <CloseIcon />
        </button>
      {/if}
    {/if}

    <!--
      Listbox stays mounted so `bind:this` and `aria-controls` are stable across
      open/close cycles. Top-layer mode uses `popover="manual"` + the UA
      `[popover]:not(:popover-open)` display rule until `showPopover()` runs; the
      in-place modes (nested in a modal dialog → Codeberg #23, or the explicit
      `usePortal=false`) drop the popover attribute and drive visibility via
      `display`. The positioning frame uses per-property `style:` directives, not
      a `style={…}` string, so Svelte's `setAttribute('style')` can never wipe the
      `left`/`top` Floating UI writes imperatively (iOS `inset: auto` clobber,
      Codeberg #23).

      `tabindex={-1}` keeps the listbox programmatically focusable without
      adding it to the tab order — the ARIA Listbox / `aria-activedescendant`
      pattern keeps DOM focus on the trigger button while the visually
      highlighted option moves with arrow keys.

      `aria-multiselectable` is set in multi-mode so screenreaders announce
      "listbox, multiselectable" — distinguishes it from single-select.
    -->
    <div
      bind:this={listboxRef}
      id={listboxId}
      role="listbox"
      popover={panel.topLayer ? 'manual' : null}
      aria-multiselectable={multiple || undefined}
      tabindex={-1}
      class={unstyled
        ? (slotClasses?.listbox ?? '')
        : styles.listbox({ class: slotClasses?.listbox })}
      style:position={panel.strategy}
      style:inset="auto"
      style:margin="0"
      style:overflow-y="auto"
      style:display={floatingPanelHidden(panel, open) ? 'none' : null}
      aria-labelledby={labelId}
    >
      {#if open}
        {#if groups}
          {#each groups as group, i (`${group.label}-${i}`)}
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
              {#each group.options as option (option.value)}
                {@const optIdx = enabledIndexByOption.get(option) ?? -1}
                {@const isActive = optIdx >= 0 && optIdx === activeIndex}
                {@const isSel = isOptionSelected(option)}
                <!--
                  ARIA Listbox pattern: options are explicitly NOT in the
                  tab order. Activation happens through the trigger
                  button's keydown handler via `aria-activedescendant`,
                  not by moving DOM focus into the option. The two svelte
                  a11y rules are intentionally silenced here.
                -->
                <!-- svelte-ignore a11y_interactive_supports_focus -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  id={getOptionId(optIdx)}
                  role="option"
                  aria-selected={isSel}
                  aria-disabled={option.disabled || undefined}
                  class={unstyled
                    ? (slotClasses?.option ?? '')
                    : selectVariants({
                        size,
                        selected: isSel || undefined
                      }).option({
                        class: [
                          slotClasses?.option,
                          isActive ? 'bg-surface-hover' : '',
                          option.disabled ? 'cursor-not-allowed opacity-50' : ''
                        ]
                      })}
                  onclick={() => selectOption(option)}
                  onmouseenter={() => {
                    if (!option.disabled) activeIndex = optIdx;
                  }}
                >
                  {#if customItem}
                    {@render customItem(option, isSel, () => selectOption(option))}
                  {:else}
                    {#if effectiveIndicator === 'checkbox'}
                      <span
                        class={unstyled
                          ? (slotClasses?.optionCheckbox ?? '')
                          : selectVariants({ size, selected: isSel || undefined }).optionCheckbox({
                              class: slotClasses?.optionCheckbox
                            })}
                        aria-hidden="true"
                      >
                        <CheckIcon />
                      </span>
                    {/if}
                    <span
                      class={unstyled
                        ? (slotClasses?.optionLabel ?? '')
                        : styles.optionLabel({ class: slotClasses?.optionLabel })}
                      >{option.label}</span
                    >
                    {#if effectiveIndicator === 'checkmark'}
                      <CheckIcon
                        class={unstyled
                          ? (slotClasses?.optionCheck ?? '')
                          : selectVariants({ size, selected: isSel || undefined }).optionCheck({
                              class: slotClasses?.optionCheck
                            })}
                      />
                    {/if}
                  {/if}
                </div>
              {/each}
            </div>
          {/each}
        {:else}
          {#each allOptions as option (option.value)}
            {@const optIdx = enabledIndexByOption.get(option) ?? -1}
            {@const isActive = optIdx >= 0 && optIdx === activeIndex}
            {@const isSel = isOptionSelected(option)}
            <!-- Options stay out of the tab order — see ARIA Listbox note above. -->
            <!-- svelte-ignore a11y_interactive_supports_focus -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              id={getOptionId(optIdx)}
              role="option"
              aria-selected={isSel}
              aria-disabled={option.disabled || undefined}
              class={unstyled
                ? (slotClasses?.option ?? '')
                : selectVariants({
                    size,
                    selected: isSel || undefined
                  }).option({
                    class: [
                      slotClasses?.option,
                      isActive ? 'bg-surface-hover' : '',
                      option.disabled ? 'cursor-not-allowed opacity-50' : ''
                    ]
                  })}
              onclick={() => selectOption(option)}
              onmouseenter={() => {
                if (!option.disabled) activeIndex = optIdx;
              }}
            >
              {#if customItem}
                {@render customItem(option, isSel, () => selectOption(option))}
              {:else}
                {#if effectiveIndicator === 'checkbox'}
                  <span
                    class={unstyled
                      ? (slotClasses?.optionCheckbox ?? '')
                      : selectVariants({ size, selected: isSel || undefined }).optionCheckbox({
                          class: slotClasses?.optionCheckbox
                        })}
                    aria-hidden="true"
                  >
                    <CheckIcon />
                  </span>
                {/if}
                <span
                  class={unstyled
                    ? (slotClasses?.optionLabel ?? '')
                    : styles.optionLabel({ class: slotClasses?.optionLabel })}>{option.label}</span
                >
                {#if effectiveIndicator === 'checkmark'}
                  <CheckIcon
                    class={unstyled
                      ? (slotClasses?.optionCheck ?? '')
                      : selectVariants({ size, selected: isSel || undefined }).optionCheck({
                          class: slotClasses?.optionCheck
                        })}
                  />
                {/if}
              {/if}
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  </div>

  {#if name}
    {#if multiple}
      <!--
        Multi-mode always emits zero-or-more inputs (one per *resolved*
        value), never a single fallback input — that way the form payload
        shape is consistent regardless of whether the user has touched the
        field. Orphan values (no matching option) are filtered out via
        `selectedOptions`, keeping the submitted form aligned with what
        the trigger displays.
      -->
      {#each selectedOptions as opt, i (`${String(opt.value)}-${i}`)}
        <input type="hidden" {name} value={String(opt.value)} />
      {/each}
    {:else}
      <input
        type="hidden"
        {name}
        value={selectedOptions[0] ? String(selectedOptions[0].value) : ''}
      />
    {/if}
  {/if}

  {#if ff.errorId}
    <div
      id={ff.errorId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
      role="alert"
    >
      {error}
    </div>
  {:else if ff.helperId}
    <div
      id={ff.helperId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {helper}
    </div>
  {/if}
</div>
