<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, InfoCard } from '@urbicon-ui/docs';
  import { Badge, Button } from '@urbicon-ui/blocks';

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

<Section id="examples" title="Examples" subtitle="The core props in action">
  <div class="flex flex-col gap-6">
    <CodeExample
      title="Preview + code"
      description="Children render as the live preview; the code prop feeds the highlighted panel."
      language="svelte"
      code={`<CodeExample title="Save action" code={buttonSnippet} language="svelte">
  <Button intent="primary">Save changes</Button>
</CodeExample>`}
    >
      <Button intent="primary">Save changes</Button>
    </CodeExample>

    <CodeExample
      title="Code-only"
      description="preview={false} hides the preview stage — for snippets that are not renderable UI."
      language="typescript"
      preview={false}
      code={`import { codeExampleVariants } from '@urbicon-ui/docs';

const styles = codeExampleVariants({ size: 'sm' });`}
    />

    <CodeExample
      title="Collapsed by default"
      description="defaultExpanded={false} starts with the code panel folded, overriding the page-wide toggle."
      language="svelte"
      defaultExpanded={false}
      code={`<CodeExample title="Status" defaultExpanded={false} code={badgeSnippet}>
  <Badge intent="success">Active</Badge>
</CodeExample>`}
    >
      <Badge intent="success">Active</Badge>
    </CodeExample>
  </div>
</Section>

<Section id="use-cases" title="Use Cases" subtitle="When to use CodeExample">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <InfoCard title="Component Docs">Live preview and copyable snippet in one card</InfoCard>
    <InfoCard title="Tutorials">Step-by-step guides with runnable results</InfoCard>
    <InfoCard title="API Notes">Code-only snippets for types and config files</InfoCard>
  </div>
</Section>
