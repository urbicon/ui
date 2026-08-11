<script lang="ts">
  import {
    CodeVisibilityStore,
    setCodeVisibilityContext
  } from '$lib/stores/code-visibility.svelte';
  import { ScrollSpy } from '$lib/stores/scroll-spy.svelte';
  import { Breadcrumb, ListIcon, Popover } from '@urbicon-ui/blocks';
  import { useDocsI18n } from '$lib/i18n';
  import TableOfContents from '../TableOfContents/TableOfContents.svelte';
  import { createSectionNumbering } from '../Section/section-numbering.svelte.js';
  import { docsLayoutVariants } from './docslayout.variants';
  import { getPageNav } from './page-nav';
  import type { DocsLayoutProps } from './index.js';

  const dt = useDocsI18n();

  // One counter per page, so a `<Section marker>` gets its number from where it
  // sits rather than from a literal someone kept in step by hand. See
  // `section-numbering.svelte.ts` for what claims a number and what does not.
  createSectionNumbering();

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

  // The sticky-header trail is the consumer's ancestor breadcrumbs with the
  // current page (the `title`) appended as the final crumb — matching the
  // Breadcrumb primitive's "last item is the current page" contract. A page
  // with no ancestors (a top-level one like /auth) yields a trail of just its
  // title, which is exactly what the strip should say there.
  const breadcrumbTrail = $derived(
    title ? [...(breadcrumbs ?? []), { label: title }] : (breadcrumbs ?? [])
  );

  /** The mobile half of `showToc` — the desktop rail's exact complement. */
  const showMobileToc = $derived(showToc && navigation.length > 0);

  // The strip renders whenever there is something to put in it — a trail, a
  // source link, or the mobile TOC. It used to be gated on `breadcrumbs`
  // specifically, which split the layout in two: pages that passed ancestors
  // got the strip (with its popover TOC), pages without got a second, lesser
  // implementation — a `pageToolbar` holding an inline mobile TOC. Two code
  // paths for one job, and the lesser one had no declared height, so anchor
  // jumps landed under it (measured 2026-08-11: headings clipped by 24px on
  // lg+, 66px below it, on /i18n and /auth). There is one path now; the toolbar
  // and its four mobile-TOC slots are gone.
  //
  // The trail is not the only trigger, because the toolbar's two other reasons
  // to exist did not depend on breadcrumbs: `sourceHref` rendered above the
  // content on any page, and the mobile TOC needed only `showToc`. Gating the
  // strip on the trail alone would have made both silently inert for a page
  // passing neither `title` nor `breadcrumbs` — no page in this repo, but a
  // published component cannot assume its own repo is the whole audience.
  const showStickyBar = $derived(breadcrumbTrail.length > 0 || sourceHref != null || showMobileToc);

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
  // Reading `spy.active` is what starts the scroll listener, so the read is
  // gated on someone consuming the result: the strip's section badge or the
  // rail's marker. With the strip now rendering for every page that has a
  // title, this is true nearly everywhere — the gate earns its keep only for a
  // layout used as a bare shell, and costs nothing when `navigation` is empty
  // (zero ids to measure per frame).
  const spyConsumed = $derived(showStickyBar || showMobileToc);
  // Read the getter EXACTLY once per frame and pass this derived on — including
  // to the TOC below. `spy.active` is not a stored value: every read walks the
  // id list calling `getBoundingClientRect`, which forces layout. The markup
  // used to read it a second time, which measured everything twice and reached
  // past the gate above while doing it. Measured over four sections, one scroll
  // frame: 4 calls with one reader, 8 with two.
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

  // Separate $effect for the hero observer: reactive to `showStickyBar` and
  // `headerEl` — when a navigation changes what the strip has to show, the
  // header element mounts/unmounts and the observer needs to be re-wired.
  // onMount would capture the initial value only and leave the layout without
  // the collapse transition afterwards.
  $effect(() => {
    if (!showStickyBar || !headerEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        scrolledPastHeader = !entry.isIntersecting;
      },
      { threshold: 0 }
    );
    observer.observe(headerEl);

    return () => observer.disconnect();
  });

  /** The sticky bar's own table of contents — see the control in that bar. */
  let stickyTocOpen = $state(false);
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
  Source-Link: occupies the slot the global code-toggle previously held (right
  edge of the sticky bar). The code-toggle now lives in the TOC.
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
  Hero header. `data-docs-header` is part of the data-docs-* theming contract:
  the rooms skin paints it as the room colour field. `headerEl` is what the
  IntersectionObserver watches to know when the strip has to take the title
  over — it was a snippet with two call sites while the legacy layout existed,
  and is kept as one because the observer binds inside it.
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

