<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, InfoCard } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: false },
      examples: { enabled: true, order: 3 },
      api: { enabled: true, order: 9, groupBy: 'category', showInheritance: true },
      usage: { enabled: true, order: 8 }
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'api'] },
    meta: { title: 'CodeExample Component', showToc: true }
  };
</script>

<Section id="examples" title="Examples" subtitle="Wrap content with preview and code">
  <CodeExample title="Basic Usage">
    <button class="rounded border px-3 py-1">Click me</button>
  </CodeExample>
</Section>

<Section id="use-cases" title="Use Cases" subtitle="When to use CodeExample">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <InfoCard title="Documentation">Code snippets in docs</InfoCard>
    <InfoCard title="Tutorials">Step-by-step guides</InfoCard>
    <InfoCard title="Blog Posts">Formatted code blocks</InfoCard>
  </div>
</Section>
