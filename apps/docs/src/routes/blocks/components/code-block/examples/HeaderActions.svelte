<script lang="ts">
  import { CodeBlock, Button } from '@urbicon-ui/blocks';

  // The `actions` snippet renders extra controls in the header, before the copy
  // button — e.g. "Run in playground", "Open in editor".
  const code = 'SELECT id, title FROM sources WHERE cited = true;';
</script>

<CodeBlock lang="sql" {code}>
  {#snippet actions()}
    <Button variant="ghost" size="sm">Run</Button>
  {/snippet}
</CodeBlock>
