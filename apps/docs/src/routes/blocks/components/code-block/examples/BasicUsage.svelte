<script lang="ts">
  import { CodeBlock } from '@urbicon-ui/blocks';

  // Rendered as raw text — CodeBlock never highlights on its own. Long lines
  // scroll horizontally inside the block, so the page never scrolls sideways.
  const code = `import { CodeBlock } from '@urbicon-ui/blocks';

export function greet(name: string): string {
  return \`Hello, \${name} — this line is long enough to scroll inside the block.\`;
}`;
</script>

<CodeBlock lang="ts" {code} />
