<script lang="ts">
  import { sectionVariants } from './section.variants';
  import type { SectionProps } from './index.js';
  import { Badge } from '@urbicon-ui/blocks';

  let {
    id,
    title,
    marker,
    meta,
    subtitle,
    badges = [],
    centered = false,
    size = 'lg',
    intent = 'default',
    headingLevel = 2,
    footerSnippet,
    titleSnippet,
    subtitleSnippet,
    children
  }: SectionProps = $props();

  // Generate TV classes
  const styles = $derived(sectionVariants({ size, intent, centered }));

  // Determine whether to show header section
  const hasHeader = $derived(
    !!(title || titleSnippet || subtitle || subtitleSnippet || badges.length > 0 || meta)
  );

  const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
  type HeadingTag = (typeof HEADING_TAGS)[number];

  const headingTag: HeadingTag = $derived.by(() => {
    const level = Math.min(6, Math.max(1, headingLevel));
    return HEADING_TAGS[level - 1];
  });

  const headingId = $derived.by(() => `${id}-title`);
</script>

<section {id} class={styles.root()} aria-labelledby={hasHeader ? headingId : undefined}>
  <!-- Header Section (only rendered if there's content) -->
  {#if hasHeader}
    <header class={styles.header()}>
      <div class={styles.headerRow()}>
        <!-- Title: Snippet takes precedence over prop -->
        {#if titleSnippet}
          <svelte:element this={headingTag} id={headingId} class={styles.title()}>
            {#if marker}<span class={styles.marker()}>{marker}</span>{/if}
            {@render titleSnippet()}<span class="pipe" aria-hidden="true">|</span>
          </svelte:element>
        {:else if title}
          <svelte:element this={headingTag} id={headingId} class={styles.title()}>
            {#if marker}<span class={styles.marker()}>{marker}</span>{/if}
            {title}<span class="pipe" aria-hidden="true">|</span>
          </svelte:element>
        {/if}

        <!-- Meta-counter (editorial, e.g. "20 props"). Sits right-aligned
             via `ml-auto`; if badges are also set, they hang in the
             gap-4 slot directly after. -->
        {#if meta}
          <span class={styles.meta()}>{meta}</span>
        {/if}

        <!-- Badges -->
        {#if badges.length > 0}
          <div class={styles.badges()}>
            {#each badges as badge (badge.text)}
              <Badge intent={badge.intent} variant={badge.variant} size="sm">
                {badge.text}
              </Badge>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Subtitle: Snippet takes precedence over prop -->
      {#if subtitleSnippet}
        <div class={styles.subtitle()}>
          {@render subtitleSnippet()}
        </div>
      {:else if subtitle}
        <p class={styles.subtitle()}>
          {subtitle}
        </p>
      {/if}
    </header>
  {/if}

  <!-- Content Section -->
  {#if children}
    <div class={styles.body()}>
      {@render children()}
    </div>
  {/if}

  <!-- Footer Section -->
  {#if footerSnippet}
    <footer class={styles.footer()}>
      {@render footerSnippet()}
    </footer>
  {/if}
</section>
