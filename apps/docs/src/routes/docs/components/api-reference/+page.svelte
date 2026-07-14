<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference as ApiReferenceComponent,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './DocsCustom.svelte';
  import { componentData } from './api';
  import { asset, resolve } from '$app/paths';

  const navigation = [
    { id: 'examples', title: 'Examples', order: 1 },
    { id: 'use-cases', title: 'Use Cases', order: 2 },
    { id: 'api', title: 'API Reference', order: 9 },
    { id: 'types', title: 'Type Definitions', order: 12 }
  ];

  const typesForTypesReference = componentData.types ?? [];
</script>

<SeoMeta
  title="ApiReference Component"
  description="Structured API reference table for component docs — prop names, types, defaults, and descriptions with source and required badges."
/>

<DocsPageLayout
  title="ApiReference"
  description="Structured API reference table — renders prop names, types, defaults, and descriptions with source and required badges."
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
>
  <CustomDocs />

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReferenceComponent props={componentData?.props ?? []} types={typesForTypesReference} />
  </Section>

  <TypesReference types={typesForTypesReference} />

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/api-reference/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
