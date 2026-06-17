<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, InfoCard } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: true, order: 3 },
      examples: false,
      api: { enabled: true, order: 9, groupBy: 'category', showInheritance: true },
      usage: false
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'variants', 'api'] },
    meta: { title: 'InfoCard Component', showToc: true }
  };
</script>

<Section id="examples" title="Examples" subtitle="Context information blocks">
  <CodeExample title="Basic Usage">
    <InfoCard intent="info" title="Note">Use InfoCard to display tips.</InfoCard>
  </CodeExample>
</Section>
