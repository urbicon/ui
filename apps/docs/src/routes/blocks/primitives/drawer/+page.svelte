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
  import { Button, Drawer } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  let playgroundOpen = $state(false);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'usage', title: 'When to use', order: 2 },
    { id: 'examples', title: 'Examples', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'stacking', title: 'Stacking & Nested Drawers', order: 5 },
    { id: 'accessibility', title: 'Accessibility', order: 6 },
    { id: 'api', title: 'API Reference', order: 7 },
    { id: 'installation', title: 'Installation', order: 8 }
  ];
</script>

<SeoMeta
  title="Drawer Component"
  description="Slide-in panel overlay from any viewport edge with focus trap, backdrop dismiss, and keyboard support."
/>

<DocsPageLayout
  title="Drawer"
  description="Slide-in panel overlay from any viewport edge with focus trap, backdrop dismiss, and keyboard support."
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
      componentName="Drawer"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'placement',
          label: 'Placement',
          items: [
            { label: 'right', value: 'right' },
            { label: 'left', value: 'left' },
            { label: 'top', value: 'top' },
            { label: 'bottom', value: 'bottom' }
          ],
          defaultValue: 'right'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' },
            { label: 'full', value: 'full' }
          ],
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'hideCloseButton', label: 'Hide Close', defaultValue: false }
      ]}
      values={{
        placement: 'right',
        size: 'md',
        hideCloseButton: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Button onclick={() => (playgroundOpen = true)}>Open Drawer</Button>
        <Drawer
          bind:open={playgroundOpen}
          title="Drawer Preview"
          placement={values.placement}
          size={values.size}
          hideCloseButton={values.hideCloseButton}
        >
          <p>This is the drawer content. Try changing the placement and size controls.</p>
        </Drawer>
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
      code={`import { Drawer } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/drawer/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
