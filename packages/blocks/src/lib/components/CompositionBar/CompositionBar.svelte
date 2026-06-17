<script lang="ts">
  import { useBlocksI18n, mintRegistry } from '$lib';
  import { useI18n } from '@urbicon-ui/i18n';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { CompositionBarProps, CompositionBarIntent, CompositionItem } from './index';
  import { compositionBarVariants } from './composition-bar.variants';

  const bt = useBlocksI18n();
  const i18n = useI18n();

  let {
    items,
    total: totalOverride,
    formatValue,
    formatPercent,
    intent = 'primary',
    orientation = 'horizontal',
    size = 'md',
    legendPlacement = 'bottom',
    showLegend = true,
    showPercentages = true,
    showTotal = false,
    showValues = false,
    totalLabel,
    minSegmentPercent = 1.5,
    onItemSelect,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    legendItem: legendItemSnippet,
    tooltip: tooltipSnippet,
    ...restProps
  }: CompositionBarProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.CompositionBar?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'CompositionBar', preset),
      slotClassesProp
    )
  );

  let barRef = $state<HTMLDivElement>();
  let hoveredId = $state<string | number | null>(null);

  const itemsSum = $derived(items.reduce((s, i) => s + Math.max(0, i.value), 0));
  const hasExplicitTotal = $derived(totalOverride !== undefined);

  // Console warning when an explicit total < Σ items.value
  let warnedKey = '';
  $effect(() => {
    const key = `${totalOverride}|${itemsSum}`;
    if (key === warnedKey) return;
    warnedKey = key;
    if (hasExplicitTotal && totalOverride! > 0 && totalOverride! < itemsSum) {
      console.warn(
        `[CompositionBar] total (${totalOverride}) < Σ items.value (${itemsSum}). ` +
          'Bar is scaled to 100 % of the items; the total override is ignored.'
      );
    }
  });

  // Effective scaling base: for total<Σ the sum is used (override ignored),
  // for total>Σ the remainder is rendered as a neutral rest segment.
  const scaleBase = $derived.by(() => {
    if (!hasExplicitTotal) return itemsSum || 1;
    if (totalOverride! <= 0) return itemsSum || 1;
    return Math.max(totalOverride!, itemsSum) || 1;
  });

  const restValue = $derived(Math.max(0, scaleBase - itemsSum));

  // Raw percentage of each item + the rest segment, if any
  const rawPercents = $derived(items.map((i) => (Math.max(0, i.value) / scaleBase) * 100));
  const restPercent = $derived((restValue / scaleBase) * 100);

  // Minimum-width distribution: small segments are lifted to minSegmentPercent;
  // the difference is taken proportionally from larger segments.
  const adjustedPercents = $derived.by<number[]>(() => {
    const threshold = Math.max(0, Math.min(20, minSegmentPercent));
    if (threshold <= 0 || items.length === 0) return [...rawPercents];

    const smallIdx: number[] = [];
    const largeIdx: number[] = [];
    for (let i = 0; i < rawPercents.length; i++) {
      // Items with value=0 stay at 0 % — no boost needed
      if (rawPercents[i] > 0 && rawPercents[i] < threshold) smallIdx.push(i);
      else if (rawPercents[i] >= threshold) largeIdx.push(i);
    }
    if (smallIdx.length === 0) return [...rawPercents];

    let excess = 0;
    for (const i of smallIdx) excess += threshold - rawPercents[i];

    // Only small segments: distribute evenly across all non-zero items
    if (largeIdx.length === 0) {
      const nonZero = rawPercents.filter((p) => p > 0).length || 1;
      return rawPercents.map((p) => (p > 0 ? 100 / nonZero : 0));
    }

    const largeSum = largeIdx.reduce((s, i) => s + rawPercents[i], 0) || 1;
    const result = [...rawPercents];
    for (const i of smallIdx) result[i] = threshold;
    for (const i of largeIdx) {
      result[i] = Math.max(0, rawPercents[i] - excess * (rawPercents[i] / largeSum));
    }
    // Re-normalize against floating-point drift so Σ is exactly 100 %
    // (avoids 1px gaps/overflow in the flex bar)
    const sum = result.reduce((s, v) => s + v, 0);
    if (sum > 0 && Math.abs(sum - 100) > 0.001) {
      const scale = 100 / sum;
      for (let i = 0; i < result.length; i++) result[i] *= scale;
    }
    return result;
  });

  const defaultPercentFmt = (p: number) =>
    `${new Intl.NumberFormat(i18n.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p)} %`;

  const fmtValue = (v: number) => (formatValue ? formatValue(v) : v.toString());
  const fmtPercent = (p: number) => (formatPercent ? formatPercent(p) : defaultPercentFmt(p));

  // Stable IDs per item — falls back to the index when no ID is set
  const itemKey = (item: CompositionItem, index: number) =>
    item.id !== undefined ? item.id : index;

  // Default color mapping: intent → bg class
  const intentClass: Record<CompositionBarIntent, string> = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    neutral: 'bg-neutral'
  };
  // Readable text color on the segment background (for showValues)
  const onColorClass: Record<CompositionBarIntent, string> = {
    primary: 'text-text-on-primary',
    secondary: 'text-text-on-primary',
    success: 'text-text-on-primary',
    warning: 'text-text-on-surface',
    danger: 'text-text-on-primary',
    neutral: 'text-text-on-primary'
  };
  const intentRingClass: Record<CompositionBarIntent, string> = {
    primary: 'focus-visible:ring-primary/50',
    secondary: 'focus-visible:ring-secondary/50',
    success: 'focus-visible:ring-success/50',
    warning: 'focus-visible:ring-warning/50',
    danger: 'focus-visible:ring-danger/50',
    neutral: 'focus-visible:ring-neutral/50'
  };

  function getColorClass(item: CompositionItem) {
    if (item.color) return ''; // raw color via inline style
    return intentClass[item.intent ?? intent];
  }
  function getOnColorClass(item: CompositionItem) {
    if (item.color) return 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]';
    return onColorClass[item.intent ?? intent];
  }
  function getRingClass(item: CompositionItem) {
    return intentRingClass[item.intent ?? intent];
  }

  const styles = $derived(
    compositionBarVariants({
      orientation,
      size,
      legendPlacement
    })
  );

  $effect(() => {
    if (barRef && mint && mint !== 'none') {
      return mintRegistry.apply(barRef, mint);
    }
  });

  function handleSelect(item: CompositionItem, index: number) {
    onItemSelect?.(item, index);
  }

  function handleSegmentKeydown(event: KeyboardEvent, item: CompositionItem, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(item, index);
      return;
    }

    // DOM-based navigation: items with value=0 are not rendered, so the item
    // index can differ from the DOM index. Navigate directly between the
    // segments that are actually rendered.
    const segments = Array.from(
      barRef?.querySelectorAll<HTMLElement>('[data-composition-segment]') ?? []
    );
    if (segments.length === 0) return;
    const current = segments.indexOf(event.currentTarget as HTMLElement);
    if (current === -1) return;

    let nextIdx: number | null = null;
    const lastIdx = segments.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIdx = Math.min(lastIdx, current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIdx = Math.max(0, current - 1);
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = lastIdx;
    }

    if (nextIdx !== null && nextIdx !== current) {
      event.preventDefault();
      segments[nextIdx]?.focus();
    }
  }

  // ARIA summary: "Composition: 382,242 (4 shares) — Gas 57.7 %, Power 29.5 %, ..."
  const ariaSummary = $derived.by(() => {
    const totalText = fmtValue(scaleBase);
    const parts = items
      .map((item, i) => {
        const pctTxt = fmtPercent(rawPercents[i]);
        return `${item.label} ${pctTxt}`;
      })
      .join(', ');
    return bt('compositionBar.summary', {
      total: totalText,
      count: String(items.length),
      parts
    });
  });

  const resolvedTotalLabel = $derived(totalLabel ?? bt('compositionBar.total'));
