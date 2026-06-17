<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData } from './api';
  import { asset } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'examples', title: 'Examples', order: 11 },
    { id: 'types', title: 'Type Definitions', order: 12 }
  ];

  const typesForTypesReference = componentData.types ?? [];
</script>

<SeoMeta title="DocsLayout Component" description="Documentation for the DocsLayout component" />

<DocsPageLayout
  title="DocsLayout"
  description="Documentation for the DocsLayout component"
  maxWidth="lg"
  showToc={true}
  {navigation}
>
  <Section id="playground" title="Playground">
    <PlaygroundConfigurator
      componentName="DocsLayout"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Demo Page' },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'Short page description'
        },
        { type: 'checkbox', key: 'showToc', label: 'Show ToC', defaultValue: true },
        {
          type: 'dropdown',
          key: 'maxWidth',
          label: 'Max Width',
          items: ['md', 'lg', 'xl', '2xl'].map((v) => ({ label: v, value: v })),
          defaultValue: 'lg'
        }
      ]}
      values={{
        title: 'Demo Page',
        description: 'Short page description',
        showToc: true,
        maxWidth: 'lg'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <DocsPageLayout
          title={values.title}
          description={values.description}
          showToc={values.showToc}
          maxWidth={values.maxWidth}
          navigation={[
            { id: 'a', title: 'A', order: 1 },
            { id: 'b', title: 'B', order: 2 }
          ]}
        >
          <Section id="a" title="Section A" intent="primary">Content A</Section>
          <Section id="b" title="Section B" intent="secondary">Content B</Section>
        </DocsPageLayout>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <TypesReference types={typesForTypesReference} />

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/docs-layout/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
