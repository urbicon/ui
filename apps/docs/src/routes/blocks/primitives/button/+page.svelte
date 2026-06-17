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
  import { Button } from '@urbicon-ui/blocks';
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
    { id: 'mint', title: 'Mint Micro-Interactions', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 7 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="Button Component"
  description="Versatile, accessible buttons with variants, loading states, and micro-interactions."
/>

<DocsPageLayout
  title="Button"
  description="Versatile, accessible buttons with variants, loading states, and micro-interactions."
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
      componentName="Button"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'filled', value: 'filled' },
            { label: 'outlined', value: 'outlined' },
            { label: 'ghost', value: 'ghost' },
            { label: 'text', value: 'text' }
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
            { label: '2xs', value: '2xs' },
            { label: 'xs', value: 'xs' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
          ],
          defaultValue: 'lg'
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
        {
          type: 'dropdown',
          key: 'mint',
          label: 'Mint',
          items: [
            { label: 'none', value: 'none' },
            { label: 'scale', value: 'scale' },
            { label: 'ripple', value: 'ripple' },
            { label: 'bounce', value: 'bounce' },
            { label: 'glow', value: 'glow' }
          ],
          defaultValue: 'scale'
        },
        {
          type: 'dropdown',
          key: 'loadingPlacement',
          label: 'Loading Placement',
          items: [
            { label: 'overlay', value: 'overlay' },
            { label: 'start', value: 'start' },
            { label: 'end', value: 'end' }
          ],
          defaultValue: 'overlay'
        },
        { type: 'checkbox', key: 'loading', label: 'Loading', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        { type: 'text', key: 'children', label: 'Label', defaultValue: 'Get Started' }
      ]}
      values={{
        variant: 'filled',
        intent: 'primary',
        size: 'lg',
        tier: 'commit',
        mint: 'scale',
        loading: false,
        loadingPlacement: 'overlay',
        disabled: false,
        children: 'Get Started'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Button {...values}>{values.children}</Button>
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
      code={`import { Button } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/button/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
