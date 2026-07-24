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
  import { Sparkline } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  const playgroundValues = [4, 6, 5, 8, 7, 10, 9, 12, 11, 14];
</script>

<SeoMeta title="Sparkline Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Sparkline"
  description="Tiny inline trend line — no axes — sized to flow in table cells, cards, or text."
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
      componentName="Sparkline"
      controls={[
        { type: 'boolean', key: 'area', label: 'Area fill', defaultValue: false },
        { type: 'boolean', key: 'showEndPoint', label: 'End point', defaultValue: true },
        {
          type: 'number',
          key: 'width',
          label: 'Width (px)',
          defaultValue: 160,
          min: 48,
          max: 320,
          step: 8
        },
        {
          type: 'number',
          key: 'height',
          label: 'Height (px)',
          defaultValue: 40,
          min: 16,
          max: 96,
          step: 4
        },
        {
          type: 'number',
          key: 'strokeWidth',
          label: 'Stroke',
          defaultValue: 1.5,
          min: 0.5,
          max: 4,
          step: 0.5
        }
      ]}
      values={{ area: false, showEndPoint: true, width: 160, height: 40, strokeWidth: 1.5 }}
    >
      {#snippet children(values)}
        <div class="flex w-full justify-center p-6">
          <Sparkline {...values} data={playgroundValues} />
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
      code={`import { Sparkline } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/sparkline/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
