<script lang="ts">
  import { untrack } from 'svelte';
  import { useBlocksI18n } from '#lib';
  import CoreFieldMessage from '#lib/internal/core/CoreFieldMessage.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '#lib/provider/index.js';
  import { getTierContext } from '#lib/utils/index.js';
  import { resolveIcon } from '#lib/icons/index.js';
  import ClockIconDefault from '#lib/icons/ClockIcon.svelte';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import type { TimeInputProps } from './index';
  import { timeInputVariants, type TimeInputVariants } from './time-input.variants';

  const bt = useBlocksI18n();
  const ClockIcon = resolveIcon('clock', ClockIconDefault);

  let {
    value = $bindable(),
    format = '24h',
    withSeconds = false,
    step,
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
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: TimeInputProps = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `timeinput-${propsId}`);
  const labelId = $derived(`${fieldId}-label`);
  const messageId = $derived(`${fieldId}-message`);
  const labelledBy = $derived(
    [label ? labelId : undefined, ariaLabelledby].filter(Boolean).join(' ') || undefined
  );
  const describedBy = $derived(
    [error || helper ? messageId : undefined, ariaDescribedby].filter(Boolean).join(' ') ||
      undefined
  );

  const hourMax = $derived(format === '12h' ? 12 : 23);
  const hourMin = $derived(format === '12h' ? 1 : 0);

  // Segment display strings — the DOM source of truth. Kept unpadded while a
  // single digit is mid-entry, padded once the segment commits, so typing "9"
  // in the hour shows "9" (not "09") until the field advances.
  let hourStr = $state('');
  let minuteStr = $state('');
  let secondStr = $state('');
  let meridiem = $state<'AM' | 'PM'>('AM');

  let fieldEl = $state<HTMLDivElement>();
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

  function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
  }

  // Seconds since midnight of an `HH:MM(:SS)` string.
  function toSeconds(v: string | undefined): number | null {
    if (!v) return null;
    const [hh = '', mm = '', ss = '0'] = v.split(':');
    const h = num(hh);
    const m = num(mm);
    const s = num(ss);
    return h === null || m === null || s === null ? null : h * 3600 + m * 60 + s;
  }

  function timeString(t: number): string {
    const parts = [pad(Math.floor(t / 3600)), pad(Math.floor(t / 60) % 60)];
    if (withSeconds) parts.push(pad(t % 60));
    return parts.join(':');
  }

  // The raster follows <input type="time">: `step` seconds counted from `min`
  // (or midnight). Unset it is 60, but 1 with `withSeconds`, so a seconds segment
  // stays freely typed unless a step says otherwise. Without a seconds segment
  // only whole minutes are representable, so the raster keeps the points that
  // fall on one: lcm(step, 60).
  const stepValid = $derived(step === undefined || (Number.isInteger(step) && step > 0));
  const rasterStep = $derived.by(() => {
    const s = stepValid && step !== undefined ? step : withSeconds ? 1 : 60;
    return withSeconds ? s : (s * 60) / gcd(s, 60);
  });
  const minSeconds = $derived.by(() => {
    const b = toSeconds(min);
    return b === null || withSeconds ? b : b - (b % 60);
  });
  const rasterBase = $derived(minSeconds ?? 0);
  $effect(() => {
    if (!stepValid && import.meta.env?.DEV) {
      console.warn(`[TimeInput] step must be a positive whole number of seconds, got ${step}`);
    }
  });

  // A segment the raster pins to one value is shown, not typed: an hourly
  // raster fixes the minute, a whole-minute raster fixes the second.
  const minuteFixed = $derived(rasterStep % 3600 === 0);
  const secondFixed = $derived(withSeconds && rasterStep % 60 === 0);
  const baseMinute = $derived(Math.floor(rasterBase / 60) % 60);
  const baseSecond = $derived(rasterBase % 60);

  function rasterOffset(t: number): number {
    return (((t - rasterBase) % rasterStep) + rasterStep) % rasterStep;
  }

  // The raster point at or below `t`; the first one of the day when none is.
  function snapDown(t: number): number {
    const floored = t - rasterOffset(t);
    return floored < 0 ? floored + rasterStep : floored;
  }

  // What the segments spell: `undefined` while every typed segment is empty,
  // `null` while some are and some are not, else seconds since midnight. A fixed
  // segment counts with the value it was given, if any, until it is snapped.
  function segmentsSeconds(): number | null | undefined {
    const typed = [hourStr];
    if (!minuteFixed) typed.push(minuteStr);
    if (withSeconds && !secondFixed) typed.push(secondStr);
    if (typed.every((str) => str === '')) return undefined;
    if (typed.includes('')) return null;
    const h = num(hourStr) as number;
    const m = num(minuteStr) ?? baseMinute;
    const s = withSeconds ? (num(secondStr) ?? baseSecond) : 0;
    // A provisional "0" in a 12-hour hour maps to 12 (midnight/noon); the clamp
    // to [1,12] is belt-and-suspenders so an out-of-range hour (e.g. a stale "13"
    // left over from a runtime format flip) can never produce a 25:xx value.
    const H = format === '12h' ? to24(Math.min(Math.max(h === 0 ? 12 : h, 1), 12), meridiem) : h;
    return H * 3600 + m * 60 + s;
  }

  // A single unpadded digit is still being typed: "4" may yet become "45".
  function midEntry(): boolean {
    return [hourStr, minuteStr, withSeconds ? secondStr : ''].some((str) => str.length === 1);
  }

  // The value the segments report, snapped down onto the raster. While a digit
  // mid-entry leaves the time off the raster it is `null`: the field shows no
  // valid time yet, and a snapped one would differ from what it shows.
  function canonicalFromSegments(): string | null | undefined {
    const t = segmentsSeconds();
    if (typeof t !== 'number') return t;
    if (rasterOffset(t) !== 0 && midEntry()) return null;
    return timeString(snapDown(t));
  }

  function setValue(next: string | null | undefined) {
    if (next !== value) {
      value = next;
      onValueChange?.(next);
    }
  }

  // Report the segments' value. `reseed` re-shows a time the raster moved; a
  // digit still mid-entry passes false, or its second digit would be lost. An
  // empty field forgets what its fixed segments were given.
  function emit(reseed: boolean) {
    const t = segmentsSeconds();
    const next = canonicalFromSegments();
    setValue(next);
    if (t === undefined) syncFromValue(undefined);
    else if (reseed && typeof t === 'number' && next !== null && snapDown(t) !== t) {
      syncFromValue(next);
    }
  }

  function syncFromValue(v: string | null | undefined) {
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
  //
  // "No time" (`undefined`, `null` or `""`) that arrives while focus is inside a
  // half-typed field is the echo of the field's own report and is ignored, with
  // nothing written back: a one-way consumer that stores "no time" as one value
  // (A2UI's `""`) hands a half-typed `null` back as `""` or `undefined`, and
  // acting on it would wipe the digits being typed. The echo of a complete time
  // is always a string, so no time meeting complete segments is a reset wherever
  // focus is, as is no time arriving while focus is elsewhere. Only a value that
  // changed counts as arriving; a format flip re-runs this effect too.
  let lastIncoming: unknown = Symbol('unseen');
  $effect(() => {
    const raw = value;
    void format;
    void withSeconds;
    untrack(() => {
      const arrived = raw !== lastIncoming;
      lastIncoming = raw;
      const incoming = raw === '' ? undefined : raw;
      if (typeof incoming === 'string') {
        if (incoming !== canonicalFromSegments()) syncFromValue(incoming);
      } else if (
        arrived &&
        (typeof canonicalFromSegments() === 'string' || !fieldEl?.contains(document.activeElement))
      ) {
        syncFromValue(undefined);
      }
    });
  });

  const variantProps: TimeInputVariants = $derived({
    tier: effectiveTier,
    variant,
    size,
    intent,
    disabled: disabled,
    readonly: readonly,
    error: !!error,
    required: required || undefined,
    fullWidth: fullWidth || undefined,
    messageType: error ? 'error' : 'helper'
  });

  const styles = $derived(timeInputVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'TimeInput',
      preset,
      variantProps,
      slotClassesProp,
      timeInputVariants.config
    )
  );

  function segmentClass() {
    return unstyled
      ? (slotClasses?.segment ?? '')
      : styles.segment({ class: slotClasses?.segment });
  }

  // Every segment in DOM order. Typing, the Arrow keys and Backspace never move
  // onto a fixed one, but a pointer can focus it, so it stays in the list to be
  // left from.
  const segments = $derived(
    [
      hourEl,
      minuteEl,
      withSeconds ? secondEl : undefined,
      format === '12h' ? meridiemEl : undefined
    ].filter(Boolean) as HTMLElement[]
  );

  // Focus the nearest segment before (-1) or after (1) `el` that is not fixed.
  function moveFocus(el: HTMLElement, dir: 1 | -1) {
    for (let i = segments.indexOf(el) + dir; i >= 0 && i < segments.length; i += dir) {
      const next = segments[i];
      if ((next === minuteEl && minuteFixed) || (next === secondEl && secondFixed)) continue;
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
      return;
    }
  }

  type SegName = 'hour' | 'minute' | 'second';

  function strOf(seg: SegName): string {
    return seg === 'hour' ? hourStr : seg === 'minute' ? minuteStr : secondStr;
  }

  function setStr(seg: SegName, v: string) {
    if (seg === 'hour') hourStr = v;
    else if (seg === 'minute') minuteStr = v;
    else secondStr = v;
  }

  // The time a segment value gives with every other segment taken from `ref`.
  function withSegment(seg: SegName, v: number, ref: number): number {
    let h = Math.floor(ref / 3600);
    let m = Math.floor(ref / 60) % 60;
    let s = ref % 60;
    if (seg === 'hour') h = format === '12h' ? to24(v, meridiem) : v;
    else if (seg === 'minute') m = v;
    else s = v;
    return h * 3600 + m * 60 + s;
  }

  // The other segments a candidate is checked against: the time the field shows,
  // or the raster's own origin while the time is incomplete.
  function stepReference(): number {
    const t = segmentsSeconds();
    return typeof t === 'number' ? t : rasterBase;
  }

  // The nearest raster point after (1) or before (-1) an off-raster `t`, wrapping
  // around the day.
  function rasterPointFrom(t: number, dir: 1 | -1): number {
    const below = snapDown(t);
    if (dir < 0) return below < t ? below : snapDown(86_399);
    const above = below > t ? below : below + rasterStep;
    return above < 86_400 ? above : snapDown(0);
  }

  // The segment values that land on the raster, in ascending order.
  function segmentValues(seg: SegName): number[] {
    const lo = seg === 'hour' ? hourMin : 0;
    const hi = seg === 'hour' ? hourMax : 59;
    const ref = stepReference();
    const fits: number[] = [];
    for (let v = lo; v <= hi; v++) {
      if (rasterOffset(withSegment(seg, v, ref)) === 0) fits.push(v);
    }
    return fits;
  }

  // The next raster value of one segment, wrapping inside it without carrying
  // into the others; from an empty segment, the first (up) or last (down) one.
  function stepSegment(seg: SegName, dir: 1 | -1): number | undefined {
    const fits = segmentValues(seg);
    if (fits.length === 0) return undefined;
    const cur = num(strOf(seg));
    if (cur === null) return dir > 0 ? fits[0] : fits[fits.length - 1];
    if (dir > 0) return fits.find((v) => v > cur) ?? fits[0];
    return [...fits].reverse().find((v) => v < cur) ?? fits[fits.length - 1];
  }

  const hourBounds = $derived(boundsOf(segmentValues('hour'), hourMin, hourMax));
  const minuteBounds = $derived(boundsOf(segmentValues('minute'), 0, 59));
  const secondBounds = $derived(boundsOf(segmentValues('second'), 0, 59));

  function boundsOf(fits: number[], lo: number, hi: number): [number, number] {
    return fits.length === 0 ? [lo, hi] : [fits[0], fits[fits.length - 1]];
  }

  // A fixed segment shows once any typed segment holds a digit: the value it was
  // given until an edit or blur snaps it, else its one raster value.
  const minuteText = $derived(
    minuteFixed ? (segmentsSeconds() === undefined ? '' : minuteStr || pad(baseMinute)) : minuteStr
  );
  const secondText = $derived(
    secondFixed ? (segmentsSeconds() === undefined ? '' : secondStr || pad(baseSecond)) : secondStr
  );

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

  function handleSegmentInput(seg: SegName, e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const { next, complete } = applyDigit(el, seg === 'hour' ? hourMax : 59);
    setStr(seg, next);
    el.value = next;
    emit(complete);
    if (complete) moveFocus(el, 1);
  }

  function commitSegment(which: SegName) {
    // Pad a provisional single digit once the segment loses the caret.
    if (which === 'hour' && hourStr) hourStr = pad(num(hourStr) ?? 0);
    if (which === 'minute' && minuteStr) minuteStr = pad(num(minuteStr) ?? 0);
    if (which === 'second' && secondStr) secondStr = pad(num(secondStr) ?? 0);
  }

  function stepFocused(seg: SegName, dir: 1 | -1) {
    const t = segmentsSeconds();
    if (typeof t === 'number' && rasterOffset(t) !== 0) {
      // Off the raster no segment value is "next"; the time moves to the raster
      // point that way, whichever segments that changes.
      syncFromValue(timeString(rasterPointFrom(t, dir)));
    } else {
      const v = stepSegment(seg, dir);
      if (v === undefined) return;
      if (typeof t === 'number') syncFromValue(timeString(withSegment(seg, v, t)));
      else setStr(seg, pad(v));
    }
    emit(true);
  }

  function handleSegmentKeydown(seg: SegName, e: KeyboardEvent) {
    if (disabled) return;
    const el = e.currentTarget as HTMLInputElement;
    const locked =
      readonly || (seg === 'minute' && minuteFixed) || (seg === 'second' && secondFixed);
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault();
        if (locked) break;
        stepFocused(seg, e.key === 'ArrowUp' ? 1 : -1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(el, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(el, 1);
        break;
      case 'Backspace':
        if (locked) break;
        e.preventDefault();
        if (strOf(seg)) {
          setStr(seg, '');
          el.value = '';
          emit(false);
        } else {
          moveFocus(el, -1);
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
    emit(true);
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
      case 'Backspace':
        e.preventDefault();
        moveFocus(e.currentTarget as HTMLSpanElement, -1);
        break;
    }
  }

  // Once focus leaves the whole field, clamp to [min, max] without leaving the
  // raster: `min` is its origin, and `max` rounds down to the last point under it.
  function handleFocusOut(e: FocusEvent) {
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && (e.currentTarget as HTMLElement).contains(nextTarget)) return;
    commitSegment('hour');
    commitSegment('minute');
    commitSegment('second');
    const t = segmentsSeconds();
    if (typeof t !== 'number') return;
    let next = snapDown(t);
    const hi = toSeconds(max);
    if (minSeconds !== null && next < minSeconds) next = minSeconds;
    if (hi !== null && next > hi) next = snapDown(hi);
    const canonical = timeString(next);
    setValue(canonical);
    if (next !== t) syncFromValue(canonical);
  }
</script>

<div
  {...restProps}
  class={unstyled
    ? resolveClassChain(slotClasses?.wrapper, className)
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
>
  {#if label}
    <span
      id={labelId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}{#if required}<span
          class={unstyled
            ? (slotClasses?.requiredMark ?? '')
            : styles.requiredMark({ class: slotClasses?.requiredMark })}
          aria-hidden="true"
        ></span>{/if}
    </span>
  {/if}

  <div
    bind:this={fieldEl}
    role="group"
    aria-labelledby={labelledBy}
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
      aria-valuemin={hourBounds[0]}
      aria-valuemax={hourBounds[1]}
      aria-valuenow={num(hourStr) ?? undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-required={required || undefined}
      aria-describedby={describedBy}
      class={segmentClass()}
      oninput={(e) => handleSegmentInput('hour', e)}
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
      value={minuteText}
      type="text"
      inputmode="numeric"
      maxlength="2"
      placeholder="--"
      autocomplete="off"
      {disabled}
      readonly={readonly || minuteFixed}
      tabindex={minuteFixed ? -1 : undefined}
      role="spinbutton"
      aria-label={bt('accessibility.timeMinutes')}
      aria-valuemin={minuteBounds[0]}
      aria-valuemax={minuteBounds[1]}
      aria-valuenow={num(minuteText) ?? undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-required={required || undefined}
      aria-describedby={describedBy}
      class={segmentClass()}
      oninput={(e) => handleSegmentInput('minute', e)}
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
        value={secondText}
        type="text"
        inputmode="numeric"
        maxlength="2"
        placeholder="--"
        autocomplete="off"
        {disabled}
        readonly={readonly || secondFixed}
        tabindex={secondFixed ? -1 : undefined}
        role="spinbutton"
        aria-label={bt('accessibility.timeSeconds')}
        aria-valuemin={secondBounds[0]}
        aria-valuemax={secondBounds[1]}
        aria-valuenow={num(secondText) ?? undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        class={segmentClass()}
        oninput={(e) => handleSegmentInput('second', e)}
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
        aria-invalid={error ? 'true' : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
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
