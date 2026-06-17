<script lang="ts">
  // ⚠ Mirror non-trivial changes to DateRangePicker.svelte (or vice
  // versa) — these two pickers share ~90% of state-machine logic.
  import { Input } from '$lib/primitives/Input';
  import { Popover } from '$lib/primitives/Popover';
  import { Calendar } from '$lib/components/Calendar';
  import { resolveIcon } from '$lib/icons';
  import CalendarIconDefault from '$lib/icons/CalendarIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { useBlocksI18n } from '$lib';
  import { formatDate, parseDate, isDateAllowed } from './datepicker.engine';
  import { coerceToDate, toDateInputValue } from '$lib/utils/date';
  import type { DatePickerProps } from '.';

  const bt = useBlocksI18n();

  const CalendarIcon = resolveIcon('calendar', CalendarIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    value = $bindable(undefined),
    label,
    placeholder,
    displayFormat,
    error,
    helper,
    required = false,
    clearable = true,
    closeOnSelect = true,
    closeOnEscape = true,
    closeOnClickOutside = true,
    onEscape,
    onClickOutside,
    locale = 'de-DE',
    weekStartsOn = 1,
    showWeekNumbers = false,
    showOutsideDays = true,
    fixedWeeks = false,
    minDate,
    maxDate,
    disabledDates = [],
    isDateDisabled,
    calendarVariant = 'default',
    inputVariant = 'outlined',
    size = 'md',
    onValueChange,
    onOpenChange,
    disabled = false,
    mint,
    defaultMonth,
    defaultYear,
    name,
    valueFormat = 'date',
    class: className = '',
    ...restProps
  }: DatePickerProps = $props();

  const propsId = $props.id();
  const popoverId = `datepicker-${propsId}-popover`;

  let open = $state(false);
  let triggerEl: HTMLDivElement | undefined = $state();
  let userDraft = $state<string | null>(null);
  let focused = $state(false);
  let parseError = $state<string | undefined>();

  const dateValue = $derived(coerceToDate(value));
  const formattedValue = $derived(dateValue ? formatDate(dateValue, locale, displayFormat) : '');

  // Single source of truth for what the input renders. The user-typed
  // draft sticks around while the input is focused *or* a parse error
  // is showing — both are signals that the user wants to see what they
  // last typed, not the canonical formatted value.
  const inputValue = $derived(
    userDraft !== null && (focused || parseError) ? userDraft : formattedValue
  );

  const hiddenValue = $derived.by(() => {
    if (!dateValue) return '';
    return valueFormat === 'iso' ? dateValue.toISOString() : toDateInputValue(dateValue);
  });

  const effectivePlaceholder = $derived(placeholder ?? bt('datepicker.placeholder'));
  const effectiveError = $derived(error ?? parseError);

  const iconSize = $derived(
    size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' || size === 'xl' ? 18 : 16
  );

  const showClearIcon = $derived(clearable && !!dateValue && !disabled);

  // Size-aware overrides for the Input's right-icon area when we render
  // BOTH the clear and open buttons. Input's default `iconContainer` is
  // sized for one icon (w-7..w-14) — we widen it and bump `base`'s
  // right padding by the same amount so the input text doesn't collide.
  const dualIconClasses = $derived.by(() => {
    if (!showClearIcon) return undefined;
    const sizes = {
      xs: { container: 'w-12', padding: 'pr-12' },
      sm: { container: 'w-14', padding: 'pr-14' },
      md: { container: 'w-[4.5rem]', padding: 'pr-[4.5rem]' },
      lg: { container: 'w-20', padding: 'pr-20' },
      xl: { container: 'w-24', padding: 'pr-24' }
    } as const;
    return sizes[size ?? 'md'];
  });

  const calendarSize = $derived(
    size === 'xs' || size === 'sm'
      ? ('sm' as const)
      : size === 'lg' || size === 'xl'
        ? ('md' as const)
        : ('md' as const)
  );

  function setOpen(newOpen: boolean) {
    if (open === newOpen) return;
    open = newOpen;
    onOpenChange?.(newOpen);
  }

  function focusInput() {
    const input = triggerEl?.querySelector<HTMLInputElement>('input:not([type="hidden"])');
    input?.focus();
  }

  function commitDraft() {
    if (userDraft === null) return;
    const trimmed = userDraft.trim();
    if (trimmed === '') {
      if (dateValue !== undefined) {
        value = undefined;
        onValueChange?.(undefined);
      }
      parseError = undefined;
      userDraft = null;
      return;
    }
    const parsed = parseDate(trimmed, locale, displayFormat);
    if (!parsed) {
      parseError = bt('datepicker.invalidDate');
      return;
    }
    if (!isDateAllowed(parsed, { minDate, maxDate, disabledDates, isDateDisabled })) {
      parseError = bt('datepicker.outOfRange');
      return;
    }
    parseError = undefined;
    if (!dateValue || dateValue.getTime() !== parsed.getTime()) {
      value = parsed;
      onValueChange?.(parsed);
    }
    userDraft = null;
  }

  function handleInput(e: Event) {
    userDraft = (e.currentTarget as HTMLInputElement).value;
    if (parseError) parseError = undefined;
  }

  function handleFocus() {
    userDraft = formattedValue;
    focused = true;
  }

  function handleBlur(e: FocusEvent) {
    // Don't commit on blur if focus is moving to a control inside the
    // picker (calendar icon button, popover content) — that's a
    // "still editing" intent, not "I'm done".
    const next = e.relatedTarget;
    if (next instanceof HTMLElement && triggerEl?.contains(next)) {
      return;
    }
    focused = false;
    commitDraft();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        break;
      case 'Enter':
        if (open) {
          e.preventDefault();
          setOpen(false);
        } else if (focused) {
          e.preventDefault();
          commitDraft();
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          onEscape?.();
        } else if (focused && userDraft !== null && userDraft !== formattedValue) {
          e.preventDefault();
          userDraft = null;
          parseError = undefined;
        }
        break;
    }
  }

  function handleSelect(newValue: Date | Date[] | { start: Date; end: Date } | undefined) {
    // Calendar in `selectionMode="single"` always emits a Date.
    if (!(newValue instanceof Date)) {
      console.warn(
        '[DatePicker] expected Date from Calendar (selectionMode="single") but received',
        { received: newValue }
      );
      return;
    }
    value = newValue;
    onValueChange?.(newValue);
    parseError = undefined;
    userDraft = null;
    if (closeOnSelect) setOpen(false);
  }

  function handleClear() {
    value = undefined;
    onValueChange?.(undefined);
    userDraft = null;
    parseError = undefined;
    setOpen(false);
    focusInput();
  }

  function handleIconClick() {
    if (disabled) return;
    const wasOpen = open;
    setOpen(!wasOpen);
    if (wasOpen) focusInput();
  }
