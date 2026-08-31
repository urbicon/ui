<script lang="ts">
  import { untrack } from 'svelte';
  import { useBlocksI18n } from '$lib';
  import CoreFieldMessage from '$lib/internal/core/CoreFieldMessage.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext } from '$lib/utils';
  import { resolveIcon } from '$lib/icons';
  import ClockIconDefault from '$lib/icons/ClockIcon.svelte';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { TimeInputProps } from './index';
  import { timeInputVariants, type TimeInputVariants } from './time-input.variants';

  const bt = useBlocksI18n();
  const ClockIcon = resolveIcon('clock', ClockIconDefault);

  let {
    value = $bindable(null),
    format = '24h',
    withSeconds = false,
    min,
    max,
    tier,
    variant = 'outlined',
    size = 'md',
    intent = 'default',
    disabled = false,
    readonly = false,
    required = false,
    fullWidth = false,
    showIcon = true,
    label,
    helper,
    error,
    icon,
    onValueChange,
    name,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id: idProp,
    'aria-label': ariaLabel
  }: TimeInputProps = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `timeinput-${propsId}`);
  const labelId = $derived(`${fieldId}-label`);
  const messageId = $derived(`${fieldId}-message`);
  const describedBy = $derived(error || helper ? messageId : undefined);

  const hourMax = $derived(format === '12h' ? 12 : 23);
  const hourMin = $derived(format === '12h' ? 1 : 0);

  // Segment display strings — the DOM source of truth. Kept unpadded while a
  // single digit is mid-entry, padded once the segment commits, so typing "9"
  // in the hour shows "9" (not "09") until the field advances.
  let hourStr = $state('');
  let minuteStr = $state('');
  let secondStr = $state('');
  let meridiem = $state<'AM' | 'PM'>('AM');

  let hourEl = $state<HTMLInputElement>();
  let minuteEl = $state<HTMLInputElement>();
  let secondEl = $state<HTMLInputElement>();
  let meridiemEl = $state<HTMLSpanElement>();

  function pad(n: number): string {
    return String(n).padStart(2, '0');
  }

  function num(str: string): number | null {
    if (str === '') return null;
    const n = Number.parseInt(str, 10);
    return Number.isNaN(n) ? null : n;
  }

  function to24(h12: number, mer: 'AM' | 'PM'): number {
    if (mer === 'AM') return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  }

  // Canonical 24-hour value the current segments describe, or null when any
  // required segment is empty.
  function canonicalFromSegments(): string | null {
    const h = num(hourStr);
    const m = num(minuteStr);
    const s = withSeconds ? num(secondStr) : 0;
    if (h === null || m === null || (withSeconds && s === null)) return null;
    // A provisional "0" in a 12-hour hour maps to 12 (midnight/noon); the clamp
    // to [1,12] is belt-and-suspenders so an out-of-range hour (e.g. a stale "13"
    // left over from a runtime format flip) can never produce a 25:xx value.
    const H = format === '12h' ? to24(Math.min(Math.max(h === 0 ? 12 : h, 1), 12), meridiem) : h;
    const parts = [pad(H), pad(m)];
    if (withSeconds) parts.push(pad(s as number));
    return parts.join(':');
  }

  function setValue(next: string | null) {
    if (next !== value) {
      value = next;
      onValueChange?.(next);
    }
  }

  function syncFromValue(v: string | null) {
    if (!v) {
      hourStr = '';
      minuteStr = '';
      secondStr = '';
      return;
    }
    const [hh = '', mm = '', ss = ''] = v.split(':');
    const H = num(hh) ?? 0;
    const m = num(mm) ?? 0;
    if (format === '12h') {
      meridiem = H < 12 ? 'AM' : 'PM';
      const h12 = H % 12 === 0 ? 12 : H % 12;
      hourStr = pad(h12);
    } else {
      hourStr = pad(H);
    }
    minuteStr = pad(m);
    secondStr = withSeconds ? pad(num(ss) ?? 0) : '';
  }

  // Re-seed the segments from `value` on any external change. `format` and
  // `withSeconds` are read (via `void`) purely to register them as dependencies:
  // without that, a runtime 24h→12h flip would leave stale segments (e.g. an hour
  // of "13" beside an AM button — a state the next meridiem toggle would turn into
  // "25:30"). The `incoming !== current` guard both skips a local edit (which
  // already set `value`) and fires the re-seed on a format switch, because the
  // canonical computed under the new format no longer matches the raw value.
  $effect(() => {
    const incoming = value ?? null;
    void format;
    void withSeconds;
    const current = untrack(() => canonicalFromSegments());
    if (incoming !== current) {
      untrack(() => syncFromValue(incoming));
    }
  });

  const variantProps: TimeInputVariants = $derived({
    tier: effectiveTier,
    variant,
    size,
    intent,
    disabled: disabled || undefined,
    readonly: readonly || undefined,
    error: !!error || undefined,
    required: required || undefined,
    fullWidth: fullWidth || undefined,
    messageType: error ? 'error' : 'helper'
  });

  const styles = $derived(timeInputVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'TimeInput', preset, variantProps, slotClassesProp)
  );

  function segmentClass() {
    return unstyled
      ? (slotClasses?.segment ?? '')
      : styles.segment({ class: slotClasses?.segment });
  }

  const order = $derived(
    [
      hourEl,
      minuteEl,
      withSeconds ? secondEl : undefined,
      format === '12h' ? meridiemEl : undefined
    ].filter(Boolean) as (HTMLInputElement | HTMLSpanElement)[]
  );

  function advanceFrom(el: HTMLElement) {
    const idx = order.indexOf(el as HTMLInputElement);
    const next = order[idx + 1];
    if (next) {
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    }
  }

  function stepBy(str: string, delta: number, segMin: number, segMax: number): string {
    const cur = num(str);
    const span = segMax - segMin + 1;
    if (cur === null) return pad(delta > 0 ? segMin : segMax);
    const next = ((((cur - segMin + delta) % span) + span) % span) + segMin;
    return pad(next);
  }

  // Digit-entry state machine shared by the three numeric segments. Returns the
  // new display string and whether the segment is complete (→ advance focus).
  function applyDigit(el: HTMLInputElement, segMax: number): { next: string; complete: boolean } {
    const digits = el.value.replace(/\D/g, '');
    if (digits === '') return { next: '', complete: false };
    const two = digits.slice(-2);
    if (two.length === 2) {
      const n = Number.parseInt(two, 10);
      if (n > segMax) {
        // second digit overflowed — treat it as a fresh single-digit entry
        const last = Number.parseInt(two.slice(-1), 10);
        return { next: String(last), complete: last * 10 > segMax };
      }
      return { next: pad(Math.max(n, 0)), complete: true };
    }
    const n = Number.parseInt(two, 10);
    // No valid second digit is possible (e.g. hour "3" in 24h) — commit now.
    if (n * 10 > segMax) return { next: pad(n), complete: true };
    return { next: String(n), complete: false };
  }

  function handleHourInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const { next, complete } = applyDigit(el, hourMax);
    hourStr = next;
    el.value = next;
    setValue(canonicalFromSegments());
    if (complete) advanceFrom(el);
  }

  function handleMinuteInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const { next, complete } = applyDigit(el, 59);
    minuteStr = next;
    el.value = next;
    setValue(canonicalFromSegments());
    if (complete) advanceFrom(el);
  }

  function handleSecondInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const { next, complete } = applyDigit(el, 59);
    secondStr = next;
    el.value = next;
    setValue(canonicalFromSegments());
    if (complete) advanceFrom(el);
  }

  function commitSegment(which: 'hour' | 'minute' | 'second') {
    // Pad a provisional single digit once the segment loses the caret.
    if (which === 'hour' && hourStr) hourStr = pad(num(hourStr) ?? 0);
    if (which === 'minute' && minuteStr) minuteStr = pad(num(minuteStr) ?? 0);
    if (which === 'second' && secondStr) secondStr = pad(num(secondStr) ?? 0);
  }

  type SegName = 'hour' | 'minute' | 'second';

  function handleSegmentKeydown(seg: SegName, e: KeyboardEvent) {
    if (disabled) return;
    const el = e.currentTarget as HTMLInputElement;
    const segMin = seg === 'hour' ? hourMin : 0;
    const segMax = seg === 'hour' ? hourMax : 59;
    const strOf = seg === 'hour' ? hourStr : seg === 'minute' ? minuteStr : secondStr;
    const setStr = (v: string) => {
      if (seg === 'hour') hourStr = v;
      else if (seg === 'minute') minuteStr = v;
      else secondStr = v;
    };
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (readonly) break;
        setStr(stepBy(strOf, 1, segMin, segMax));
        setValue(canonicalFromSegments());
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (readonly) break;
        setStr(stepBy(strOf, -1, segMin, segMax));
        setValue(canonicalFromSegments());
        break;
      case 'ArrowLeft': {
        e.preventDefault();
        const idx = order.indexOf(el);
        if (idx > 0) order[idx - 1].focus();
        break;
      }
      case 'ArrowRight':
        e.preventDefault();
        advanceFrom(el);
        break;
      case 'Backspace':
        if (readonly) break;
        e.preventDefault();
        if (strOf) {
          setStr('');
          el.value = '';
          setValue(canonicalFromSegments());
        } else {
          const idx = order.indexOf(el);
          if (idx > 0) order[idx - 1].focus();
        }
        break;
    }
  }

  function handleSegmentFocus(e: FocusEvent) {
    (e.currentTarget as HTMLInputElement).select();
  }

  function toggleMeridiem(next?: 'AM' | 'PM') {
    if (disabled || readonly) return;
    meridiem = next ?? (meridiem === 'AM' ? 'PM' : 'AM');
    setValue(canonicalFromSegments());
  }

  function handleMeridiemKeydown(e: KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      // The segment is a spinbutton on a span (html-aria forbids the role on
      // <button>), so Enter/Space activation is wired manually.
      case 'Enter':
      case ' ':
        e.preventDefault();
        toggleMeridiem();
        break;
      case 'a':
      case 'A':
        e.preventDefault();
        toggleMeridiem('AM');
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        toggleMeridiem('PM');
        break;
      case 'ArrowLeft':
      case 'Backspace': {
        e.preventDefault();
        const idx = order.indexOf(e.currentTarget as HTMLSpanElement);
        if (idx > 0) order[idx - 1].focus();
        break;
      }
    }
  }

  // Clamp to [min, max] once focus leaves the whole field. Canonical HH:MM(:SS)
  // strings are zero-padded, so lexical comparison is chronological.
  function handleFocusOut(e: FocusEvent) {
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && (e.currentTarget as HTMLElement).contains(nextTarget)) return;
    commitSegment('hour');
    commitSegment('minute');
    commitSegment('second');
    let canonical = canonicalFromSegments();
    if (canonical !== null) {
      if (min && canonical < min) canonical = min;
      if (max && canonical > max) canonical = max;
      if (canonical !== value) {
        setValue(canonical);
        syncFromValue(canonical);
      }
    }
  }
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.wrapper, className)
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
>
  {#if label}
    <span
      id={labelId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}
    </span>
  {/if}

  <div
    role="group"
    aria-labelledby={label ? labelId : undefined}
    aria-label={label ? undefined : ariaLabel}
    aria-disabled={disabled ? 'true' : undefined}
    class={unstyled ? (slotClasses?.field ?? '') : styles.field({ class: slotClasses?.field })}
    onfocusout={handleFocusOut}
  >
    {#if showIcon}
      <span
        class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}
      >
        {#if icon}
          {@render icon()}
        {:else}
          <ClockIcon />
        {/if}
      </span>
    {/if}

    <input
      bind:this={hourEl}
      id={fieldId}
      value={hourStr}
      type="text"
      inputmode="numeric"
      maxlength="2"
      placeholder="--"
      autocomplete="off"
      {disabled}
      {readonly}
      role="spinbutton"
      aria-label={bt('accessibility.timeHours')}
      aria-valuemin={hourMin}
      aria-valuemax={hourMax}
      aria-valuenow={num(hourStr) ?? undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy}
      class={segmentClass()}
      oninput={handleHourInput}
      onkeydown={(e) => handleSegmentKeydown('hour', e)}
      onfocus={handleSegmentFocus}
    />
    <span
      aria-hidden="true"
      class={unstyled
        ? (slotClasses?.separator ?? '')
        : styles.separator({ class: slotClasses?.separator })}
    >
      :
    </span>
    <input
      bind:this={minuteEl}
      value={minuteStr}
      type="text"
      inputmode="numeric"
      maxlength="2"
      placeholder="--"
      autocomplete="off"
      {disabled}
      {readonly}
      role="spinbutton"
      aria-label={bt('accessibility.timeMinutes')}
      aria-valuemin={0}
      aria-valuemax={59}
      aria-valuenow={num(minuteStr) ?? undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={describedBy}
      class={segmentClass()}
      oninput={handleMinuteInput}
      onkeydown={(e) => handleSegmentKeydown('minute', e)}
      onfocus={handleSegmentFocus}
    />
    {#if withSeconds}
      <span
        aria-hidden="true"
        class={unstyled
          ? (slotClasses?.separator ?? '')
          : styles.separator({ class: slotClasses?.separator })}
      >
        :
      </span>
      <input
        bind:this={secondEl}
        value={secondStr}
        type="text"
        inputmode="numeric"
        maxlength="2"
        placeholder="--"
        autocomplete="off"
        {disabled}
        {readonly}
        role="spinbutton"
        aria-label={bt('accessibility.timeSeconds')}
        aria-valuemin={0}
        aria-valuemax={59}
        aria-valuenow={num(secondStr) ?? undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        class={segmentClass()}
        oninput={handleSecondInput}
        onkeydown={(e) => handleSegmentKeydown('second', e)}
        onfocus={handleSegmentFocus}
      />
    {/if}
    {#if format === '12h'}
      <!-- A spinbutton (not a button): aria-label on a button would OVERRIDE its
           AM/PM content, so the current state was never announced. As a
           spinbutton the state travels via aria-valuetext — same semantics as
           the sibling segments — and html-aria only permits the role on a
           non-button host, hence the span with manual focus/activation. -->
      <span
        bind:this={meridiemEl}
        role="spinbutton"
        tabindex={disabled ? -1 : 0}
        aria-label={bt('accessibility.timeMeridiem')}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={meridiem === 'AM' ? 0 : 1}
        aria-valuetext={meridiem}
        aria-disabled={disabled ? 'true' : undefined}
        aria-readonly={readonly ? 'true' : undefined}
        class={unstyled
          ? (slotClasses?.meridiem ?? '')
          : styles.meridiem({ class: slotClasses?.meridiem })}
        onclick={() => toggleMeridiem()}
        onkeydown={handleMeridiemKeydown}
      >
        {meridiem}
      </span>
    {/if}
  </div>

  <!-- Both arms share one id: `describedBy` points at `messageId` regardless of
       which arm renders, since only one ever does. -->
  <CoreFieldMessage
    {error}
    {helper}
    errorId={messageId}
    helperId={messageId}
    class={unstyled
      ? (slotClasses?.message ?? '')
      : styles.message({ class: slotClasses?.message })}
  />

  {#if name}
    <input type="hidden" {name} value={value ?? ''} />
  {/if}
</div>
