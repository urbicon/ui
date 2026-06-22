<script lang="ts">
  import { useBlocksI18n, mintRegistry } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useFormField } from '$lib/utils';
  import type { SliderProps } from './index';
  import { sliderVariants, type SliderVariants } from './slider.variants';

  const bt = useBlocksI18n();

  let {
    value = $bindable(50),
    min = 0,
    max = 100,
    step = 1,
    range = false,
    label,
    showValue = false,
    formatValue,
    marks,
    error,
    helper,
    intent = 'primary',
    size = 'md',
    appearance = 'default',
    disabled = false,
    name,
    validRange,
    recommendedRange,
    outOfValidRangeIntent = 'danger',
    rangeStatusText,
    onValueChange,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SliderProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // ARIA wiring is shared with every form primitive — see XC-2.
  // Slider additionally injects a `statusId` into describedBy when the
  // current value enters a constrained zone (see hasRangeConstraints below).
  const propsId = $props.id();
  const uid = `slider-${propsId}`;
  const ff = useFormField(() => ({
    fieldId: uid,
    hint: helper,
    error,
    disabled
  }));
  const statusId = `${uid}-status`;

  let trackRef = $state<HTMLDivElement>();
  let dragging = $state<'single' | 'start' | 'end' | null>(null);

  const singleValue = $derived(typeof value === 'number' ? value : 0);
  const rangeValue = $derived(
    Array.isArray(value) ? (value as [number, number]) : ([0, 0] as [number, number])
  );

  const rangeSpan = $derived(max - min || 1);

  const fillLeft = $derived.by(() => {
    if (range) return ((rangeValue[0] - min) / rangeSpan) * 100;
    return 0;
  });

  const fillWidth = $derived.by(() => {
    if (range) return ((rangeValue[1] - rangeValue[0]) / rangeSpan) * 100;
    return ((singleValue - min) / rangeSpan) * 100;
  });

  const thumbPosition = $derived(((singleValue - min) / rangeSpan) * 100);
  const thumbStartPosition = $derived(((rangeValue[0] - min) / rangeSpan) * 100);
  const thumbEndPosition = $derived(((rangeValue[1] - min) / rangeSpan) * 100);

  const defaultFormat = (v: number | [number, number]) => {
    if (Array.isArray(v)) return `${v[0]} – ${v[1]}`;
    return String(v);
  };

  const displayValue = $derived(formatValue ? formatValue(value!) : defaultFormat(value!));

  // ─── Range-Constraints ──────────────────────────────────────────────────
  type ZoneStatus =
    | 'none'
    | 'insideRecommended'
    | 'insideValidOnly'
    | 'outsideValidDanger'
    | 'outsideValidWarning';

  const hasRangeConstraints = $derived(!!validRange || !!recommendedRange);

  // Classification: validRange takes precedence over recommendedRange. A value
  // outside validRange is never "inside-recommended" — regardless of whether
  // recommendedRange contains it. With only validRange (no recommended range),
  // "inside valid" is the only "good" zone → classified as 'insideRecommended'
  // (the variant drives the green color).
  function classifyValue(v: number): ZoneStatus {
    if (!validRange && !recommendedRange) return 'none';
    if (validRange) {
      const inValid = v >= validRange[0] && v <= validRange[1];
      if (!inValid) {
        return outOfValidRangeIntent === 'warning' ? 'outsideValidWarning' : 'outsideValidDanger';
      }
    }
    if (recommendedRange) {
      const inRecommended = v >= recommendedRange[0] && v <= recommendedRange[1];
      if (!inRecommended) return 'insideValidOnly';
    }
    return 'insideRecommended';
  }

  const severityRank: Record<ZoneStatus, number> = {
    none: 0,
    insideRecommended: 1,
    insideValidOnly: 2,
    outsideValidWarning: 3,
    outsideValidDanger: 4
  };

  const currentZoneStatus = $derived.by<ZoneStatus>(() => {
    if (!hasRangeConstraints) return 'none';
    if (range) {
      const a = classifyValue(rangeValue[0]);
      const b = classifyValue(rangeValue[1]);
      return severityRank[a] >= severityRank[b] ? a : b;
    }
    return classifyValue(singleValue);
  });

  function pctOf(v: number) {
    return ((v - min) / rangeSpan) * 100;
  }

  function clampPct(v: number) {
    return Math.max(0, Math.min(100, v));
  }

  // Zone boundary points — sorted, deduplicated, clamped to [min, max]
  const zoneBoundaries = $derived.by<number[]>(() => {
    if (!hasRangeConstraints) return [];
    const raw: number[] = [];
    if (validRange) raw.push(validRange[0], validRange[1]);
    if (recommendedRange) raw.push(recommendedRange[0], recommendedRange[1]);
    return raw
      .filter((v, i, arr) => v > min && v < max && arr.indexOf(v) === i)
      .sort((a, b) => a - b);
  });

  // CSS gradient with subtle zone colors
  const trackGradient = $derived.by(() => {
    if (!hasRangeConstraints) return '';

    const colorFor = (status: ZoneStatus) => {
      if (status === 'insideRecommended') return 'var(--color-success-subtle)';
      if (status === 'insideValidOnly') return 'var(--color-warning-subtle)';
      if (status === 'outsideValidDanger') return 'var(--color-danger-subtle)';
      if (status === 'outsideValidWarning') return 'var(--color-warning-subtle)';
      return 'var(--color-surface-subtle)';
    };

    const points = [min, ...zoneBoundaries, max];
    const stops: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const segStart = points[i];
      const segEnd = points[i + 1];
      const mid = (segStart + segEnd) / 2;
      const color = colorFor(classifyValue(mid));
      stops.push(`${color} ${clampPct(pctOf(segStart))}%`);
      stops.push(`${color} ${clampPct(pctOf(segEnd))}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  });

  // Warn about range constraints outside [min, max] (once per value)
  let warnedKey = '';
  $effect(() => {
    const key = `${validRange?.[0]}|${validRange?.[1]}|${recommendedRange?.[0]}|${recommendedRange?.[1]}|${min}|${max}`;
    if (key === warnedKey) return;
    warnedKey = key;
    if (validRange && (validRange[0] < min || validRange[1] > max)) {
      console.warn(
        `[Slider] validRange ${JSON.stringify(validRange)} lies outside [${min}, ${max}]. ` +
          'Ranges outside the slider scale are clipped visually.'
      );
    }
    if (recommendedRange && (recommendedRange[0] < min || recommendedRange[1] > max)) {
      console.warn(
        `[Slider] recommendedRange ${JSON.stringify(recommendedRange)} lies outside [${min}, ${max}]. ` +
          'Ranges outside the slider scale are clipped visually.'
      );
    }
  });

  // Range status texts (custom > i18n > English fallback). When the consumer
  // sets no `insideRecommended` override and only `validRange` (without
  // `recommendedRange`) is configured, the default text switches from the
  // recommendation-focused to the validity-focused wording ("In valid range")
  // so no misleading "recommended" shows up.
  const statusTexts = $derived({
    insideRecommended:
      rangeStatusText?.insideRecommended ||
      (validRange && !recommendedRange
        ? bt('slider.rangeStatus.insideValid') || 'In valid range'
        : bt('slider.rangeStatus.insideRecommended') || 'In recommended range'),
    insideValidOnly:
      rangeStatusText?.insideValidOnly ||
      bt('slider.rangeStatus.insideValidOnly') ||
      'Outside recommended range, but valid',
    outsideValid:
      rangeStatusText?.outsideValid ||
      bt('slider.rangeStatus.outsideValid') ||
      'Outside valid range'
  });

  const currentStatusText = $derived.by(() => {
    if (currentZoneStatus === 'insideRecommended') return statusTexts.insideRecommended;
    if (currentZoneStatus === 'insideValidOnly') return statusTexts.insideValidOnly;
    if (currentZoneStatus === 'outsideValidDanger' || currentZoneStatus === 'outsideValidWarning')
      return statusTexts.outsideValid;
    return '';
  });

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the slider's active variants.
  const variantProps: SliderVariants = $derived({
    intent,
    size,
    appearance,
    disabled: disabled || undefined,
    error: !!error || undefined,
    messageType: error ? 'error' : 'helper',
    rangeStatus: currentZoneStatus
  });

  const styles = $derived(sliderVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Slider', preset, variantProps, slotClassesProp)
  );

  // aria-describedby chain: error > helper, plus rangeStatus when active.
  // `ff.describedBy` already handles error/hint in the canonical order;
  // we append the optional statusId.
  const describedBy = $derived(
    [ff.describedBy, hasRangeConstraints ? statusId : undefined].filter(Boolean).join(' ') ||
      undefined
  );

  $effect(() => {
    if (trackRef && mint && mint !== 'none' && !disabled) {
      return mintRegistry.apply(trackRef, mint);
    }
  });

  function clamp(val: number) {
    const stepped = Math.round((val - min) / step) * step + min;
    return Math.min(Math.max(stepped, min), max);
  }

  function getValueFromPosition(clientX: number): number {
    if (!trackRef) return min;
    const rect = trackRef.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    return clamp(pct * rangeSpan + min);
  }

  function updateValue(newVal: number) {
    if (disabled) return;

    if (range) {
      const rv = [...rangeValue] as [number, number];
      if (dragging === 'start') {
        rv[0] = Math.min(newVal, rv[1]);
      } else if (dragging === 'end') {
        rv[1] = Math.max(newVal, rv[0]);
      }
      value = rv;
    } else {
      value = newVal;
    }
    onValueChange?.(value);
  }

  function handlePointerDown(event: PointerEvent, target: 'single' | 'start' | 'end') {
    if (disabled) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragging = target;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!dragging) return;
    updateValue(getValueFromPosition(event.clientX));
  }

  function handlePointerUp() {
    dragging = null;
  }

  function handleTrackClick(event: MouseEvent) {
    if (disabled) return;
    const newVal = getValueFromPosition(event.clientX);

    if (range) {
      const distStart = Math.abs(newVal - rangeValue[0]);
      const distEnd = Math.abs(newVal - rangeValue[1]);
      dragging = distStart <= distEnd ? 'start' : 'end';
      updateValue(newVal);
      dragging = null;
    } else {
      dragging = 'single';
      updateValue(newVal);
      dragging = null;
    }
  }

  function handleKeydown(event: KeyboardEvent, target: 'single' | 'start' | 'end') {
    if (disabled) return;
    let current: number;

    if (target === 'single') current = singleValue;
    else if (target === 'start') current = rangeValue[0];
    else current = rangeValue[1];

    let newVal: number;
    const bigStep = step * 10;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        newVal = clamp(current + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        newVal = clamp(current - step);
        break;
      case 'PageUp':
        event.preventDefault();
        newVal = clamp(current + bigStep);
        break;
      case 'PageDown':
        event.preventDefault();
        newVal = clamp(current - bigStep);
        break;
      case 'Home':
        event.preventDefault();
        newVal = min;
        break;
      case 'End':
        event.preventDefault();
        newVal = max;
        break;
      default:
        return;
    }

    dragging = target;
    updateValue(newVal);
    dragging = null;
  }
</script>

<div
  class={unstyled
    ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
  {...restProps}
>
  {#if label || showValue}
    <div
      class={unstyled ? (slotClasses?.header ?? '') : styles.header({ class: slotClasses?.header })}
    >
      {#if label}
        <span
          class={unstyled
            ? (slotClasses?.label ?? '')
            : styles.label({ class: slotClasses?.label })}
        >
          {label}
        </span>
      {/if}
      {#if showValue}
        <span
          class={unstyled
            ? (slotClasses?.valueText ?? '')
            : styles.valueText({ class: slotClasses?.valueText })}
        >
          {displayValue}
        </span>
      {/if}
    </div>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    bind:this={trackRef}
    class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}
    onclick={handleTrackClick}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
  >
    <div
      class={unstyled ? (slotClasses?.track ?? '') : styles.track({ class: slotClasses?.track })}
      style={hasRangeConstraints ? `background: ${trackGradient}` : undefined}
    >
      <div
        class={unstyled ? (slotClasses?.range ?? '') : styles.range({ class: slotClasses?.range })}
        style="left: {fillLeft}%; width: {fillWidth}%"
      ></div>
    </div>

    {#if hasRangeConstraints}
      {#each zoneBoundaries as boundary (boundary)}
        <span
          aria-hidden="true"
          class={unstyled
            ? (slotClasses?.boundaryTick ?? '')
            : styles.boundaryTick({ class: slotClasses?.boundaryTick })}
          style="left: {clampPct(pctOf(boundary))}%"
        ></span>
      {/each}
    {/if}

    {#if range}
      <div
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={rangeValue[1]}
        aria-valuenow={rangeValue[0]}
        aria-label={label ? `${label} minimum` : bt('accessibility.minimum') || 'Minimum'}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        class={unstyled ? (slotClasses?.thumb ?? '') : styles.thumb({ class: slotClasses?.thumb })}
        style="left: {thumbStartPosition}%"
        onpointerdown={(e) => handlePointerDown(e, 'start')}
        onkeydown={(e) => handleKeydown(e, 'start')}
      ></div>
      <div
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-valuemin={rangeValue[0]}
        aria-valuemax={max}
        aria-valuenow={rangeValue[1]}
        aria-label={label ? `${label} maximum` : bt('accessibility.maximum') || 'Maximum'}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        class={unstyled ? (slotClasses?.thumb ?? '') : styles.thumb({ class: slotClasses?.thumb })}
        style="left: {thumbEndPosition}%"
        onpointerdown={(e) => handlePointerDown(e, 'end')}
        onkeydown={(e) => handleKeydown(e, 'end')}
      ></div>
    {:else}
      <div
        role="slider"
        tabindex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={singleValue}
        aria-label={label || bt('accessibility.slider') || 'Slider'}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        class={unstyled ? (slotClasses?.thumb ?? '') : styles.thumb({ class: slotClasses?.thumb })}
        style="left: {thumbPosition}%"
        onpointerdown={(e) => handlePointerDown(e, 'single')}
        onkeydown={(e) => handleKeydown(e, 'single')}
      ></div>
    {/if}

    {#if marks}
      {#each marks as mark (mark.value)}
        {@const pos = ((mark.value - min) / rangeSpan) * 100}
        {#if mark.label}
          <span
            class={unstyled ? (slotClasses?.mark ?? '') : styles.mark({ class: slotClasses?.mark })}
            style="left: {pos}%"
          >
            {mark.label}
          </span>
        {/if}
      {/each}
    {/if}
  </div>

  {#if name}
    {#if range}
      <input type="hidden" name="{name}_min" value={rangeValue[0]} />
      <input type="hidden" name="{name}_max" value={rangeValue[1]} />
    {:else}
      <input type="hidden" {name} value={singleValue} />
    {/if}
  {/if}

  {#if hasRangeConstraints}
    <div
      id={statusId}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class={unstyled
        ? (slotClasses?.rangeStatus ?? '')
        : styles.rangeStatus({ class: slotClasses?.rangeStatus })}
    >
      <span
        aria-hidden="true"
        class={unstyled
          ? (slotClasses?.rangeStatusIcon ?? '')
          : styles.rangeStatusIcon({ class: slotClasses?.rangeStatusIcon })}
      >
        {#if currentZoneStatus === 'insideRecommended'}
          ✓
        {:else if currentZoneStatus === 'insideValidOnly'}
          !
        {:else if currentZoneStatus === 'outsideValidDanger' || currentZoneStatus === 'outsideValidWarning'}
          ✕
        {/if}
      </span>
      {currentStatusText}
    </div>
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
  {:else if ff.hintId}
    <div
      id={ff.hintId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {helper}
    </div>
  {/if}
</div>
