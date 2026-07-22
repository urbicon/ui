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
  import { Toggle } from '@urbicon-ui/blocks';
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
    { id: 'mint', title: 'Micro-Interactions', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];
</script>

<SeoMeta
  title="Toggle Component"
  description="Accessible on/off switches with labels, sizes, intent-based styling, and micro-interactions."
/>

<DocsPageLayout
  title="Toggle"
  description="Accessible on/off switches with labels, sizes, intent-based styling, and micro-interactions."
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
      componentName="Toggle"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Enable notifications' },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'dot', value: 'dot' }
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
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'mint',
          label: 'Mint',
          items: [
            { label: '(none)', value: 'none' },
            { label: 'scale', value: 'scale' },
            { label: 'glow', value: 'glow' },
            { label: 'bounce', value: 'bounce' }
          ],
          defaultValue: 'none'
        },
        { type: 'checkbox', key: 'checked', label: 'Checked', defaultValue: true },
        { type: 'checkbox', key: 'withBorder', label: 'With Border', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        {
          type: 'text',
          key: 'helper',
          label: 'Helper Text',
          defaultValue: 'Push updates instantly'
        }
      ]}
      values={{
        label: 'Enable notifications',
        variant: 'default',
        intent: 'primary',
        size: 'md',
        mint: 'none',
        checked: true,
        withBorder: false,
        disabled: false,
        helper: 'Push updates instantly'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Toggle {...values} />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Toggle } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/toggle/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
