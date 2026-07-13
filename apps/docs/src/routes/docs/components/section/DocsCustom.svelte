<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, InfoCard } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: true, order: 3 },
      examples: { enabled: true, order: 2 },
      api: { enabled: true, order: 9, showInheritance: true },
      usage: { enabled: true, order: 8 }
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'variants', 'api'] },
    meta: { title: 'Section Component', showToc: true }
  };
</script>

<Section id="examples" title="Examples" subtitle="Structure page content">
  <CodeExample title="Basic Usage" isolate>
    <Section id="demo" title="Title" subtitle="Subtitle">Content</Section>
  </CodeExample>
</Section>

<Section id="use-cases" title="Use Cases" subtitle="Compose documentation pages">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <InfoCard title="Hero Sections">Intro blocks with titles and badges</InfoCard>
    <InfoCard title="Content Sections">Logical grouping of docs content</InfoCard>
    <InfoCard title="Meta Sections">Notes, tips and guidance</InfoCard>
  </div>
</Section>
