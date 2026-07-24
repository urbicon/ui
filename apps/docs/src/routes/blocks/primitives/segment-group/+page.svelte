<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'mints', title: 'Micro-Interactions', order: 3 },
    { id: 'comparison', title: 'Choosing the Right Component', order: 4 },
    { id: 'customization', title: 'Customization', order: 5 },
    { id: 'accessibility', title: 'Accessibility', order: 6 },
    { id: 'api', title: 'API Reference', order: 7 },
    { id: 'installation', title: 'Installation', order: 8 }
  ];
</script>

<SeoMeta
  title="Segment Group Component"
  description="Segment control with an animated sliding indicator for single selection; collapses to a vertical stack when its row can't fit."
/>

<DocsPageLayout
  title="Segment Group"
  description="Segment control with an animated sliding indicator for single selection; collapses to a vertical stack when its row can't fit."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="SegmentGroup"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'text', value: 'text' }
          ],
          defaultValue: 'default'
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
          key: 'mint',
          label: 'Mint',
          items: [
            { label: 'none', value: 'none' },
            { label: 'scale', value: 'scale' },
            { label: 'glow', value: 'glow' },
            { label: 'pulse', value: 'pulse' },
            { label: 'wiggle', value: 'wiggle' }
          ],
          defaultValue: 'none'
        },
        { type: 'checkbox', key: 'fullWidth', label: 'Full Width', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        variant: 'default',
        size: 'md',
        mint: 'none',
        fullWidth: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <SegmentGroup {...values} value="list" ariaLabel="View mode">
          <SegmentItem value="list">List</SegmentItem>
          <SegmentItem value="grid">Grid</SegmentItem>
          <SegmentItem value="board">Board</SegmentItem>
        </SegmentGroup>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="06"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="07" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/segment-group/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
