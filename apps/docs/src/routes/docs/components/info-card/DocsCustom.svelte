<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, InfoCard } from '@urbicon-ui/docs';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: true, order: 3 },
      examples: false,
      api: { enabled: true, order: 9, showInheritance: true },
      usage: false
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'variants', 'api'] },
    meta: { title: 'InfoCard Component', showToc: true }
  };
</script>

<Section id="examples" title="Examples" subtitle="Context information blocks">
  <div class="flex flex-col gap-6">
    <CodeExample title="Basic Usage" language="svelte" isolate>
      <InfoCard intent="info" title="Note">Use InfoCard to display tips.</InfoCard>
    </CodeExample>

    <CodeExample
      title="Intents"
      description="The intent drives the accent border color; info is the default."
      language="svelte"
      code={`<InfoCard intent="success" title="Saved">Your changes are live.</InfoCard>
<InfoCard intent="warning" title="Heads up">This action cannot be undone.</InfoCard>
<InfoCard intent="danger" title="Failed">The build did not complete.</InfoCard>
<InfoCard intent="neutral" title="Aside">Also available as a CLI flag.</InfoCard>`}
    >
      <div class="flex w-full flex-col">
        <InfoCard intent="success" title="Saved">Your changes are live.</InfoCard>
        <InfoCard intent="warning" title="Heads up">This action cannot be undone.</InfoCard>
        <InfoCard intent="danger" title="Failed">The build did not complete.</InfoCard>
        <InfoCard intent="neutral" title="Aside">Also available as a CLI flag.</InfoCard>
      </div>
    </CodeExample>
  </div>
</Section>
