<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    InfoCard,
    CodeExample as CodeExampleComponent,
    TypesReference
  } from '@urbicon-ui/docs';
  import { Button } from '@urbicon-ui/blocks';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData } from './api';
  import { asset } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'usage', title: 'Usage Notes', order: 8 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'types', title: 'Type Definitions', order: 10 },
    { id: 'examples', title: 'Examples', order: 11 },
    { id: 'use-cases', title: 'Use Cases', order: 12 }
  ];

  const typesForTypesReference = componentData.types ?? [];
</script>

<SeoMeta
  title="CodeExample Component"
  description="Code example card with live preview, syntax highlighting, copy-to-clipboard, and a collapsible code panel."
/>

<DocsPageLayout
  title="CodeExample"
  description="Code example card with live preview, syntax highlighting, copy-to-clipboard, and a collapsible code panel."
  maxWidth="lg"
  showToc={true}
  {navigation}
>
  <Section id="playground" title="Playground">
    <PlaygroundConfigurator
      componentName="CodeExample"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Basic Example' },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'Short explanation'
        },
        { type: 'text', key: 'code', label: 'Code', defaultValue: '<Button>Click</Button>' },
        { type: 'text', key: 'language', label: 'Language', defaultValue: 'svelte' },
        { type: 'checkbox', key: 'preview', label: 'Show Preview', defaultValue: true }
      ]}
      values={{
        title: 'Basic Example',
        description: 'Short explanation',
        code: '<Button>Click</Button>',
        language: 'svelte',
        preview: true
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <CodeExampleComponent
          title={values.title}
          description={values.description}
          code={values.code}
          language={values.language}
          preview={values.preview}
        >
          <Button>Click</Button>
        </CodeExampleComponent>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <!-- Usage Notes Section -->
  <Section
    id="usage"
    title="Usage Notes"
    subtitle="Best practices and important considerations"
    intent="default"
  >
    <div class="space-y-6">
      <InfoCard intent="info" title="Code is a prop, not the children">
        <p>
          The rendered snippet comes from the <code>code</code> prop — children are only the live
          preview. Either pass <code>code</code> explicitly, or set <code>isolate</code> so the
          <code>codeExamplePlugin</code> Vite plugin (from <code>@urbicon-ui/docs/vite</code>)
          extracts the children markup as <code>code</code> at build time. Without either, a warning placeholder
          renders instead of the code panel.
        </p>
      </InfoCard>

      <InfoCard intent="neutral" title="Collapsing follows the page toggle">
        <p>
          The code panel follows the page-wide code-visibility toggle provided by
          <code>DocsLayout</code>. Use <code>defaultExpanded</code> to override the initial state for
          a single example — readers can still toggle it locally.
        </p>
      </InfoCard>
    </div>
  </Section>

  <!-- API Reference Section -->
  <Section
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <!-- Type Definitions -->
  <TypesReference types={typesForTypesReference} />

  <CustomDocs />

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/code-example/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
