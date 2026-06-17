<script lang="ts">
  import { infoCardVariants } from './infocard.variants';
  import type { InfoCardProps } from './index.js';

  let {
    title,
    intent = 'info',
    size = 'md',
    icon,
    href,
    children,
    class: className = ''
  }: InfoCardProps = $props();

  const styles = $derived(infoCardVariants({ intent, size }));
</script>

{#snippet body()}
  {#if title || icon}
    <div class={styles.header()}>
      {#if icon}
        <span class={styles.icon()} role="img" aria-hidden="true">
          {icon}
        </span>
      {/if}
      {#if title}
        <h4 class={styles.title()}>
          {title}
        </h4>
      {/if}
    </div>
  {/if}

  {#if children}
    <div class={styles.content()}>
      {@render children()}
    </div>
  {/if}
{/snippet}

{#if href}
  <!-- The href is provided by the consumer; this component does not own the
       SvelteKit routing layer, so resolve() is the caller's responsibility. -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a {href} class="{styles.container()} block {className}" aria-label={title}>
    {@render body()}
  </a>
{:else}
  <!-- <aside> is role="complementary" landmark; ARIA requires a unique
       accessible name when multiple landmarks of the same type appear on a
       page. InfoCards are typically used inline in docs content (often 3–4
       per page), so a label sourced from the title prop disambiguates them
       for assistive tech. Falls back to a generic "Note" when no title is
       provided. -->
  <aside class="{styles.container()} {className}" aria-label={title ?? 'Note'}>
    {@render body()}
  </aside>
{/if}
