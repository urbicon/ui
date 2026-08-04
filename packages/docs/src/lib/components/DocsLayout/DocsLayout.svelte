<script lang="ts">
  import {
    CodeVisibilityStore,
    setCodeVisibilityContext
  } from '$lib/stores/code-visibility.svelte';
  import { ScrollSpy } from '$lib/stores/scroll-spy.svelte';
  import { Breadcrumb, ChevronDownIcon } from '@urbicon-ui/blocks';
  import { useDocsI18n } from '$lib/i18n';
  import TableOfContents from '../TableOfContents/TableOfContents.svelte';
  import { docsLayoutVariants } from './docslayout.variants';
  import { getPageNav } from './page-nav';
  import type { DocsLayoutProps } from './index.js';

  const dt = useDocsI18n();

  let {
    title,
    description,
    navigation = [],
    breadcrumbs,
    stability,
    sourceHref,
    related,
    showToc = false,
    showCodeToggle = true,
    maxWidth = 'lg',
    sidebar = false,
    centered = false,
    children,
    class: className,
    unstyled = false,
    slotClasses = {}
  }: DocsLayoutProps = $props();

  const styles = $derived(
    docsLayoutVariants({
      maxWidth,
      sidebar: sidebar || showToc,
      centered
    })
  );

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  type SlotName = keyof NonNullable<DocsLayoutProps['slotClasses']>;
  // Folds through tv(): a `slotClasses` entry strips the default it conflicts
  // with, so the override wins its bucket instead of both classes landing on
  // the element and the stylesheet order picking the winner. Same contract as
  // the ternary every `blocks` component uses, and as CodePanel /
  // TypesReference / PlaygroundConfigurator here. Under `unstyled` there are
  // no defaults to fold against, so the override stands alone.
  const slot = (name: SlotName): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };

  // Optional end-of-page slot (prev/next reading nav). The app sets one snippet
  // site-wide via setPageNav; every DocsLayout page renders it below the content
  // — no per-page repetition, and the published layout stays router-agnostic.
  const pageNav = getPageNav();

  // The code-visibility store is provisioned here even though the
  // global toggle now lives in the TOC: the store has to be in the
  // DocsLayout's setContext scope so every nested CodeExample finds
  // the same instance. `showCodeToggle` only gates whether the TOC
  // shows the toggle UI; the store is always available so individual
  // CodeExamples can keep their local toggles working.
  const codeVisibility = new CodeVisibilityStore();
  setCodeVisibilityContext(codeVisibility);

  const useCollapsingHeader = $derived(breadcrumbs != null && breadcrumbs.length > 0);

  // The sticky-header trail is the consumer's ancestor breadcrumbs with the
  // current page (the `title`) appended as the final crumb — matching the
  // Breadcrumb primitive's "last item is the current page" contract.
  const breadcrumbTrail = $derived(
    title ? [...(breadcrumbs ?? []), { label: title }] : (breadcrumbs ?? [])
  );

  let headerEl: HTMLElement | undefined = $state();
  let scrolledPastHeader = $state(false);

  // ONE scrollspy for the whole layout: the sticky-bar badge and the TOC
  // marker read the same instance (the active id is passed down to the TOC
  // below), so the two can never disagree. Ids include nested children so a
  // TOC child entry can be the active one.
  const navIds = $derived(
    navigation.flatMap((n) => [n.id, ...(n.children?.map((c) => c.id) ?? [])])
  );
  const spy = new ScrollSpy(() => navIds);
  // Reading `spy.active` is what starts the scroll listener, so the same
  // condition that used to gate the `observe()` effect gates the read here —
  // a layout with neither a collapsing header nor a TOC still costs nothing.
  const spyConsumed = $derived(useCollapsingHeader || (showToc && navigation.length > 0));
  const activeSection = $derived(spyConsumed ? spy.active : '');

  // The badge names AND anchors to the top-level section the reader is in —
  // when a nested child is active, its parent supplies both label and target,
  // so the two never disagree.
  const activeTopSection = $derived.by(() => {
    if (!activeSection) return undefined;
    return navigation.find(
      (n) => n.id === activeSection || n.children?.some((c) => c.id === activeSection)
    );
  });
  const activeSectionTitle = $derived(activeTopSection?.title ?? '');

  // Separate $effect for the hero observer: reactive to `useCollapsingHeader`
  // and `headerEl` — when a navigation toggles breadcrumbs from `undefined`
  // to `[…]` (or vice versa), the header element mounts/unmounts and the
  // observer needs to be re-wired. onMount would capture the initial value
  // only and leave the layout without the collapse transition afterwards.
  $effect(() => {
    if (!useCollapsingHeader || !headerEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        scrolledPastHeader = !entry.isIntersecting;
      },
      { threshold: 0 }
    );
    observer.observe(headerEl);

    return () => observer.disconnect();
  });

  // Legacy mobile TOC state
  let mobileTocOpen = $state(false);
  // pageToolbar is the legacy-layout's stand-in for the sticky-bar;
  // the global code-toggle migrated to the TOC, so the toolbar only
  // earns its presence now when there's a mobile-TOC button or a
  // source-link to show.
  const showToolbar = $derived((showToc && navigation.length > 0) || sourceHref != null);
