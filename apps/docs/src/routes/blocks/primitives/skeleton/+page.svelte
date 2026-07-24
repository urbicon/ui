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
  import { Skeleton } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="Skeleton Component"
  description="Placeholder loading animations that mimic content layout to reduce perceived loading time."
/>

<DocsPageLayout
  title="Skeleton"
  description="Placeholder loading animations that mimic content layout to reduce perceived loading time."
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
      componentName="Skeleton"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'text', value: 'text' },
            { label: 'circular', value: 'circular' },
            { label: 'rectangular', value: 'rectangular' },
            { label: 'rounded', value: 'rounded' }
          ],
          defaultValue: 'text'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'xs', value: 'xs' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'animation',
          label: 'Animation',
          items: [
            { label: 'pulse', value: 'pulse' },
            { label: 'wave', value: 'wave' },
            { label: 'none', value: 'none' }
          ],
          defaultValue: 'pulse'
        },
        { type: 'text', key: 'width', label: 'Width', defaultValue: '' },
        { type: 'text', key: 'height', label: 'Height', defaultValue: '' },
        {
          type: 'dropdown',
          key: 'count',
          label: 'Count',
          items: [
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '5', value: '5' }
          ],
          defaultValue: '1'
        }
      ]}
      values={{
        variant: 'text',
        size: 'md',
        animation: 'pulse',
        width: '',
        height: '',
        count: '1'
      }}
      showHeader={false}
    >
      {#snippet children(values: Record<string, unknown>)}
        {@const { width, height, count, ...props } = values}
        <Skeleton
          {...props}
          width={(width as string | undefined) || undefined}
          height={(height as string | undefined) || undefined}
          count={Number(count) || 1}
        />
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
      code={`import { Skeleton } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/skeleton/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
