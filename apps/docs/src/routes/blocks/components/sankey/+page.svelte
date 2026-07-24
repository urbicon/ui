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
  import { Sankey, type SankeyNode, type SankeyLink } from '@urbicon-ui/blocks';

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

  const playgroundNodes: SankeyNode[] = [
    { id: 'a', label: 'Source A', intent: 'primary' },
    { id: 'b', label: 'Source B', intent: 'secondary' },
    { id: 'mid', label: 'Pot', intent: 'neutral' },
    { id: 'x', label: 'Sink X', intent: 'success' },
    { id: 'y', label: 'Sink Y', intent: 'warning' }
  ];
  const playgroundLinks: SankeyLink[] = [
    { source: 'a', target: 'mid', value: 60 },
    { source: 'b', target: 'mid', value: 40 },
    { source: 'mid', target: 'x', value: 70 },
    { source: 'mid', target: 'y', value: 30 }
  ];
</script>

<SeoMeta title="Sankey Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Sankey"
  description=""
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
      componentName="Sankey"
      controls={[
        {
          type: 'dropdown',
          key: 'nodeAlign',
          label: 'Node align',
          items: [
            { label: 'justify', value: 'justify' },
            { label: 'left', value: 'left' },
            { label: 'right', value: 'right' },
            { label: 'center', value: 'center' }
          ],
          defaultValue: 'justify'
        },
        {
          type: 'number',
          key: 'height',
          label: 'Height (px)',
          defaultValue: 320,
          min: 120,
          max: 800,
          step: 20
        },
        {
          type: 'number',
          key: 'nodeWidth',
          label: 'Node width',
          defaultValue: 24,
          min: 4,
          max: 80,
          step: 2
        },
        {
          type: 'number',
          key: 'nodePadding',
          label: 'Node padding',
          defaultValue: 16,
          min: 0,
          max: 40,
          step: 2
        }
      ]}
      values={{
        nodeAlign: 'justify',
        height: 320,
        nodeWidth: 24,
        nodePadding: 16
      }}
    >
      {#snippet children(values)}
        <div class="w-full">
          <Sankey {...values} nodes={playgroundNodes} links={playgroundLinks} />
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
      code={`import { Sankey } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/sankey/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
