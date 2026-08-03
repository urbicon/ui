<script lang="ts">
  import type { NoteProps } from './index.js';
  import { type NoteSlots, noteVariants } from './notelist.variants';

  let {
    title,
    titleSnippet,
    headingLevel = 3,
    children,
    class: className = '',
    unstyled = false,
    slotClasses = {},
    ...restProps
  }: NoteProps = $props();

  const styles = $derived(noteVariants());

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  const slot = (name: NoteSlots): string =>
    [unstyled ? '' : styles[name](), slotClasses[name] ?? ''].filter(Boolean).join(' ');

  // Same clamp as Section: an out-of-range level would emit `<h0>`/`<h9>`,
  // which is not a heading at all.
  const tag = $derived(`h${Math.min(6, Math.max(1, headingLevel))}` as const);
</script>

<div {...restProps} class={[slot('root'), className]}>
  {#if titleSnippet}
    <svelte:element this={tag} class={slot('title')}>
      {@render titleSnippet()}
    </svelte:element>
  {:else if title}
    <svelte:element this={tag} class={slot('title')}>{title}</svelte:element>
  {/if}
  {@render children?.()}
</div>
