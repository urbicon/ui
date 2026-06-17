<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section as SectionComponent,
    TypesReference,
    InfoCard
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData, type ComponentAPIInfo } from './api';
  import { asset } from '$app/paths';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'examples', title: 'Examples', order: 11 },
    { id: 'types', title: 'Type Definitions', order: 12 }
  ];

  const typesForTypesReference =
    (componentData as ComponentAPIInfo & { types?: unknown[] }).types ?? [];
</script>

<SeoMeta title="Section Component" description="Documentation for the Section component" />

<DocsPageLayout
  title="Section"
  description="Documentation for the Section component"
  maxWidth="lg"
  showToc={true}
  {navigation}
>
  <SectionComponent id="playground" title="Playground">
    <PlaygroundConfigurator
      componentName="Section"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Playground Section' },
        {
          type: 'text',
          key: 'subtitle',
          label: 'Subtitle',
          defaultValue: 'Try different options'
        },
        {
          type: 'dropdown',
          key: 'headingLevel',
          label: 'Heading Level',
          items: [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n })),
          defaultValue: 2
        },
        { type: 'checkbox', key: 'centered', label: 'Centered', defaultValue: false },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: ['default', 'hero', 'primary', 'secondary'].map((v) => ({ label: v, value: v })),
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: ['sm', 'md', 'lg', 'xl'].map((v) => ({ label: v, value: v })),
          defaultValue: 'lg'
        },
        { type: 'checkbox', key: 'showBadges', label: 'Show Badges', defaultValue: true }
      ]}
      values={{
        title: 'Playground Section',
        subtitle: 'Try different options',
        headingLevel: 2,
        centered: false,
        intent: 'default',
        size: 'lg',
        showBadges: true
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <SectionComponent
          id="demo"
          title={values.title}
          subtitle={values.subtitle}
          headingLevel={values.headingLevel}
          centered={values.centered}
          intent={values.intent}
          size={values.size}
          badges={values.showBadges
            ? [{ text: 'New', variant: 'soft', intent: 'primary' }]
            : undefined}
        >
          <div class="text-text-secondary text-sm">
            Sections compose docs pages with consistent spacing and headings.
          </div>
          {#snippet footerSnippet()}
            <InfoCard intent="neutral" title="Tip" size="sm"
              >Use intents to visually separate content blocks.</InfoCard
            >
          {/snippet}
        </SectionComponent>
      {/snippet}
    </PlaygroundConfigurator>
  </SectionComponent>

  <CustomDocs />

  <SectionComponent
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} />
  </SectionComponent>

  <TypesReference types={typesForTypesReference} />

  <div class="mt-6 w-full text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/section/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
