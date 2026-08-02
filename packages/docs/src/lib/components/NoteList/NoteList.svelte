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
  const slot = (name: NoteListSlots): string =>
    [unstyled ? '' : styles[name](), slotClasses[name] ?? ''].filter(Boolean).join(' ');
</script>

<!-- No landmark role and no heading of its own: the enclosing <Section> already
     labels this content, and a second nested region would only add a stop that
     announces nothing new. -->
<div {...restProps} class={[slot('root'), className]}>
  <div class={slot('list')}>
    {@render children?.()}
  </div>
</div>