<!--
  `stickyBarHeight` rides along exactly when the sticky strip renders, so the
  anchor offset declared on `container` accounts for it. Deriving it from the
  same `showStickyBar` that gates the strip below is the point: a prop of its
  own would be a second source for one fact, which is how the offset drifted
  from the strip in the first place.
-->
<div class={[slot('container'), showStickyBar && slot('stickyBarHeight'), className]}>
  {#if showStickyBar}
    <!-- ═══ PINNED STRIP — full-width band above the hero ═══ -->
    <!--
      The sticky strip and the hero header are direct children of `container`
      (not nested in the body column), so the colour band spans the full width
      right of the app sidebar and the TOC drops below it. Because `container`
      is the full-height page, the strip stays pinned for the whole scroll —
      its containing block is the page, not a short header box.
    -->
    <div class={slot('stickyBar')} data-docs-sticky-bar>
      <div class={slot('stickyBarInner')}>
        <!-- A declared height, not one that falls out of padding: the anchor
             offset and the TOC rail both read `--docs-sticky-bar-h`, and this
             is what makes that value true. It also holds the strip steady while
             the crumb type shrinks on scroll.

             `min-h`, not `h`: Chrome's minimum-font-size setting (Appearance →
             Customize fonts) scales text without scaling `rem`, so at 24px the
             row's content measured 44px inside a 40px box and spilled above and
             below the painted band. The offset is then a little short rather
             than the strip overflowing — a reader who forced larger type gets
             a heading that sits high, not one cut in half. At every normal
             metric the box is exactly the declared height, so the value the
             offset reads stays true where it can. -->
        <div class="flex min-h-(--docs-sticky-bar-h) items-center">
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

          <!--
            The section control. It was a scrollspy *badge* — a link to the
            section you are already in, which is the one section nobody needs a
            link to. It is the page's table of contents now, and since the page
            toolbar's inline mobile TOC was deleted it is the ONLY one below the
            rail's breakpoint — for every page, not just those passing
            breadcrumbs. Measured 2026-08-07, when the split still existed: 124
            of the 127 pages with a `navigation` array rendered no page
            navigation at all down there.

            Gated on `showToc`, same as the rail: the prop's contract is "a
            sticky ToC on desktop and a collapsible one on mobile", so a page
            that switches it off must not keep the mobile half. Passing
            `navigation` alone (for the scrollspy badge) is a real case and used
            to be one gate short. The `navigation.length` half keeps an empty
            popover from hiding behind a list icon that promises navigation.

            The gate is `lg:hidden` against TableOfContents' `max-lg:hidden`:
            Tailwind's two halves of ONE named breakpoint, so exactly one of the
            two is on at every width and no literal can drift from its partner.
            Whether `lg` is the right place for that boundary is a separate
            question — it is not, the exhibit column collapses to 352px at
            1024 — but moving it moves both halves at once.

            The badge's motion is kept and re-aimed: the trigger is always
            there (the icon), and the active section's title expands in beside
            it once the hero is scrolled past.
          -->
          {#if showMobileToc}
            <div class={slot('stickyToc')}>
              <Popover bind:open={stickyTocOpen} placement="bottom-start">
                {#snippet trigger()}
                  <button
                    type="button"
                    class={slot('stickyTocButton')}
                    aria-expanded={stickyTocOpen}
                    aria-label={dt('tocOnThisPage')}
                    data-docs-scrollspy
                  >
                    <ListIcon class="size-3.5 shrink-0" aria-hidden="true" />
                    <span
                      class="overflow-hidden transition-[max-width,opacity] duration-300 ease-out {scrolledPastHeader &&
                      activeSectionTitle
                        ? 'max-w-40 opacity-100'
                        : 'max-w-0 opacity-0'}"
                      style="transition-delay: {scrolledPastHeader ? '80ms' : '0ms'}"
                    >
                      <span class="block truncate whitespace-nowrap">{activeSectionTitle}</span>
                    </span>
                  </button>
                {/snippet}
                <nav class={slot('stickyTocNav')} aria-label={dt('tocOnThisPage')}>
                  {#each navigation as item (item.id)}
                    <a
                      href={`#${item.id}`}
                      class={slot('stickyTocLink')}
                      aria-current={item.id === (activeTopSection?.id ?? activeSection)
                        ? 'location'
                        : undefined}
                      onclick={() => (stickyTocOpen = false)}
                    >
                      {item.title}
                    </a>
                  {/each}
                </nav>
              </Popover>
            </div>
          {/if}

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
  {/if}

  {#if title || description}
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
        {@render children?.()}

        {@render pageNav?.()}
      </div>
    </div>

    {#if showToc && navigation.length > 0}
      <TableOfContents {navigation} {related} {showCodeToggle} position="right" {activeSection} />
    {/if}
  </div>
</div>
