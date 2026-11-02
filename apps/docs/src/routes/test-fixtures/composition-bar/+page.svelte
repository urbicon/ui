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
  // sum appends the dashed rest after the last one.
  const PROBES: Array<{
    id: string;
    dir?: 'rtl';
    props: Omit<CompositionBarProps, 'items'> & { items: CompositionItem[] };
  }> = [
    { id: 'horizontal', props: { items: three } },
    { id: 'first-zero', props: { items: [unused, ...three] } },
    { id: 'last-zero', props: { items: [...three, unused] } },
    { id: 'rest', props: { items: three, total: 125 } },
    { id: 'single', props: { items: [three[0]] } },
    { id: 'only-rest', props: { items: [unused], total: 10 } },
    { id: 'pill', props: { items: three, slotClasses: { bar: 'rounded-full' } } },
    { id: 'small', props: { items: three, size: 'sm' } },
    { id: 'vertical', props: { items: three, orientation: 'vertical' } },
    {
      id: 'vertical-rest',
      props: { items: [unused, ...three], orientation: 'vertical', total: 125 }
    },
    { id: 'rtl', dir: 'rtl', props: { items: [unused, ...three], total: 125 } },
    { id: 'rtl-vertical', dir: 'rtl', props: { items: three, orientation: 'vertical' } }
  ];
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
    <div data-probe={probe.id} dir={probe.dir} class="w-[28rem] pt-16">
      <p class="text-text-tertiary mb-2 text-xs">{probe.id}</p>
      <CompositionBar size="lg" {...probe.props} />
    </div>
  {/each}
</div>
