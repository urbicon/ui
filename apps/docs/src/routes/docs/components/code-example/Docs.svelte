<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Badge, Button } from '@urbicon-ui/blocks';
</script>

<Section marker="01" id="examples" title="Examples" subtitle="The core props in action">
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
