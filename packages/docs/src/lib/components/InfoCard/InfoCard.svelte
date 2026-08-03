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
  const slot = (name: InfoCardSlots): string =>
    [unstyled ? '' : styles[name](), slotClasses[name] ?? ''].filter(Boolean).join(' ');

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
  <a {...restProps} {href} class={[slot('container'), 'block', className]} aria-label={title}>
    {@render body()}
  </a>
{:else}
  <!-- <aside> is role="complementary" landmark; ARIA requires a unique
       accessible name when multiple landmarks of the same type appear on a
       page. InfoCards are typically used inline in docs content (often 3–4
       per page), so a label sourced from the title prop disambiguates them
       for assistive tech. Falls back to a generic "Note" when no title is
       provided. -->
  <aside
    {...restProps}
    class={[slot('container'), className]}
    aria-label={title ?? dt('noteLabel')}
  >
    {@render body()}
  </aside>
{/if}
