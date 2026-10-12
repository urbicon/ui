<!--
  Test-only harness. Scroller takes its items as consumer markup, and
  `createRawSnippet` can only produce a SINGLE root element — so a raw snippet
  cannot express "a row of N children", which is the one thing every Scroller
  test needs. `count` also lets a test grow or shrink the row to exercise the
  MutationObserver path. `onmount` runs where a consumer's own `onMount` would:
  in the component that renders the Scroller.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ScrollerProps } from '../index';
  import Scroller from '../Scroller.svelte';

  let {
    count = 5,
    onmount,
    ...rest
  }: { count?: number; onmount?: () => void } & Omit<ScrollerProps, 'children'> = $props();

  const ordinals = $derived(Array.from({ length: count }, (_, index) => index));

  onMount(() => onmount?.());
</script>

<Scroller {...rest}>
  {#each ordinals as ordinal (ordinal)}
    <div data-item={ordinal}>Item {ordinal + 1}</div>
  {/each}
</Scroller>