</script>

<div
  class="relative w-full {className}"
  {...restProps}
  bind:this={triggerEl}
  onkeydown={handleKeydown}
>
  <Input
    value={inputValue}
    {label}
    error={effectiveError}
    {helper}
    placeholder={effectivePlaceholder}
    {disabled}
    {required}
    {size}
    {mint}
    variant={inputVariant}
    slotClasses={dualIconClasses
      ? { base: dualIconClasses.padding, iconContainer: dualIconClasses.container }
      : undefined}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    onRightIconClick={showClearIcon ? undefined : handleIconClick}
    rightIconAriaLabel={showClearIcon ? undefined : bt('datepicker.openCalendar')}
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-controls={open ? popoverId : undefined}
    autocomplete="off"
    spellcheck={false}
  >
    {#snippet rightIcon()}
      {#if showClearIcon}
        <!-- Input wraps a single-icon `rightIcon` in a click-through
             `<span pointer-events-none>`. With two embedded buttons we
             restore pointer-events on the inner controls so both clear
             and open work. -->
        <span class="pointer-events-auto inline-flex items-center gap-0.5">
          <button
            type="button"
            class="text-text-tertiary hover:text-text-primary hover:bg-surface-hover focus-visible:ring-primary/50 rounded-modify inline-flex cursor-pointer items-center justify-center p-0.5 transition-colors duration-[var(--blocks-duration-fast)] focus-visible:ring-2 focus-visible:outline-none"
            onclick={handleClear}
            {disabled}
            aria-label={bt('accessibility.clearInput')}
          >
            <CloseIcon size={iconSize} />
          </button>
          <button
            type="button"
            class="text-text-tertiary hover:text-text-primary hover:bg-surface-hover focus-visible:ring-primary/50 rounded-modify inline-flex cursor-pointer items-center justify-center p-0.5 transition-colors duration-[var(--blocks-duration-fast)] focus-visible:ring-2 focus-visible:outline-none"
            onclick={handleIconClick}
            {disabled}
            aria-label={bt('datepicker.openCalendar')}
          >
            <CalendarIcon size={iconSize} />
          </button>
        </span>
      {:else}
        <CalendarIcon size={iconSize} />
      {/if}
    {/snippet}
  </Input>

  {#if name}
    <input type="hidden" {name} value={hiddenValue} />
  {/if}
</div>

{#if triggerEl}
  <Popover
    id={popoverId}
    triggerElement={triggerEl}
    bind:open
    autoTrigger={false}
    placement="bottom-start"
    offsetDistance={4}
    {closeOnEscape}
    {closeOnClickOutside}
    {onEscape}
    {onClickOutside}
  >
    <div class="p-2">
      <Calendar
        value={dateValue}
        onValueChange={handleSelect}
        selectionMode="single"
        view="month"
        showViewSwitcher={false}
        showLegend={false}
        showEventList={false}
        animated={false}
        variant={calendarVariant}
        size={calendarSize}
        {locale}
        {weekStartsOn}
        {showWeekNumbers}
        {showOutsideDays}
        {fixedWeeks}
        {minDate}
        {maxDate}
        {disabledDates}
        {isDateDisabled}
        {defaultMonth}
        {defaultYear}
      />
    </div>
  </Popover>
{/if}
