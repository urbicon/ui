<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { LineChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';

  const single: CartesianDatum[] = [
    { label: 'Jan', values: [12] },
    { label: 'Feb', values: [19] },
    { label: 'Mar', values: [9] },
    { label: 'Apr', values: [22] },
    { label: 'May', values: [27] },
    { label: 'Jun', values: [24] }
  ];

  const weekly: CartesianDatum[] = [
    { label: 'Mon', values: [120, 80] },
    { label: 'Tue', values: [180, 96] },
    { label: 'Wed', values: [150, 110] },
    { label: 'Thu', values: [210, 130] },
    { label: 'Fri', values: [240, 160] }
  ];
  const series: ChartSeries[] = [{ label: 'Visitors' }, { label: 'Signups' }];
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Single trend"
      description="One series over an ordered axis. Points mark each value; the axis frames the data range."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <LineChart data={single} />
      </div>
    </CodeExample>

    <CodeExample
      title="Multiple series"
      description="Each value column becomes its own line on the categorical palette; the legend appears automatically."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <LineChart data={weekly} {series} />
      </div>
    </CodeExample>

    <CodeExample
      title="Zero baseline"
      description="By default the value axis frames the data to emphasise variation. Set `includeZero` to anchor it at zero when absolute magnitude matters."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <LineChart includeZero showPoints={false} data={single} />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Custom colors"
      description="Override per-series colors with any CSS color or design token."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <LineChart
          data={weekly}
          series={[
            { label: 'Visitors', color: 'var(--color-primary)' },
            { label: 'Signups', color: 'var(--color-success)' }
          ]}
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
        <code class="text-text-primary">aria-label</code>; pass
        <code class="text-text-primary">ariaLabel</code> to describe the trend in domain terms.
      </p>
    </Note>
    <Note title="Data-table fallback">
      <p>
        A visually hidden table mirrors every point per series, so screen-reader users read exact
        values rather than an inaccessible path.
      </p>
    </Note>
    <Note title="Per-point tooltips">
      <p>
        Each point dot includes a native <code class="text-text-primary">&lt;title&gt;</code> with its
        series, category, and value.
      </p>
    </Note>
  </NoteList>
</Section>
