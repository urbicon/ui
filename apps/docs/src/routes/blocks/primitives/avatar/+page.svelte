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
  import { Avatar } from '@urbicon-ui/blocks';
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
  title="Avatar Component"
  description="User profile images with fallback initials, status indicators, and configurable shapes."
/>

<DocsPageLayout
  title="Avatar"
  description="User profile images with fallback initials, status indicators, and configurable shapes."
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
      componentName="Avatar"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'name', label: 'Name', defaultValue: 'Jane Doe' },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Shape',
          items: [
            { label: 'circle', value: 'circle' },
            { label: 'rounded', value: 'rounded' },
            { label: 'square', value: 'square' }
          ],
          defaultValue: 'circle'
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
            { label: 'xl', value: 'xl' },
            { label: '2xl', value: '2xl' }
          ],
          defaultValue: 'lg'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'neutral', value: 'neutral' },
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' }
          ],
          defaultValue: 'neutral'
        },
        {
          type: 'dropdown',
          key: 'status',
          label: 'Status',
          items: [
            { label: '(none)', value: '' },
            { label: 'online', value: 'online' },
            { label: 'offline', value: 'offline' },
            { label: 'busy', value: 'busy' },
            { label: 'away', value: 'away' }
          ],
          defaultValue: ''
        },
        {
          type: 'dropdown',
          key: 'statusPosition',
          label: 'Status Position',
          items: [
            { label: 'bottom-right', value: 'bottom-right' },
            { label: 'top-right', value: 'top-right' },
            { label: 'bottom-left', value: 'bottom-left' },
            { label: 'top-left', value: 'top-left' }
          ],
          defaultValue: 'bottom-right'
        },
        { type: 'checkbox', key: 'ring', label: 'Ring', defaultValue: false },
        {
          type: 'dropdown',
          key: 'ringIntent',
          label: 'Ring Intent',
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
        { type: 'checkbox', key: 'randomColor', label: 'Random Color', defaultValue: false },
        { type: 'checkbox', key: 'interactive', label: 'Interactive', defaultValue: false }
      ]}
      values={{
        name: 'Jane Doe',
        variant: 'circle',
        size: 'lg',
        intent: 'neutral',
        status: '',
        statusPosition: 'bottom-right',
        ring: false,
        ringIntent: 'primary',
        randomColor: false,
        interactive: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Avatar {...values} status={values.status || undefined} />
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
      code={`import { Avatar } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/avatar/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
