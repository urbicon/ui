<script lang="ts">
  import { onDestroy } from 'svelte';
  import { type SectionSlots, sectionVariants } from './section.variants';
  import type { SectionProps } from './index.js';
  import { Badge, resolveClassChain } from '@urbicon-ui/blocks';
  import { getSectionRegistry, setSectionRegistry } from './section-registry.svelte.js';

  let {
    id,
    title,
    marker = false,
    meta,
    titleHidden = false,
    subtitle,
    badges = [],
    centered = false,
    size = 'lg',
    intent = 'default',
    headingLevel = 2,
    footerSnippet,
    titleSnippet,
    subtitleSnippet,
    children,
    class: className,
    unstyled = false,
    slotClasses = {},
    ...restProps
  }: SectionProps = $props();

  // Generate TV classes
  const styles = $derived(sectionVariants({ size, intent, centered }));

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  // Folds through tv(): a `slotClasses` entry strips the default it conflicts
  // with, so the override wins its bucket instead of both classes landing on
  // the element and the stylesheet order picking the winner. Same contract as
  // the ternary every `blocks` component uses, and as CodePanel /
  // TypesReference / PlaygroundConfigurator here. Under `unstyled` there are
  // no defaults to fold against, so the override stands alone.
  const slot = (name: SectionSlots): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };

  // Determine whether to show header section
  const hasHeader = $derived(
    !!(title || titleSnippet || subtitle || subtitleSnippet || badges.length > 0 || meta)
  );

  // Only a title actually renders an element carrying `headingId`. A section
  // with just a subtitle/meta/badges has a header but no heading — pointing
  // `aria-labelledby` at it would be a dangling IDREF.
  const hasHeading = $derived(!!(title || titleSnippet));

  const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
  type HeadingTag = (typeof HEADING_TAGS)[number];

  const headingTag: HeadingTag = $derived.by(() => {
    const level = Math.min(6, Math.max(1, headingLevel));
    return HEADING_TAGS[level - 1];
  });

  const headingId = $derived.by(() => `${id}-title`);

  // Registered during init, not in an effect: the server renders the table of
  // contents from what registered, and effects do not run there. Init runs in a
  // branch effect, where the write is allowed while the page renders. Getters,
  // so the entry follows the props. See `section-registry.svelte.ts`.
  const registration = getSectionRegistry()?.register({
    get id() {
      return id;
    },
    get heading() {
      return hasHeading ? headingContent : undefined;
    },
    get marker() {
      return marker;
    }
  });
  if (registration) {
    setSectionRegistry(registration.children);
    onDestroy(() => registration.unregister());
  }

  /** Two digits; the number is the section's position among the numbered ones. */
  const resolvedMarker = $derived.by(() => {
    const number = registration?.number;
    return number === undefined ? undefined : String(number).padStart(2, '0');
  });

  /** In the document from here on, the entry sorts by where the section sits. */
  function placeEntry(node: Element) {
    if (registration) registration.element = node;
  }
</script>

<!-- The heading's content, and the table of contents' label for this section:
     one snippet, so the entry says what the heading says, `lang` included.
     Snippet takes precedence over prop. -->
{#snippet headingContent()}
  {#if titleSnippet}{@render titleSnippet()}{:else}{title}{/if}
{/snippet}

<section
  {...restProps}
  {id}
  class={resolveClassChain(slot('root'), className)}
  aria-labelledby={hasHeading ? headingId : undefined}
  {@attach placeEntry}
>
  <!-- Header Section (only rendered if there's content). Under `titleHidden`
       the whole header goes into the screen-reader layer: `sr-only` is
       absolutely positioned, so the header's own `mt-*` rhythm stops taking
       space too — hiding only the title would leave its margin behind. -->
  {#if hasHeader}
    <header class={[titleHidden ? 'sr-only' : slot('header')]}>
      <div class={slot('headerRow')}>
        {#if hasHeading}
          <svelte:element this={headingTag} id={headingId} class={slot('title')}>
            {#if resolvedMarker}<span class={slot('marker')}>{resolvedMarker}</span>{/if}
            {@render headingContent()}
          </svelte:element>
        {/if}

        <!-- Meta-counter (editorial, e.g. "20 props"). Sits right-aligned
             via `ml-auto`; if badges are also set, they hang in the
             gap-4 slot directly after. -->
        {#if meta}
          <span class={slot('meta')}>{meta}</span>
        {/if}

        <!-- Badges -->
        {#if badges.length > 0}
          <div class={slot('badges')}>
            <!-- Keyed on text+index: two badges may legitimately carry the
                 same label, and a bare `badge.text` key would collide. -->
            {#each badges as badge, i (`${badge.text}-${i}`)}
              <Badge intent={badge.intent} variant={badge.variant} size="sm">
                {badge.text}
              </Badge>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Subtitle: Snippet takes precedence over prop -->
      {#if subtitleSnippet}
        <div class={slot('subtitle')}>
          {@render subtitleSnippet()}
        </div>
      {:else if subtitle}
        <p class={slot('subtitle')}>
          {subtitle}
        </p>
      {/if}
    </header>
  {/if}

  <!-- Content Section -->
  {#if children}
    <div class={slot('body')}>
      {@render children()}
    </div>
  {/if}

  <!-- Footer Section -->
  {#if footerSnippet}
    <footer class={slot('footer')}>
      {@render footerSnippet()}
    </footer>
  {/if}
</section>
