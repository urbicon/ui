<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, DocsLayout } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: false },
      examples: false,
      api: { enabled: true, order: 9, groupBy: 'category', showInheritance: true },
      usage: false
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'api'] },
    meta: { title: 'DocsLayout Component', showToc: true }
  };
</script>

<Section id="examples" title="Examples" subtitle="Basic page layout">
  <CodeExample title="Basic Usage">
    <DocsLayout title="Title" description="Subtitle">
      <p>Content</p>
    </DocsLayout>
  </CodeExample>
</Section>
