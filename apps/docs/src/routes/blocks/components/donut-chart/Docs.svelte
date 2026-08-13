<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { DonutChart, type DonutDatum } from '@urbicon-ui/blocks';

  const sources: DonutDatum[] = [
    { label: 'Direct', value: 45 },
    { label: 'Referral', value: 30 },
    { label: 'Organic', value: 18 },
    { label: 'Social', value: 7 }
  ];

  const budget: DonutDatum[] = [
    { label: 'Rent', value: 1200 },
    { label: 'Food', value: 600 },
    { label: 'Transport', value: 300 },
    { label: 'Savings', value: 500 }
  ];

  const eur = (v: number) => `€${v.toLocaleString('en-US')}`;
</script>

<!-- ─── Examples ─── -->
<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Each <code class="text-text-primary">DonutDatum</code> is a
    <code class="text-text-primary">label</code> and a <code class="text-text-primary">value</code>,
    and <code class="text-text-primary">data</code> is the only required prop. Slices are sized by
    value and coloured from the palette unless you set a slice
    <code class="text-text-primary">color</code>.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Donut with center total"
      description="`showTotal` prints the summed value in the hole; `totalLabel` captions it."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <DonutChart data={sources} showTotal totalLabel="Visits" />
    </CodeExample>

    <CodeExample
      title="Pie"
      description="Set `innerRadiusRatio` to 0 for a solid pie when the hole isn't needed."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <DonutChart innerRadiusRatio={0} data={sources} />
    </CodeExample>

    <CodeExample
      title="Formatted values"
      description="`formatValue` controls the center total, the per-slice tooltips, and the data-table fallback."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <DonutChart data={budget} formatValue={eur} showTotal totalLabel="Monthly" padAngle={1.5} />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Custom slice colors"
      description="Each slice accepts an explicit `color`; omitted slices fall back to the categorical palette."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <DonutChart
        showTotal
        data={[
          { label: 'Done', value: 72, color: 'var(--color-success)' },
          { label: 'In progress', value: 20, color: 'var(--color-primary)' },
          { label: 'Blocked', value: 8, color: 'var(--color-danger)' }
        ]}
      />
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
        <code class="text-text-primary">aria-label</code> noting the segment count and total.
      </p>
    </Note>
    <Note title="Data-table fallback">
      <p>
        A visually hidden table lists each segment with its value and computed share, so the
        composition is fully available to screen readers.
      </p>
    </Note>
    <Note title="Per-segment tooltips">
      <p>
        Each arc includes a native <code class="text-text-primary">&lt;title&gt;</code> with its label,
        value, and percentage share.
      </p>
    </Note>
  </NoteList>
</Section>
