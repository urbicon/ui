<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { BarChart, type BarChartDatum, type ChartSeries } from '@urbicon-ui/blocks';

  const quarterly: BarChartDatum[] = [
    { label: 'Q1', values: [42, 30] },
    { label: 'Q2', values: [55, 38] },
    { label: 'Q3', values: [48, 41] },
    { label: 'Q4', values: [67, 52] }
  ];
  const revenueCost: ChartSeries[] = [{ label: 'Revenue' }, { label: 'Cost' }];

  const visitors: BarChartDatum[] = [
    { label: 'Mon', values: [120] },
    { label: 'Tue', values: [180] },
    { label: 'Wed', values: [150] },
    { label: 'Thu', values: [210] },
    { label: 'Fri', values: [240] }
  ];

  const eur = (v: number) => `€${v}k`;
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Grouped series"
      description="Two series rendered side by side per category — the default when each datum carries more than one value."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <BarChart data={quarterly} series={revenueCost} formatValue={eur} />
      </div>
    </CodeExample>

    <CodeExample
      title="Stacked"
      description="Set `stacked` to stack the series into one bar per category — useful for part-to-whole comparisons over time."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <BarChart stacked data={quarterly} series={revenueCost} formatValue={eur} />
      </div>
    </CodeExample>

    <CodeExample
      title="Single series"
      description="One value per datum renders simple bars. The legend hides automatically with a single series."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-xl">
        <BarChart data={visitors} height={200} />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Custom series colors"
      description="Each series accepts an explicit `color` (any CSS color or design token) to override the cycled categorical palette."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <BarChart
          data={quarterly}
          series={[
            { label: 'Revenue', color: 'var(--color-primary)' },
            { label: 'Cost', color: 'var(--color-warning)' }
          ]}
          formatValue={eur}
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
        The chart SVG carries <code class="text-text-primary">role="img"</code> and a generated
        <code class="text-text-primary">aria-label</code> summarising the category and series count.
        Pass <code class="text-text-primary">ariaLabel</code> to override it with a domain-specific description.
      </p>
    </Note>
    <Note title="Data-table fallback">
      <p>
        A visually hidden (<code class="text-text-primary">sr-only</code>) table mirrors the data —
        one row per category, one column per series — so screen-reader users get the exact values,
        not just the visual summary.
      </p>
    </Note>
    <Note title="Per-bar tooltips">
      <p>
        Each bar includes a native SVG <code class="text-text-primary">&lt;title&gt;</code> ("series —
        category: value"), giving a zero-JavaScript hover tooltip that the browser also exposes to assistive
        tech.
      </p>
    </Note>
  </NoteList>
</Section>
