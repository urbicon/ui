<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { AreaChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: 'AreaChart Component', showToc: true }
  };

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
<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Single area"
      description="A filled region under one series, anchored to the zero baseline — good for cumulative volume at a glance."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart data={single} />
      </div>
    </CodeExample>

    <CodeExample
      title="Stacked"
      description="`stacked` accumulates series into bands, so the top edge reads as the total while each band shows its contribution."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart stacked data={signups} series={channels} />
      </div>
    </CodeExample>

    <CodeExample
      title="Overlaid"
      description="Without `stacked`, series overlay with a translucent fill so you can compare their shapes directly."
      isolate
      previewClass="flex w-full justify-center p-6"
    >
      <div class="w-full max-w-2xl">
        <AreaChart data={signups} series={channels} />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker="02" id="customization" title="Customization">
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
          <code class="text-text-primary">aria-label</code> that also notes when the chart is stacked.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Data-table fallback</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          A visually hidden table mirrors every value per series so the filled regions are never the
          only way to read the data.
        </p>
      </div>
    </div>
  </div>
</Section>
