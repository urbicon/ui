<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { LineChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';

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
    { label: 'Mon', values: [120, 80] },
    { label: 'Tue', values: [180, 96] },
    { label: 'Wed', values: [150, 110] },
    { label: 'Thu', values: [210, 130] },
    { label: 'Fri', values: [240, 160] },
    { label: 'Sat', values: [190, 140] },
    { label: 'Sun', values: [160, 120] }
  ];
  const playgroundSeries: ChartSeries[] = [{ label: 'Visitors' }, { label: 'Signups' }];
</script>

<SeoMeta title="LineChart Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="LineChart"
  description="Line chart for trends over an ordered category axis, one path per series."
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
      componentName="LineChart"
      controls={[
        { type: 'boolean', key: 'showPoints', label: 'Show points', defaultValue: true },
        { type: 'boolean', key: 'showLegend', label: 'Show legend', defaultValue: true },
        { type: 'boolean', key: 'showGrid', label: 'Show grid', defaultValue: true },
        { type: 'boolean', key: 'includeZero', label: 'Include zero', defaultValue: false },
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
      values={{
        showPoints: true,
        showLegend: true,
        showGrid: true,
        includeZero: false,
        height: 260
      }}
    >
      {#snippet children(values)}
        <div class="w-full max-w-2xl">
          <LineChart {...values} data={playgroundData} series={playgroundSeries} />
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
      code={`import { LineChart } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/line-chart/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
