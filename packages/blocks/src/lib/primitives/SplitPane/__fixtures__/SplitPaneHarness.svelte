<script lang="ts">
  import { createRawSnippet, untrack } from 'svelte';
  import type { SplitPaneProps } from '../index';
  import SplitPane from '../SplitPane.svelte';

  // Drives a real `bind:ratio` so the interaction test can prove the two-way
  // binding propagates the component's writes back to the parent. The current
  // outer value is mirrored into a probe element the test reads.
  let {
    initialRatio = 0.5,
    ...rest
  }: { initialRatio?: number } & Omit<SplitPaneProps, 'ratio' | 'start' | 'end'> = $props();

  let ratio = $state(untrack(() => initialRatio));

  /** Lets tests drive a consumer-side write through the real `bind:ratio`. */
  export function setRatio(next: number) {
    ratio = next;
  }

  const startPane = createRawSnippet(() => ({ render: () => '<div>Start</div>' }));
  const endPane = createRawSnippet(() => ({ render: () => '<div>End</div>' }));
</script>

<span data-testid="outer-ratio">{ratio}</span>
<SplitPane bind:ratio start={startPane} end={endPane} {...rest} />
