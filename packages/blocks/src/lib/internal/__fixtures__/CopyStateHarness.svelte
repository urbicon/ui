<!--
  Test-only host for createCopyState. The factory registers an $effect teardown,
  so it must run during component initialisation — a bare call from a test file
  has no component to attach to (`effect_orphan`).

  Mirrors how the real call sites use it: a trigger, the phase reflected into the
  DOM, and the returned outcome recorded so the test can assert that the result
  reaches the CALLER rather than a callback captured at init.
-->
<script lang="ts">
  import { createCopyState } from '../copy-state.svelte';

  let { timeoutMs = 2000 }: { timeoutMs?: number } = $props();

  const copyState = createCopyState({ timeout: () => timeoutMs });

  let lastResult = $state<'none' | 'ok' | 'failed'>('none');

  async function run() {
    const result = await copyState.copy('payload');
    lastResult = result.ok ? 'ok' : 'failed';
  }
</script>

<div data-phase={copyState.phase} data-last-result={lastResult}>
  <button type="button" onclick={run}>copy</button>
</div>
