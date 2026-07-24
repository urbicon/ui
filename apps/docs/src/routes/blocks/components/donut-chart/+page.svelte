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
  import { DonutChart, type DonutDatum } from '@urbicon-ui/blocks';

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

  const playgroundData: DonutDatum[] = [
    { label: 'Direct', value: 45 },
    { label: 'Referral', value: 30 },
    { label: 'Organic', value: 18 },
    { label: 'Social', value: 7 }
  ];
</script>

<SeoMeta title="DonutChart Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="DonutChart"
  description="Donut or pie chart for part-to-whole composition, with an optional center total."
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
      componentName="DonutChart"
      controls={[
        { type: 'boolean', key: 'showTotal', label: 'Show total', defaultValue: true },
        { type: 'boolean', key: 'showLegend', label: 'Show legend', defaultValue: true },
        {
          type: 'number',
          key: 'innerRadiusRatio',
          label: 'Inner radius',
          defaultValue: 0.6,
          min: 0,
          max: 0.9,
          step: 0.05
        },
        {
          type: 'number',
          key: 'padAngle',
          label: 'Pad angle (°)',
          defaultValue: 1,
          min: 0,
          max: 8,
          step: 0.5
        },
        {
          type: 'number',
          key: 'size',
          label: 'Size (px)',
          defaultValue: 220,
          min: 120,
          max: 320,
          step: 10
        }
      ]}
      values={{ showTotal: true, showLegend: true, innerRadiusRatio: 0.6, padAngle: 1, size: 220 }}
    >
      {#snippet children(values)}
        <div class="flex w-full justify-center">
          <DonutChart {...values} data={playgroundData} totalLabel="Visits" />
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
      code={`import { DonutChart } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/donut-chart/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
