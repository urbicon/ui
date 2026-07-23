<script lang="ts">
  import { CodeBlock } from '@urbicon-ui/blocks';

  // onCopy fires only after the clipboard write succeeds — the perfect hook for
  // analytics ("install command copied") without polling the clipboard.
  let copies = $state(0);
  const code = 'curl -fsSL https://ui.urbicon.de/install.sh | sh';
</script>

<div class="w-full space-y-2">
  <CodeBlock lang="bash" {code} onCopy={() => (copies += 1)} />
  <p class="text-text-tertiary text-xs">
    Copied {copies} time{copies === 1 ? '' : 's'}.
  </p>
</div>
