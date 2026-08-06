<script lang="ts">
  /**
   * m4 counter-probe — renders the module-scope view. With `write` set, this
   * render mutates the shared view; a later render without `write` still sees
   * the mutation. Two sequential server renders standing in for two requests:
   * the leak is instance-level, so sequencing proves it.
   */
  import { moduleScopeView } from './module-view';

  let { write = '' }: { write?: string } = $props();

  // Init-time write on purpose — this harness models a request mutating
  // shared module state, which is exactly the defect being demonstrated.
  // svelte-ignore state_referenced_locally
  if (write) moduleScopeView.search = write;
</script>

<p data-testid="search">{moduleScopeView.search === '' ? 'empty' : moduleScopeView.search}</p>
