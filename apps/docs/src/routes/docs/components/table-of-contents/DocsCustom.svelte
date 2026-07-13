<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, TableOfContents } from '@urbicon-ui/docs';

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
    meta: { title: 'TableOfContents Component', showToc: true }
  };
</script>

<Section id="examples" title="Examples" subtitle="Page navigation">
  <CodeExample title="Basic Usage" isolate>
    <TableOfContents
      navigation={[
        { id: 'overview', title: 'Overview' },
        { id: 'api', title: 'API' }
      ]}
    />
  </CodeExample>
</Section>
