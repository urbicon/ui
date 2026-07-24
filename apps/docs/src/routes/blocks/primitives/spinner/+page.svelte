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
  import { Spinner } from '@urbicon-ui/blocks';
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
  title="Spinner Component"
  description="Loading indicators with multiple animation styles, semantic colors, and configurable speed."
/>

<DocsPageLayout
  title="Spinner"
  description="Loading indicators with multiple animation styles, semantic colors, and configurable speed."
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
      componentName="Spinner"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'text',
          key: 'label',
          label: 'Label',
          defaultValue: 'Loading...'
        },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'ring', value: 'ring' },
            { label: 'pulse', value: 'pulse' },
            { label: 'dots', value: 'dots' },
            { label: 'bars', value: 'bars' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' },
            { label: 'neutral', value: 'neutral' }
          ],
          defaultValue: 'primary'
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
          key: 'speed',
          label: 'Speed',
          items: [
            { label: 'slow', value: 'slow' },
            { label: 'normal', value: 'normal' },
            { label: 'fast', value: 'fast' }
          ],
          defaultValue: 'normal'
        },
        { type: 'checkbox', key: 'visible', label: 'Visible', defaultValue: true }
      ]}
      values={{
        label: 'Loading...',
        variant: 'default',
        intent: 'primary',
        size: 'md',
        speed: 'normal',
        visible: true
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const { label, ...props } = values}
        <Spinner {...props} label={label || 'Loading...'} />
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
      code={`import { Spinner } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/spinner/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
