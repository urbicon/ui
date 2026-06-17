<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    TableOfContents as Toc,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData } from './api';
  import { asset } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'types', title: 'Type Definitions', order: 12 }
  ];

  const typesForTypesReference = componentData.types ?? [];
</script>

<SeoMeta
  title="TableOfContents Component"
  description="Documentation for the TableOfContents component"
/>

<DocsPageLayout
  title="TableOfContents"
  description="Documentation for the TableOfContents component"
  maxWidth="lg"
  showToc={true}
  {navigation}
>
  <Section id="playground" title="Playground">
    <PlaygroundConfigurator
      componentName="TableOfContents"
      controls={[
        {
          type: 'dropdown',
          key: 'position',
          label: 'Position',
          items: [
            { label: 'left', value: 'left' },
            { label: 'right', value: 'right' }
          ],
          defaultValue: 'right'
        },
        {
          type: 'dropdown',
          key: 'width',
          label: 'Width',
          items: ['sm', 'md', 'lg'].map((v) => ({ label: v, value: v })),
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'trackScroll', label: 'Track Scroll', defaultValue: true }
      ]}
      values={{ position: 'right', width: 'md', trackScroll: true }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <div class="space-y-24">
            <Section id="intro" title="Introduction">Content</Section>
            <Section id="setup" title="Setup">Content</Section>
            <Section id="usage" title="Usage">Content</Section>
          </div>
          <Toc
            position={values.position}
            width={values.width}
            trackScroll={values.trackScroll}
            navigation={[
              { id: 'intro', title: 'Introduction', order: 1 },
              { id: 'setup', title: 'Setup', order: 2 },
              { id: 'usage', title: 'Usage', order: 3 }
            ]}
          />
        </div>
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
      href={asset('/docs/components/table-of-contents/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
