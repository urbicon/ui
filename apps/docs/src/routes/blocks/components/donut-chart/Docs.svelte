<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
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
<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Donut with center total"
      description="`showTotal` prints the summed value in the hole; `totalLabel` captions it. Ideal for a KPI surrounded by its breakdown."
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
<Section marker="02" id="customization" title="Customization">
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
<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">SVG with role="img"</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The SVG carries <code class="text-text-primary">role="img"</code> with a generated
          <code class="text-text-primary">aria-label</code> noting the segment count and total.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Data-table fallback</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          A visually hidden table lists each segment with its value and computed share, so the
          composition is fully available to screen readers.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Per-segment tooltips</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Each arc includes a native <code class="text-text-primary">&lt;title&gt;</code> with its label,
          value, and percentage share.
        </p>
      </div>
    </div>
  </div>
</Section>
