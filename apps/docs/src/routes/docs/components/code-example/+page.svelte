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
  description="Documentation for the CodeExample component with 9 properties and 0 variants"
/>

<DocsPageLayout
  title="CodeExample"
  description="Documentation for the CodeExample component"
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
        { type: 'text', key: 'code', label: 'Code', defaultValue: '<button>Click</button>' },
        { type: 'text', key: 'language', label: 'Language', defaultValue: 'html' },
        { type: 'checkbox', key: 'isolate', label: 'Isolate', defaultValue: false }
      ]}
      values={{
        title: 'Basic Example',
        description: 'Short explanation',
        code: '<button>Click</button>',
        language: 'html',
        isolate: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <CodeExampleComponent
          title={values.title}
          description={values.description}
          code={values.code}
          language={values.language}
          isolate={values.isolate}
        >
          <button class="rounded border px-3 py-1 text-sm">Click</button>
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
      <InfoCard intent="info" title="Inherited Properties">
        <p>This component inherits properties from the following interfaces:</p>
        <ul class="mt-2 space-y-1">
          <li><strong>CodeExampleVariantProps</strong> - 1 properties</li>
        </ul>
      </InfoCard>

      <InfoCard intent="success" title="Accessibility">
        <p>This component supports the following accessibility features:</p>
        <ul class="mt-2 space-y-1">
          <li>
            <code>...CodeExampleVariantProps</code> - Styling variants from CodeExampleVariantProps
          </li>
        </ul>
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
      class="text-sm text-slate-500 underline hover:text-slate-700"
      href={asset('/docs/components/code-example/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
