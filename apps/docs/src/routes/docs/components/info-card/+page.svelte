<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    InfoCard as InfoCardComponent,
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

<SeoMeta
  title="InfoCard Component"
  description="Documentation for the InfoCard component with 5 properties and 0 variants"
/>

<DocsPageLayout
  title="InfoCard"
  description="Documentation for the InfoCard component"
  maxWidth="lg"
  showToc={true}
  {navigation}
>
  <Section id="playground" title="Playground">
    <PlaygroundConfigurator
      componentName="InfoCard"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Success' },
        {
          type: 'text',
          key: 'children',
          label: 'Content',
          defaultValue: 'All systems operational'
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
          defaultValue: 'success'
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
          defaultValue: 'lg'
        }
      ]}
      values={{
        title: 'Success',
        children: 'All systems operational',
        intent: 'success',
        size: 'lg'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <InfoCardComponent intent={values.intent} size={values.size} title={values.title}
          >{values.children}</InfoCardComponent
        >
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
      class="text-sm text-slate-500 underline hover:text-slate-700"
      href={asset('/docs/components/info-card/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
