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
  import { Alert } from '@urbicon-ui/blocks';
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
  title="Alert Component"
  description="Persistent inline notifications for status, warnings, errors, and informational messages with icons, actions, and dismissal."
/>

<DocsPageLayout
  title="Alert"
  description="Persistent inline notifications for status, warnings, errors, and informational messages with icons, actions, and dismissal."
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
      componentName="Alert"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Heads up!' },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'This is an alert with important information.'
        },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'soft', value: 'soft' },
            { label: 'inline', value: 'inline' },
            { label: 'filled', value: 'filled' }
          ],
          defaultValue: 'soft'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'primary', value: 'primary' },
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
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'dismissible', label: 'Dismissible', defaultValue: false }
      ]}
      values={{
        title: 'Heads up!',
        description: 'This is an alert with important information.',
        variant: 'soft',
        intent: 'primary',
        size: 'md',
        dismissible: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const { title, description, ...props } = values}
        <div class="w-full max-w-lg">
          <Alert {...props} {title}>
            {description}
          </Alert>
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
      code={`import { Alert } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/alert/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
