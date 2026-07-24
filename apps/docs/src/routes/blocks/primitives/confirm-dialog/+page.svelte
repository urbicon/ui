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
  import { ConfirmDialog, Button } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  let demoOpen = $state(false);
</script>

<SeoMeta
  title="ConfirmDialog Component"
  description="Pre-configured dialog for confirming a single, often destructive action."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="ConfirmDialog"
  description="Pre-configured dialog for confirming a single, often destructive action. Replaces window.confirm() with a styleable, focus-trapped modal that supports async onConfirm handlers."
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
      componentName="ConfirmDialog"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Delete project?' },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'This cannot be undone.'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'danger', value: 'danger' },
            { label: 'warning', value: 'warning' },
            { label: 'primary', value: 'primary' },
            { label: 'success', value: 'success' },
            { label: 'neutral', value: 'neutral' }
          ],
          defaultValue: 'danger'
        },
        { type: 'text', key: 'confirmLabel', label: 'Confirm Label', defaultValue: 'Delete' },
        { type: 'text', key: 'cancelLabel', label: 'Cancel Label', defaultValue: 'Cancel' }
      ]}
      values={{
        title: 'Delete project?',
        description: 'This cannot be undone.',
        intent: 'danger',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      }}
    >
      {#snippet children(values)}
        <Button intent={values.intent} onclick={() => (demoOpen = true)}>Open dialog</Button>
        <ConfirmDialog
          bind:open={demoOpen}
          title={String(values.title ?? '')}
          description={values.description as string | undefined}
          intent={values.intent}
          confirmLabel={values.confirmLabel as string | undefined}
          cancelLabel={values.cancelLabel as string | undefined}
          onConfirm={() => Promise.resolve()}
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
      code={`import { ConfirmDialog } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/primitives/confirm-dialog/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
