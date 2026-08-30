<script lang="ts">
  import { resolveDateLocale, useI18n } from '@urbicon-ui/i18n';
  // ⚠ Mirror non-trivial changes to DatePicker.svelte (or vice versa)
  // — these two pickers share ~90% of state-machine logic.
  import { Input } from '$lib/primitives/Input';
  import { Popover } from '$lib/primitives/Popover';
  import { Calendar } from '$lib/components/Calendar';
  import type { CalendarSelection, DateRange } from '$lib/components/Calendar';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { datePickerVariants } from './datepicker.variants';
  import { resolveIcon } from '$lib/icons';
  import CalendarIconDefault from '$lib/icons/CalendarIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { useBlocksI18n } from '$lib';
  import { formatDateRangeInput, parseDateRangeInput, isDateAllowed } from './datepicker.engine';
  import { toDateInputValue } from '$lib/utils/date';
  import type { DateRangePickerProps } from '.';

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
    locale = 'auto',
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
    mint = 'none',
    defaultMonth,
    defaultYear,
    name,
    valueFormat = 'date',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: DateRangePickerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  // `datePickerVariants` has no axes — the root is a positioning context — so
  // this object feeds `resolveSlotClasses` alone, not a tv() call. Its keys are
  // the values the picker hands to the Input and the Calendar it wraps, which
  // is what an `overrides` rule on a picker can meaningfully name.
  const variantProps = $derived({ size, inputVariant, calendarVariant, disabled });
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'DateRangePicker', preset, variantProps, slotClassesProp)
  );

  // --- Locale resolution ---
  // `'auto'` follows the active `<I18nProvider>`, matching CurrencyInput. Reading
  // the locale from context (not `Intl` with `undefined`) keeps SSR and hydration
  // on the same tag; without a provider it is the base locale (`en`). The helper
  // verifies the context value before it reaches `Intl` — see
  // @urbicon-ui/i18n's resolve-date-locale.ts for why the prop is trusted and the context is not.
  const i18nLocale = useI18n();
  const resolvedLocale = $derived(resolveDateLocale(locale, i18nLocale.locale));

  const propsId = $props.id();
  const popoverId = `daterangepicker-${propsId}-popover`;

  let open = $state(false);
  let triggerEl: HTMLDivElement | undefined = $state();
  let userDraft = $state<string | null>(null);
  let focused = $state(false);
  let parseError = $state<string | undefined>();

  const formattedValue = $derived(
    value ? formatDateRangeInput(value.start, value.end, resolvedLocale, displayFormat) : ''
  );

  const inputValue = $derived(
    userDraft !== null && (focused || parseError) ? userDraft : formattedValue
  );

  function serialize(d: Date): string {
    if (Number.isNaN(d.getTime())) {
      console.warn('[DateRangePicker] cannot serialize Invalid Date', { d });
      return '';
    }
    return valueFormat === 'iso' ? d.toISOString() : toDateInputValue(d);
  }
  const hiddenStart = $derived(value ? serialize(value.start) : '');
  const hiddenEnd = $derived(value ? serialize(value.end) : '');

  const effectivePlaceholder = $derived(placeholder ?? bt('datepicker.rangePlaceholder'));
  const effectiveError = $derived(error ?? parseError);

  const iconSize = $derived(
    size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' || size === 'xl' ? 18 : 16
  );

  const showClearIcon = $derived(clearable && !!value && !disabled);

  // See DatePicker.svelte for rationale — Input's default icon area is
  // sized for one icon; we widen it (and the right-padding of the input
  // body) when rendering both clear and open buttons.
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
        : ('sm' as const)
  );

  const calendarValue = $derived(
    value ? ({ start: value.start, end: value.end } as CalendarSelection) : undefined
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

  function isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function rangesEqual(a: DateRange, b: DateRange): boolean {
    return isSameDay(a.start, b.start) && isSameDay(a.end, b.end);
  }

  function commitDraft() {
    if (userDraft === null) return;
    const trimmed = userDraft.trim();
    if (trimmed === '') {
      if (value !== undefined) {
        value = undefined;
        onValueChange?.(undefined);
      }
      parseError = undefined;
      userDraft = null;
      return;
    }
    const parsed = parseDateRangeInput(trimmed, resolvedLocale, displayFormat);
    if (!parsed) {
      parseError = bt('datepicker.invalidRange');
      return;
    }
    const constraints = { minDate, maxDate, disabledDates, isDateDisabled };
    if (!isDateAllowed(parsed.start, constraints) || !isDateAllowed(parsed.end, constraints)) {
      parseError = bt('datepicker.outOfRange');
      return;
    }
    parseError = undefined;
    if (!value || !rangesEqual(value, parsed)) {
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

  function handleSelect(newValue: CalendarSelection | undefined) {
    if (!newValue) return;
    if (newValue instanceof Date || Array.isArray(newValue)) {
      console.warn(
        '[DateRangePicker] expected DateRange from Calendar (selectionMode="range") but received',
        { received: newValue }
      );
      return;
    }
    const range: DateRange = newValue;

    // Calendar emits start === end on the first click and completes on
    // the second. We always update the bound value (so the calendar
    // shows the in-progress selection visually) but only fire
    // `onValueChange` on completion so consumers don't see an
    // intermediate `{start: d, end: d}` as a deliberate change.
    const isComplete = !isSameDay(range.start, range.end);

    value = range;
    if (isComplete) onValueChange?.(range);
    parseError = undefined;
    userDraft = null;

    if (closeOnSelect && isComplete) {
      setOpen(false);
    }
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
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : datePickerVariants({ class: [slotClasses?.base, className] })}
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
    <input type="hidden" name="{name}_start" value={hiddenStart} />
    <input type="hidden" name="{name}_end" value={hiddenEnd} />
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
        value={calendarValue}
        onValueChange={handleSelect}
        selectionMode="range"
        view="month"
        showViewSwitcher={false}
        showLegend={false}
        showEventList={false}
        animated={false}
        variant={calendarVariant}
        size={calendarSize}
        locale={resolvedLocale}
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
