<!--
  Internal: the one page skeleton (wrapper → Card → h1 → aria-live error
  region) every auth page renders through, so their spacing cannot drift
  apart. Owns the `root`/`card`/`title`/`error` slots; page-specific content
  renders as children. Not exported from the package.
-->
<script lang="ts">
  import { Card } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';
  import { slotClass } from '../../utils/slot-class.js';
  import type { AuthPageSlotClasses } from '../types.js';
  import FormErrorAlert from './FormErrorAlert.svelte';

  interface Props {
    /** Page heading (h1). */
    title: string;
    /**
     * Error text for the shared aria-live region below the heading. Pass the
     * page's error state (empty string = silent region); omit entirely when the
     * page manages its own feedback region (VerifyEmailPage).
     */
    error?: string;
    /** Center the card's text (VerifyEmailPage). */
    centered?: boolean;
    /** Rendered between the heading and the error region. */
    header?: Snippet;
    children: Snippet;
    unstyled?: boolean;
    slotClasses?: AuthPageSlotClasses;
    class?: string;
  }

  let {
    title,
    error,
    centered = false,
    header,
    children,
    unstyled = false,
    slotClasses = {},
    class: className
  }: Props = $props();

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<div
  class={cls(
    'flex min-h-[60vh] items-center justify-center',
    [slotClasses.root, className].filter(Boolean).join(' ')
  )}
>
  <!-- `elevated`, not `outlined`: the auth card lifts off the page on its
       shadow instead of fencing itself in — the same surface language the
       blocks demos speak. Restyle via slotClasses.card / unstyled as before. -->
  <Card
    variant="elevated"
    padding="xl"
    {unstyled}
    class={cls(centered ? 'w-full max-w-md text-center' : 'w-full max-w-md', slotClasses.card)}
  >
    <h1 class={cls('text-text-primary mb-6 text-2xl font-semibold', slotClasses.title)}>
      {title}
    </h1>

    {#if header}
      {@render header()}
    {/if}

    {#if error !== undefined}
      <FormErrorAlert {error} {unstyled} class={cls('mb-4', slotClasses.error)} />
    {/if}

    {@render children()}
  </Card>
</div>
