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
  import { CompositionBar, type CompositionItem } from '@urbicon-ui/blocks';

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

  const playgroundItems: CompositionItem[] = [
    { label: 'Anteil A', value: 60, intent: 'primary' },
    { label: 'Anteil B', value: 30, intent: 'success' },
    { label: 'Anteil C', value: 10, intent: 'warning' }
  ];
</script>

<SeoMeta title="CompositionBar Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="CompositionBar"
  description="Stacked-Bar mit Legend zur Visualisierung von Aggregat-Kompositionen."
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
      componentName="CompositionBar"
      controls={[
        {
          type: 'dropdown',
          key: 'orientation',
          label: 'Orientation',
          items: [
            { label: 'horizontal', value: 'horizontal' },
            { label: 'vertical', value: 'vertical' }
          ],
          defaultValue: 'horizontal'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'legendPlacement',
          label: 'Legend',
          items: [
            { label: 'top', value: 'top' },
            { label: 'right', value: 'right' },
            { label: 'bottom', value: 'bottom' },
            { label: 'left', value: 'left' },
            { label: 'none', value: 'none' }
          ],
          defaultValue: 'bottom'
        },
        { type: 'boolean', key: 'showLegend', label: 'Show legend', defaultValue: true },
        { type: 'boolean', key: 'showTotal', label: 'Show total', defaultValue: false },
        { type: 'boolean', key: 'showPercentages', label: 'Show percentages', defaultValue: true }
      ]}
      values={{
        orientation: 'horizontal',
        size: 'md',
        legendPlacement: 'bottom',
        showLegend: true,
        showTotal: false,
        showPercentages: true
      }}
    >
      {#snippet children(values)}
        <div
          class="w-full max-w-xl"
          style={values.orientation === 'vertical' ? 'height: 200px' : ''}
        >
          <CompositionBar {...values} items={playgroundItems} />
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
      code={`import { CompositionBar } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/composition-bar/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
