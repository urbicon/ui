<script lang="ts">
  import type { NoteListProps } from './index.js';
  import { type NoteListSlots, noteListVariants } from './notelist.variants';

  let {
    variant = 'card',
    children,
    class: className = '',
    unstyled = false,
    slotClasses = {},
    ...restProps
  }: NoteListProps = $props();

  const styles = $derived(noteListVariants({ variant }));

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  // Folds through tv(), like every other component in this package. This file
  // was the tenth: the fold sweep converted its sibling `Note.svelte` and left
  // `NoteList.svelte` concatenating, so the claim "one package, one semantics"
  // was still false by one — `slotClasses={{ root: 'p-0' }}` emitted
  // `… p-6 p-0` and let stylesheet order decide.
  const slot = (name: NoteListSlots): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };
</script>

<!-- No landmark role and no heading of its own: the enclosing <Section> already
     labels this content, and a second nested region would only add a stop that
     announces nothing new. -->
<div {...restProps} class={[slot('root'), className]}>
  <div class={slot('list')}>
    {@render children?.()}
  </div>
</div>
