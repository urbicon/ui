<script lang="ts">
  import { type InfoCardSlots, infoCardVariants } from './infocard.variants';
  import type { InfoCardProps } from './index.js';
  import { useDocsI18n } from '$lib/i18n';

  const dt = useDocsI18n();

  let {
    title,
    headingLevel = 3,
    intent = 'info',
    size = 'md',
    icon,
    href,
    children,
    class: className = '',
    unstyled = false,
    slotClasses = {},
    ...restProps
  }: InfoCardProps = $props();

  const styles = $derived(infoCardVariants({ intent, size }));

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  // Folds through tv(): a `slotClasses` entry strips the default it conflicts
  // with, so the override wins its bucket instead of both classes landing on
  // the element and the stylesheet order picking the winner. Same contract as
  // the ternary every `blocks` component uses, and as CodePanel /
  // TypesReference / PlaygroundConfigurator here. Under `unstyled` there are
  // no defaults to fold against, so the override stands alone.
  const slot = (name: InfoCardSlots): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };

  // Same clamp as Section and Note: an out-of-range level would emit `<h0>`,
  // which is not a heading at all.
  const tag = $derived(`h${Math.min(6, Math.max(1, headingLevel))}` as const);
</script>

{#snippet body()}
  {#if title || icon}
    <div class={slot('header')}>
      {#if icon}
        <!-- Decorative only: the title carries the meaning. `aria-hidden` alone
             is the whole contract — a `role="img"` on a hidden element names
             nothing and just adds a second, contradictory signal. -->
        <span class={slot('icon')} aria-hidden="true">
          {icon}
        </span>
      {/if}
      {#if title}
        <svelte:element this={tag} class={slot('title')}>
          {title}
        </svelte:element>
      {/if}
    </div>
  {/if}

  {#if children}
    <div class={slot('content')}>
      {@render children()}
    </div>
  {/if}
{/snippet}

{#if href}
  <!-- The href is provided by the consumer; this component does not own the
       SvelteKit routing layer, so resolve() is the caller's responsibility. -->
  <!-- `data-docs-note` — see the <aside> branch below. -->
  <a
    {...restProps}
    {href}
    class={[slot('container'), 'block', className]}
    aria-label={title}
    data-docs-note
  >
    {@render body()}
  </a>
{:else}
  <!-- <aside> is role="complementary" landmark; ARIA requires a unique
       accessible name when multiple landmarks of the same type appear on a
       page. InfoCards are typically used inline in docs content (often 3–4
       per page), so a label sourced from the title prop disambiguates them
       for assistive tech. Falls back to a generic "Note" when no title is
       provided.

       `data-docs-note` is part of the data-docs-* theming contract: it marks
       the card as reading material, so a skin running a narrower reading edge
       than its exhibit edge (the docs app does) keeps notes with the prose
       instead of letting them stretch to the width a table gets. -->
  <aside
    {...restProps}
    class={[slot('container'), className]}
    aria-label={title ?? dt('noteLabel')}
    data-docs-note
  >
    {@render body()}
  </aside>
{/if}
