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
  import { asset, resolve } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'types', title: 'Type Definitions', order: 12 }
  ];

  const typesForTypesReference = componentData.types ?? [];
</script>

<SeoMeta
  title="InfoCard Component"
  description="Memo-style callout card for inline notes and tips in docs content, with intent accent colors and three sizes."
/>

<DocsPageLayout
  title="InfoCard"
  description="Memo-style callout card for inline notes and tips, with intent accent colors and three sizes."
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
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
            'info',
            'primary',
            'secondary',
            'success',
            'warning',
            'danger',
            'neutral',
            'example',
            'playground',
            'api'
          ].map((v) => ({ label: v, value: v })),
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
    <ApiReference props={componentData?.props ?? []} types={typesForTypesReference} />
  </Section>

  <TypesReference types={typesForTypesReference} />

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/info-card/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
