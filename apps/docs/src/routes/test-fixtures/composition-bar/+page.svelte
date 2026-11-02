<script lang="ts">
  import {
    CompositionBar,
    type CompositionBarProps,
    type CompositionItem
  } from '@urbicon-ui/blocks';

  const three: CompositionItem[] = [
    { label: 'Gas', value: 50, intent: 'primary' },
    { label: 'Power', value: 30, intent: 'secondary' },
    { label: 'Maintenance', value: 20, intent: 'success' }
  ];
  const unused: CompositionItem = { label: 'Unused', value: 0, intent: 'danger' };

  // The first and last element the bar renders, which is not always the first
  // and last item: an item worth 0 renders no segment, and a `total` above the
  // sum appends the dashed rest after the last one. The rest prints its percent
  // from 5 % up, so `thin-rest` probes a rest without text. In `lifted-rest`
  // the levy is below the minimum segment width and is lifted to it.
  const PROBES: Array<{
    id: string;
    dir?: 'rtl';
    /** Sits in a consumer element with the unnamed Tailwind class `group`. */
    group?: boolean;
    props: Omit<CompositionBarProps, 'items'> & { items: CompositionItem[] };
  }> = [
    { id: 'horizontal', props: { items: three } },
    { id: 'first-zero', props: { items: [unused, ...three] } },
    { id: 'last-zero', props: { items: [...three, unused] } },
    { id: 'rest', props: { items: three, total: 125 } },
    { id: 'thin-rest', props: { items: three, total: 104 } },
    {
      id: 'lifted-rest',
      props: {
        items: [three[0], three[1], { label: 'Levy', value: 1, intent: 'warning' }],
        total: 125
      }
    },
    { id: 'single', props: { items: [three[0]] } },
    { id: 'only-rest', props: { items: [unused], total: 10 } },
    { id: 'pill', props: { items: three, slotClasses: { bar: 'rounded-full' } } },
    { id: 'small', props: { items: three, size: 'sm' } },
    { id: 'in-group', group: true, props: { items: three } },
    { id: 'vertical', props: { items: three, orientation: 'vertical' } },
    { id: 'vertical-values', props: { items: three, orientation: 'vertical', showValues: true } },
    {
      id: 'vertical-rest',
      props: { items: [unused, ...three], orientation: 'vertical', total: 125 }
    },
    { id: 'rtl', dir: 'rtl', props: { items: [unused, ...three], total: 125 } },
    { id: 'rtl-vertical', dir: 'rtl', props: { items: three, orientation: 'vertical' } },
    {
      id: 'rtl-vertical-thin-rest',
      dir: 'rtl',
      props: { items: three, orientation: 'vertical', total: 104 }
    }
  ];

  /** Given to every bar, so the test reads the minimum segment width in force. */
  const MIN_SEGMENT = 2;

  /** The percent of the bar the rest stands for, from the probe's own numbers. */
  function restShare({ items, total }: { items: CompositionItem[]; total?: number }) {
    const sum = items.reduce((s, item) => s + item.value, 0);
    return total !== undefined && total > sum ? ((total - sum) / total) * 100 : 0;
  }
</script>

<svelte:head>
  <title>CompositionBar Fixture</title>
  <style>
    *,
    *::before,
    *::after {
      /* biome-ignore-start lint/complexity/noImportantStyles: a fixture freezes motion, so it has to beat every transition and animation a utility class sets */
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
      /* biome-ignore-end lint/complexity/noImportantStyles: closes the range above */
    }
  </style>
</svelte:head>

<!-- Room on every side of each bar: a tooltip opens above a horizontal bar and
     beside a vertical one, and the probes measure it inside the viewport. -->
<div class="bg-surface-base flex flex-col gap-6 px-56 py-10" data-testid="composition-bar-fixtures">
  {#each PROBES as probe (probe.id)}
    <div
      data-probe={probe.id}
      data-rest-share={restShare(probe.props)}
      data-min-segment={probe.props.minSegmentPercent ?? MIN_SEGMENT}
      dir={probe.dir}
      class={['w-[28rem] pt-16', probe.group && 'group']}
    >
      <p class="text-text-tertiary mb-2 text-xs">{probe.id}</p>
      <CompositionBar size="lg" minSegmentPercent={MIN_SEGMENT} {...probe.props} />
    </div>
  {/each}
</div>