</script>

<div
  class={unstyled
    ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
  {...restProps}
>
  <!-- Bar + optional total header -->
  <div
    class={unstyled
      ? (slotClasses?.barWrapper ?? '')
      : styles.barWrapper({ class: slotClasses?.barWrapper })}
  >
    {#if showTotal}
      <div
        class={unstyled ? (slotClasses?.total ?? '') : styles.total({ class: slotClasses?.total })}
      >
        <span
          class={unstyled
            ? (slotClasses?.totalLabel ?? '')
            : styles.totalLabel({ class: slotClasses?.totalLabel })}
        >
          {resolvedTotalLabel}
        </span>
        <span>{fmtValue(scaleBase)}</span>
      </div>
    {/if}

    <!-- Bar -->
    <div
      bind:this={barRef}
      role="img"
      aria-label={ariaSummary}
      class={unstyled ? (slotClasses?.bar ?? '') : styles.bar({ class: slotClasses?.bar })}
    >
      {#each items as item, index (itemKey(item, index))}
        {@const pct = adjustedPercents[index]}
        {@const rawPct = rawPercents[index]}
        {@const k = itemKey(item, index)}
        {@const isHovered = hoveredId === k}
        {#if pct > 0}
          <button
            type="button"
            data-composition-segment
            data-segment-id={k}
            class={[
              unstyled
                ? (slotClasses?.segment ?? '')
                : styles.segment({ class: slotClasses?.segment }),
              !unstyled && getColorClass(item),
              !unstyled && getRingClass(item),
              hoveredId !== null && !isHovered ? 'opacity-50' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={[
              orientation === 'horizontal' ? `width: ${pct}%` : `height: ${pct}%`,
              item.color ? `background-color: ${item.color}` : ''
            ]
              .filter(Boolean)
              .join('; ')}
            aria-label={`${item.label}: ${fmtValue(item.value)} (${fmtPercent(rawPct)})`}
            tabindex="0"
            onmouseenter={() => (hoveredId = k)}
            onmouseleave={() => (hoveredId = null)}
            onfocus={() => (hoveredId = k)}
            onblur={() => (hoveredId = null)}
            onclick={() => handleSelect(item, index)}
            onkeydown={(e) => handleSegmentKeydown(e, item, index)}
          >
            {#if showValues && rawPct >= 8}
              <span
                aria-hidden="true"
                class={[
                  'pointer-events-none truncate px-1.5 text-[10px] font-medium tabular-nums',
                  !unstyled && getOnColorClass(item)
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {fmtValue(item.value)}
              </span>
            {/if}
            <span
              aria-hidden="true"
              class={[
                unstyled
                  ? (slotClasses?.tooltip ?? '')
                  : styles.tooltip({ class: slotClasses?.tooltip }),
                orientation === 'horizontal'
                  ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
                  : 'top-1/2 right-full mr-2 -translate-y-1/2'
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {#if tooltipSnippet}
                {@render tooltipSnippet(item, rawPct)}
              {:else}
                <span
                  class={unstyled
                    ? (slotClasses?.tooltipLabel ?? '')
                    : styles.tooltipLabel({ class: slotClasses?.tooltipLabel })}
                >
                  {item.label}
                </span>
                <span
                  class={[
                    unstyled
                      ? (slotClasses?.tooltipDetail ?? '')
                      : styles.tooltipDetail({ class: slotClasses?.tooltipDetail }),
                    'block'
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {fmtValue(item.value)}
                  {#if showPercentages}
                    · {fmtPercent(rawPct)}{/if}
                </span>
              {/if}
            </span>
          </button>
        {/if}
      {/each}

      {#if restPercent > 0}
        <div
          class={unstyled
            ? (slotClasses?.segmentRest ?? '')
            : styles.segmentRest({ class: slotClasses?.segmentRest })}
          style={orientation === 'horizontal'
            ? `width: ${restPercent}%`
            : `height: ${restPercent}%`}
          aria-hidden="true"
        >
          {#if restPercent >= 5}{fmtPercent(restPercent)}{/if}
        </div>
      {/if}
    </div>

    <!-- Screen-reader table as a backup -->
    <table class="sr-only">
      <caption>{ariaSummary}</caption>
      <thead>
        <tr>
          <th scope="col">{bt('compositionBar.share')}</th>
          <th scope="col">{bt('compositionBar.value')}</th>
          <th scope="col">{bt('compositionBar.percent')}</th>
        </tr>
      </thead>
      <tbody>
        {#each items as item, index (itemKey(item, index))}
          <tr>
            <td>{item.label}</td>
            <td>{fmtValue(item.value)}</td>
            <td>{fmtPercent(rawPercents[index])}</td>
          </tr>
        {/each}
        {#if restValue > 0}
          <tr>
            <td>{resolvedTotalLabel} ({bt('compositionBar.remaining')})</td>
            <td>{fmtValue(restValue)}</td>
            <td>{fmtPercent(restPercent)}</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Legend -->
  {#if showLegend && legendPlacement !== 'none'}
    <ul
      class={unstyled ? (slotClasses?.legend ?? '') : styles.legend({ class: slotClasses?.legend })}
    >
      {#each items as item, index (itemKey(item, index))}
        {@const k = itemKey(item, index)}
        {@const rawPct = rawPercents[index]}
        {@const isHovered = hoveredId === k}
        <li>
          <button
            type="button"
            class={[
              unstyled
                ? (slotClasses?.legendItem ?? '')
                : styles.legendItem({ class: slotClasses?.legendItem }),
              'w-full text-left',
              !unstyled && getRingClass(item),
              isHovered ? 'bg-surface-subtle' : '',
              hoveredId !== null && !isHovered ? 'opacity-60' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={`${item.label}: ${fmtValue(item.value)} (${fmtPercent(rawPct)})`}
            onmouseenter={() => (hoveredId = k)}
            onmouseleave={() => (hoveredId = null)}
            onfocus={() => (hoveredId = k)}
            onblur={() => (hoveredId = null)}
            onclick={() => handleSelect(item, index)}
          >
            {#if legendItemSnippet}
              {@render legendItemSnippet(item, rawPct)}
            {:else}
              <span
                class={[
                  unstyled
                    ? (slotClasses?.legendDot ?? '')
                    : styles.legendDot({ class: slotClasses?.legendDot }),
                  !unstyled && getColorClass(item)
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={item.color ? `background-color: ${item.color}` : ''}
                aria-hidden="true"
              ></span>
              <span
                class={unstyled
                  ? (slotClasses?.legendLabel ?? '')
                  : styles.legendLabel({ class: slotClasses?.legendLabel })}
              >
                {item.label}
              </span>
              <span
                class={unstyled
                  ? (slotClasses?.legendValue ?? '')
                  : styles.legendValue({ class: slotClasses?.legendValue })}
              >
                {fmtValue(item.value)}{#if showPercentages}
                  · {fmtPercent(rawPct)}{/if}
              </span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
