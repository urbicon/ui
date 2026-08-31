<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { AreaChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';

  const single: CartesianDatum[] = [
    { label: 'W1', values: [20] },
    { label: 'W2', values: [32] },
    { label: 'W3', values: [28] },
    { label: 'W4', values: [44] },
    { label: 'W5', values: [52] },
    { label: 'W6', values: [48] }
  ];

  const signups: CartesianDatum[] = [
    { label: 'Jan', values: [4, 6] },
    { label: 'Feb', values: [7, 3] },
    { label: 'Mar', values: [5, 8] },
    { label: 'Apr', values: [9, 5] },
    { label: 'May', values: [12, 7] }
  ];
  const channels: ChartSeries[] = [{ label: 'New' }, { label: 'Returning' }];
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Each datum has a <code class="text-text-primary">label</code> and a
    <code class="text-text-primary">values</code> array, and
    <code class="text-text-primary">values[i]</code> belongs to
    <code class="text-text-primary">series[i]</code>. Pass
    <code class="text-text-primary">series</code> to name and colour the bands and to drive the
    legend; a single value per datum needs no <code class="text-text-primary">series</code>. Add
    <code class="text-text-primary">stacked</code> to sum the bands into a running total.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Single area"
      description="One series, filled down to the zero baseline."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart data={single} />
      </div>
    </CodeExample>

    <CodeExample
      title="Stacked"
      description="`stacked` sums the series so the top edge is the running total."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart stacked data={signups} series={channels} />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Fill opacity + colors"
      description="Tune `fillOpacity` and set per-series colors to match a brand or emphasise one band."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart
          fillOpacity={0.35}
          data={signups}
          series={[
            { label: 'New', color: 'var(--color-primary)' },
            { label: 'Returning', color: 'var(--color-secondary)' }
          ]}
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Band and edge apart"
      description="A series is two paths: `slotClasses.area` reaches the filled band, `slotClasses.areaOutline` its top edge. `mark` reaches both, so a paint written there lands on both."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart
          data={single}
          slotClasses={{ area: 'opacity-60', areaOutline: 'stroke-text-primary stroke-[2px]' }}
        />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note>
      {#snippet titleSnippet()}
        SVG with role="img"
      {/snippet}
      <p>
        The SVG carries <code class="text-text-primary">role="img"</code> with a generated
        <code class="text-text-primary">aria-label</code> that also notes when the chart is stacked.
      </p>
    </Note>
    <Note title="Data-table fallback">
      <p>
        A visually hidden table mirrors every value per series, so screen-reader users read the
        exact values.
      </p>
    </Note>
  </NoteList>
</Section>
