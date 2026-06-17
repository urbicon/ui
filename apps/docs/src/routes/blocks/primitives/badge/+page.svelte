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
  import { Badge } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

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
  title="Badge Component"
  description="Compact labels for status, categories, and counts with multiple visual styles."
/>

<DocsPageLayout
  title="Badge"
  description="Compact labels for status, categories, and counts with multiple visual styles."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Badge"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'New' },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'filled', value: 'filled' },
            { label: 'outlined', value: 'outlined' },
            { label: 'soft', value: 'soft' },
            { label: 'dot', value: 'dot' }
          ],
          defaultValue: 'filled'
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
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'tier',
          label: 'Tier',
          items: [
            { label: 'commit (pill)', value: 'commit' },
            { label: 'modify (soft)', value: 'modify' }
          ],
          defaultValue: 'commit'
        },
        { type: 'checkbox', key: 'counter', label: 'Counter', defaultValue: false },
        { type: 'checkbox', key: 'pulse', label: 'Pulse', defaultValue: false },
        { type: 'checkbox', key: 'removable', label: 'Removable', defaultValue: false },
        { type: 'checkbox', key: 'interactive', label: 'Interactive', defaultValue: false },
        { type: 'checkbox', key: 'border', label: 'Border', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        label: 'New',
        variant: 'filled',
        intent: 'primary',
        size: 'md',
        tier: 'commit',
        counter: false,
        pulse: false,
        removable: false,
        interactive: false,
        border: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const { label, ...rest } = values}
        {#if rest.variant === 'dot'}
          {@const { counter: _c, removable: _r, interactive: _i, ...dotProps } = rest}
          <Badge {...dotProps} />
        {:else}
          <Badge {...rest}>{label}</Badge>
        {/if}
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
      code={`import { Badge } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/badge/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
