<script lang="ts">
  import type { NoteProps } from './index.js';
  import { resolveClassChain } from '@urbicon-ui/blocks';
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
  // Folds through tv(): a `slotClasses` entry strips the default it conflicts
  // with, so the override wins its bucket instead of both classes landing on
  // the element and the stylesheet order picking the winner. Same contract as
  // the ternary every `blocks` component uses, and as CodePanel /
  // TypesReference / PlaygroundConfigurator here. Under `unstyled` there are
  // no defaults to fold against, so the override stands alone.
  const slot = (name: NoteSlots): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };

  // Same clamp as Section: an out-of-range level would emit `<h0>`/`<h9>`,
  // which is not a heading at all.
  const tag = $derived(`h${Math.min(6, Math.max(1, headingLevel))}` as const);
</script>

<div {...restProps} class={resolveClassChain(slot('root'), className)}>
  {#if titleSnippet}
    <svelte:element this={tag} class={slot('title')}>
      {@render titleSnippet()}
    </svelte:element>
  {:else if title}
    <svelte:element this={tag} class={slot('title')}>{title}</svelte:element>
  {/if}
  {@render children?.()}
</div>