</script>

<!-- urbicon-ignore animated-dimensions — the sticky breadcrumb shrinks its
     type when the header scrolls away, and font-size is what shrinks. The
     usual escape, a transform scale, resamples text and reads blurry at
     these sizes. The cost is real but bounded: one line of text, 300ms,
     once per scroll direction change. -->

<!--
  Editorial stability stamp (only-non-stable convention):
  Only renders when the component carries a non-`stable` stability —
  `stable` is the default for the vast majority of components and the
  badge would be visual noise on every page. The variant carries
  colour, not just label: `experimental` reads as a warning,
  `deprecated` as a danger. Sits inline after the pipe cursor in the
  H1 so it acts as a *modifier* of the title, not a header-line of
  its own that steals vertical room.
-->
{#snippet stabilityStamp()}
  {#if stability && stability !== 'stable'}
    {@const stabilityIntent =
      stability === 'experimental'
        ? 'text-warning border-warning/40'
        : stability === 'beta'
          ? 'text-info border-info/40'
          : 'text-danger border-danger/40'}
    <span
      class="font-meta rounded-modify ml-2 inline-flex items-center border px-1.5 py-0.5 align-middle text-xs tracking-wider uppercase {stabilityIntent}"
      aria-label={dt('stabilityLabel', { stability })}
    >
      {stability}
    </span>
  {/if}
{/snippet}

<!--
  Source-Link: occupies the
  slot the global code-toggle previously held (right edge of the
  sticky bar / pageToolbar). The code-toggle now lives in the TOC.
  External link to the GitHub blob — the href is not a SvelteKit route.
-->
{#snippet sourceLink()}
  {#if sourceHref}
    <!-- external GitHub URL, not a SvelteKit route -->
    <a
      href={sourceHref}
      target="_blank"
      rel="noopener noreferrer"
      class="font-meta text-text-tertiary hover:text-text-primary inline-flex shrink-0 items-center gap-1 px-2 py-1.5 text-xs tracking-wider uppercase transition-colors"
    >
      {dt('sourceLink')} <span aria-hidden="true">↗</span>
    </a>
  {/if}
{/snippet}

<!--
  Hero header — shared by the collapsing-hero and legacy layouts (one markup,
  two call sites). `data-docs-header` is part of the data-docs-* theming
  contract: the rooms skin paints it as the room colour field. `headerEl`
  only matters for the collapsing layout's IntersectionObserver; binding it
  in the legacy layout is inert (the observer effect gates on
  `useCollapsingHeader`).
-->
{#snippet heroHeader()}
  <header bind:this={headerEl} class={slot('header')} data-docs-header>
    <div class={slot('headerInner')}>
      {#if title}
        <h1 class={slot('title')}>
          {title}{@render stabilityStamp()}
        </h1>
      {/if}
      {#if description}
        <p class={slot('subtitle')} data-docs-subtitle>
          {description}
        </p>
      {/if}
    </div>
  </header>
{/snippet}

<div class={[slot('container'), className]}>
  {#if useCollapsingHeader}
    <!-- ═══ COLLAPSING HERO — full-width header band ═══ -->
    <!--
      The sticky strip and the hero header are direct children of `container`
      (not nested in the body column), so the colour band spans the full width
      right of the app sidebar and the TOC drops below it. Because `container`
      is the full-height page, the strip stays pinned for the whole scroll —
      its containing block is the page, not a short header box.
    -->
    <div class={slot('stickyBar')} data-docs-sticky-bar>
      <div class={slot('stickyBarInner')}>
        <div class="flex items-center py-2.5">
          <!--
            Dogfood the Breadcrumb primitive. `wrap={false}` keeps the trail on
            one line: ancestor links hold their width while the current page
            (the title) truncates. The title is the trail's final crumb and
            morphs in place via a reactive `currentPage` slot class — a quiet
            lowercase leaf while the hero h1 is on screen, a prominent heading
            once scrolled past it, so there is never a second title element to
            read as a duplicate. The ancestor links inherit the primitive's
            focus-visible ring. `font-meta` picks up the mono meta font when
            the rooms theme is enabled; `min-w-0` lets the nav shrink rather
            than burst the bar.
          -->
          <Breadcrumb
            items={breadcrumbTrail}
            wrap={false}
            aria-label={dt('breadcrumbLabel')}
            slotClasses={{
              nav: 'font-meta min-w-0 lowercase',
              list: `gap-0.5 transition-[font-size] duration-300 ease-out ${scrolledPastHeader ? 'text-xs' : 'text-sm'}`,
              link: 'text-text-tertiary hover:text-text-secondary no-underline hover:no-underline transition-colors duration-150',
              separator: 'text-text-quaternary mx-1.5',
              currentPage: `text-sm truncate transition-colors duration-300 ease-out ${scrolledPastHeader ? 'text-text-primary font-semibold normal-case' : 'text-text-secondary font-normal'}`
            }}
          />

          <!-- Scrollspy badge: slides in with a staggered delay when scrolled.
               Hidden on mobile, where the bar has no room for it beside the
               title and the source link. -->
          <div
            class="hidden items-center overflow-hidden transition-[max-width,opacity,margin-left] duration-300 ease-out sm:flex
              {scrolledPastHeader && activeSectionTitle
              ? 'ml-2 max-w-56 opacity-100'
              : 'ml-0 max-w-0 opacity-0'}"
            style="transition-delay: {scrolledPastHeader ? '80ms' : '0ms'}"
            aria-hidden={!scrolledPastHeader || !activeSectionTitle}
          >
            <span class="bg-text-tertiary/40 mr-2 size-1 shrink-0 rounded-full" aria-hidden="true"
            ></span>
            <a
              href="#{activeTopSection?.id ?? activeSection}"
              data-docs-scrollspy
              class="text-primary bg-primary-subtle hover:bg-primary-subtle/80 rounded-modify max-w-40 shrink-0 truncate px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors"
              tabindex={scrolledPastHeader ? 0 : -1}
            >
              {activeSectionTitle}
            </a>
          </div>

          <span class="min-w-0 flex-1"></span>

          {@render sourceLink()}
        </div>
      </div>

      <!-- Hairline: expands from center when scrolled (library skin). The
           rooms skin hides it — on the colour band the fill edge is the
           separator. -->
      <div class="relative h-px overflow-hidden" aria-hidden="true" data-docs-sticky-hairline>
        <div
          class="bg-border-subtle absolute top-0 h-px transition-[left,right] duration-300 ease-out
            {scrolledPastHeader ? 'right-0 left-0' : 'right-1/2 left-1/2'}"
        ></div>
      </div>
    </div>

    {#if title || description}
      {@render heroHeader()}
    {/if}
  {:else if title || description}
    <!-- ═══ LEGACY — full-width header band (no breadcrumbs, no sticky strip) ═══ -->
    {@render heroHeader()}
  {/if}

  <div class={slot('wrapper')}>
    <!-- Deliberately a <div>, not <main>: the host app supplies the main
         landmark. The docs site wraps every page in blocks' SidebarLayout,
         which renders `<main id="main-content">` — a <main> here would be a
         second one on every page, which is worse than none. A consumer using
         DocsLayout without such a shell owns the landmark. -->
    <div class={slot('main')}>
      <div class={slot('content')}>
        {#if !useCollapsingHeader && showToolbar}
          <div class={slot('pageToolbar')}>
            {#if showToc && navigation.length > 0}
              <div class={slot('mobileToc')}>
                <button
                  class={slot('mobileTocButton')}
                  onclick={() => (mobileTocOpen = !mobileTocOpen)}
                  aria-expanded={mobileTocOpen}
                >
                  <span>{dt('tocOnThisPage')}</span>
                  <ChevronDownIcon
                    class="h-4 w-4 transition-transform duration-(--blocks-duration-fast) {mobileTocOpen
                      ? 'rotate-180'
                      : ''}"
                    aria-hidden="true"
                  />
                </button>
                {#if mobileTocOpen}
                  <nav class={slot('mobileTocNav')}>
                    {#each navigation as item (item.id)}
                      <a
                        href={`#${item.id}`}
                        class={slot('mobileTocLink')}
                        onclick={() => (mobileTocOpen = false)}
                      >
                        {item.title}
                      </a>
                    {/each}
                  </nav>
                {/if}
              </div>
            {/if}

            {@render sourceLink()}
          </div>
        {/if}

        {@render children?.()}

        {@render pageNav?.()}
      </div>
    </div>

    {#if showToc && navigation.length > 0}
      <TableOfContents
        {navigation}
        {related}
        {showCodeToggle}
        position="right"
        activeSection={spy.active}
      />
    {/if}
  </div>
</div>
