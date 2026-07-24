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
  import { Kbd } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 3 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="Kbd Component"
  description="Render one or more keyboard keys as a compact keycap — the canonical way to show shortcuts like ⌘K or Ctrl + S."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Kbd"
  description="Renders one or more keys as a compact, physical-looking keycap — the canonical way to show shortcuts (⌘K, Ctrl + S) in menus, tooltips, command palettes and docs. Pure display; emits a semantic <kbd> element."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Primitives', href: '/blocks/primitives' }
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
      componentName="Kbd"
      controls={[
        { type: 'text', key: 'keys', label: 'Keys', defaultValue: '⌘K' },
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
        }
      ]}
      values={{
        keys: '⌘K',
        size: 'md'
      }}
    >
      {#snippet children(values)}
        <Kbd keys={typeof values.keys === 'string' ? values.keys : '⌘K'} size={values.size} />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="03"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Kbd } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/primitives/kbd/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
