<!--
  Test-only harness. Scroller takes its items as consumer markup, and
  `createRawSnippet` can only produce a SINGLE root element — so a raw snippet
  cannot express "a row of N children", which is the one thing every Scroller
  test needs. `count` also lets a test grow or shrink the row to exercise the
  MutationObserver path.
-->
<script lang="ts">
  import type { ScrollerProps } from '../index';
  import Scroller from '../Scroller.svelte';

  let { count = 5, ...rest }: { count?: number } & Omit<ScrollerProps, 'children'> = $props();

  const ordinals = $derived(Array.from({ length: count }, (_, index) => index));
</script>

<Scroller {...rest}>
  {#each ordinals as ordinal (ordinal)}
    <div data-item={ordinal}>Item {ordinal + 1}</div>
  {/each}
</Scroller>
