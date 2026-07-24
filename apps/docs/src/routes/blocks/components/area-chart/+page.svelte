<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { AreaChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  const playgroundData: CartesianDatum[] = [
    { label: 'Jan', values: [4, 6] },
    { label: 'Feb', values: [7, 3] },
    { label: 'Mar', values: [5, 8] },
    { label: 'Apr', values: [9, 5] },
    { label: 'May', values: [12, 7] },
    { label: 'Jun', values: [10, 9] }
  ];
  const playgroundSeries: ChartSeries[] = [{ label: 'New' }, { label: 'Returning' }];
</script>

<SeoMeta title="AreaChart Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="AreaChart"
  description="Area chart for trends with volume emphasis — filled regions, optionally stacked."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="AreaChart"
      controls={[
        { type: 'boolean', key: 'stacked', label: 'Stacked', defaultValue: false },
        { type: 'boolean', key: 'showLegend', label: 'Show legend', defaultValue: true },
        { type: 'boolean', key: 'showGrid', label: 'Show grid', defaultValue: true },
        {
          type: 'number',
          key: 'fillOpacity',
          label: 'Fill opacity',
          defaultValue: 0.2,
          min: 0,
          max: 1,
          step: 0.05
        },
        {
          type: 'number',
          key: 'height',
          label: 'Height (px)',
          defaultValue: 260,
          min: 120,
          max: 480,
          step: 20
        }
      ]}
      values={{ stacked: false, showLegend: true, showGrid: true, fillOpacity: 0.2, height: 260 }}
    >
      {#snippet children(values)}
        <div class="w-full max-w-2xl">
          <AreaChart {...values} data={playgroundData} series={playgroundSeries} />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { AreaChart } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/area-chart/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
