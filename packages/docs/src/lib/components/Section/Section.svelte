<script lang="ts">
  import { untrack } from 'svelte';
  import { type SectionSlots, sectionVariants } from './section.variants';
  import type { SectionProps } from './index.js';
  import { Badge } from '@urbicon-ui/blocks';
  import {
    isInsideSection,
    markInsideSection,
    useSectionNumbering
  } from './section-numbering.svelte.js';

  let {
    id,
    title,
    marker,
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

  // Numbering, in this order and at the top level on purpose:
  //   1. read whether a section already encloses this one — AFTER
  //      `markInsideSection()` the component would read its own value;
  //   2. mark the subtree, so nested sections see it;
  //   3. claim a number, but only for `marker` passed bare and only at page
  //      level. A nested section (a `<TypesReference>` inside a playground
  //      stage) asks for no number, so the count stays the page's.
  // Claiming happens once, during init, so the number is the section's render
  // position on the server and in the browser alike.
  const nestedInSection = isInsideSection();
  markInsideSection();
  const numbering = useSectionNumbering();
  // `untrack` because reading the initial value is the point, not an oversight:
  // a number claimed once must not move when the props object is re-read. Both
  // inputs are fixed per instance anyway — a page does not swap a section's id
  // or turn its marker on midway.
  const claimedNumber = untrack(() =>
    marker === true && !nestedInSection && numbering ? numbering.claim(id) : undefined
  );

  /** Two digits, like the hand-written markers this replaced. */
  const resolvedMarker = $derived(
    typeof marker === 'string'
      ? marker
      : claimedNumber === undefined
        ? undefined
        : String(claimedNumber).padStart(2, '0')
  );

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
</script>

<section
  {...restProps}
  {id}
  class={[slot('root'), className]}
  aria-labelledby={hasHeading ? headingId : undefined}
>
  <!-- Header Section (only rendered if there's content). Under `titleHidden`
       the whole header goes into the screen-reader layer: `sr-only` is
       absolutely positioned, so the header's own `mt-*` rhythm stops taking
       space too — hiding only the title would leave its margin behind. -->
  {#if hasHeader}
    <header class={[titleHidden ? 'sr-only' : slot('header')]}>
      <div class={slot('headerRow')}>
        <!-- Title: Snippet takes precedence over prop -->
        {#if titleSnippet}
          <svelte:element this={headingTag} id={headingId} class={slot('title')}>
            {#if resolvedMarker}<span class={slot('marker')}>{resolvedMarker}</span>{/if}
            {@render titleSnippet()}
          </svelte:element>
        {:else if title}
          <svelte:element this={headingTag} id={headingId} class={slot('title')}>
            {#if resolvedMarker}<span class={slot('marker')}>{resolvedMarker}</span>{/if}
            {title}
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
