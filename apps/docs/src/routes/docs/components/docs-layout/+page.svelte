<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData } from './api';
  import { asset } from '$app/paths';

  const navigation = [
    { id: 'examples', title: 'Examples', order: 1 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'types', title: 'Type Definitions', order: 12 }
  ];

  const typesForTypesReference = componentData.types ?? [];
</script>

<SeoMeta
  title="DocsLayout Component"
  description="Documentation page layout with header hero, sticky table of contents, scrollspy, and a responsive content column."
/>

<DocsPageLayout
  title="DocsLayout"
  description="Documentation page layout with header hero, sticky table of contents, scrollspy, and a responsive content column."
  maxWidth="lg"
  showToc={true}
  {navigation}
>
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
