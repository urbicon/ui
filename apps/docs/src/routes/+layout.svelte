<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  import { REPO_URL } from '$lib/seo';
  import { afterNavigate } from '$app/navigation';
  import SidebarNavigation from '$lib/SidebarNavigation.svelte';
  import CommandSearch from '$lib/CommandSearch.svelte';
  import { setCommandSearchToggle } from '$lib/command-search.context';
  import DocsThemeToggle from '$lib/DocsThemeToggle.svelte';
  import { navigationItems } from '$lib/navigation';
  import { channelNameForRoute } from '$lib/landing/route-channel.gen';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import DocsPageNavProvider from '$lib/DocsPageNavProvider.svelte';
  import {
    LocaleSwitcher,
    ThemeSwitcher,
    SidebarLayout,
    MenuIcon,
    SearchIcon
  } from '@urbicon-ui/blocks';
  import { provideI18n } from '@urbicon-ui/i18n';
  import { useAppI18n } from '$lib/i18n';
  import { readStored, writeStored } from '$lib/storage';
  import { onMount } from 'svelte';
  // JetBrains Mono self-hosted (instead of Google Fonts) — no third-party requests,
  // see the privacy policy (/privacy).
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/500.css';
  import '@fontsource/jetbrains-mono/600.css';
  // Color Rooms display + body — Schibsted Grotesk, self-hosted like the mono
  // above (no third-party requests, see /privacy). One grotesk voices both the
  // marketing type and the real specimen components (also the landing's face).
  import '@fontsource-variable/schibsted-grotesk/index.css';
  import '../app.css';

  let { children } = $props();

  // Provide request-scoped i18n in the layout's OWN script (not via a child
  // <I18nProvider>), so the chrome below — skip-link, header, footer — can resolve
  // strings through `ta`. (Context flows downward only: a child provider couldn't
  // serve this component.) This is a fully prerendered static site, so the build
  // emits the base locale and the client adopts the stored/browser locale after
  // mount; the first client render still matches the base, so no hydration
  // mismatch. resolveLocale() is the server-side path for SSR consumers (README).
  const i18nState = provideI18n('en');
  const ta = useAppI18n();

  function persistLocale(locale: string) {
    writeStored('urbicon-locale', locale);
  }

  onMount(() => {
    // Hydration marker for the e2e suite: `html[data-hydrated]` only exists
    // once client JS runs, so specs can gate interactions on it instead of
    // racing the SSR-inert markup (see e2e/recipes.spec.ts / the
    // popover-motion aria-expanded workaround it generalizes).
    document.documentElement.dataset.hydrated = 'true';
    const stored = readStored('urbicon-locale');
    const browserLang = navigator.language.split('-')[0];
    const next =
      stored && ['en', 'de'].includes(stored)
        ? stored
        : ['en', 'de'].includes(browserLang)
          ? browserLang
          : null;
    if (next && next !== i18nState.locale) {
      i18nState.setLocale(next as 'en' | 'de');
    }
  });

  let sidebarOpen = $state(false);
  let commandSearch: ReturnType<typeof CommandSearch> | undefined;

  // Der sichtbare Such-Trigger lebte bisher nur im Sidebar-Chrome; die Landing
  // (und jede andere chromfreie Seite) bekommt ihn über diesen Context.
  setCommandSearchToggle(() => commandSearch?.toggle());

  afterNavigate(() => {
    sidebarOpen = false;
  });

  // The landing page is a full-bleed stage without docs chrome — it brings its
  // own header/footer. The skip-link and ⌘K stay global.
  //
  // Landing previews under /test-fixtures/landing-* get the same treatment:
  // judging a full-bleed hero next to the docs sidebar tells you nothing about
  // how it will actually read. Those routes are excluded from sitemap and
  // search (sitemap.xml/+server.ts).
  //
  // /hotel is the livery showcase (successor of the salon exhibit, which was
  // ported from the former chat-demo app): a fictional hotel-group site that
  // brings its own masthead, footer and house switch — docs chrome around it
  // would break the exhibit.
  //
  // /test-fixtures/og is the template for static/og.png (captured by
  // `bun run shots`). It is one 1200 × 630 card and nothing else: the sidebar
  // would sit on top of it and land in the image.
  const isLanding = $derived(
    page.url.pathname === '/' ||
      page.url.pathname === '/hotel' ||
      page.url.pathname === '/test-fixtures/og' ||
      page.url.pathname.startsWith('/test-fixtures/landing-')
  );

  // Chrome-less is the wider question, and the two contained-scroll pages —
  // the live demo framed on /table/sticky-pinning and its e2e fixture — answer
  // it differently from the landings: they keep the docs palette but cannot
  // keep the docs chrome. `fit="viewport"` sizes the table to `100dvh` minus
  // how much viewport sits above it, and never re-measures that on page scroll,
  // so the model only holds where the table IS the page. In an article column
  // it reads a number that is either discarded (below the fold) or stale one
  // scroll later; both pages bring the app-shell bar the cap subtracts instead.
  const CONTAINED_SCROLL_PAGES = [
    '/table/sticky-pinning/contained',
    '/test-fixtures/table-contained'
  ];
  const isFullBleed = $derived(isLanding || CONTAINED_SCROLL_PAGES.includes(page.url.pathname));

  // Color Rooms accent per page ("Farbe = Familie"). A component page wears the
  // channel of its component FAMILY — the same colour the landing's index row
  // shows for it; everything else (overviews, /recipes, /icons, …) falls back to
  // its product AREA. Both tables are generated from the docs-gen catalogues
  // (channels-gen.ts), so a new component cannot end up in the wrong room by
  // omission. The layout still only stamps the channel NAME — the colour values
  // live in rooms-channels.gen.css, so a palette change never touches this file.
  const room = $derived(channelNameForRoute(page.url.pathname));

  // Content reads the room from the .docs-room-scope wrapper (SSR-correct, no
  // flash of the wrong accent). Portaled popovers (Select/Combobox/Menu
  // dropdowns) mount at <body>, OUTSIDE that wrapper, so mirror the room onto
  // <html> after mount — they only open on interaction, always post-hydration,
  // so there is no SSR/first-paint concern for them. The landing brings its
  // own palette scopes, so the stamp is removed there rather than left stale.
  $effect(() => {
    const el = document.documentElement;
    if (isLanding) {
      delete el.dataset.room;
      return;
    }
    el.dataset.room = room;
  });
</script>

<!--
  The chrome (skip-link, sidebar, prev/next, TOC) is bilingual via `ta`/`dt`, but
  the article body is hardcoded English, so `<html lang="en">` (app.html) is right
  for the content. To keep a screen reader from voicing the German chrome with
  English phonetics (WCAG 3.1.1), every switchable chrome subtree carries its own
  `lang` following the active locale; the content column inherits `en` untouched.
-->
<a class="blocks-skip-link" href="#main-content" lang={i18nState.locale}
  >{ta('chrome.skipToContent' as Parameters<typeof ta>[0])}</a
>

<!--
  The prev/next reading nav, defined once here and handed to DocsLayout's
  page-nav slot via DocsPageNavProvider (context). Every DocsLayout page renders
  it at the foot of its article column — no per-page repetition. Chrome-less
  pages (the `isFullBleed` branch below) don't use DocsLayout, so they receive
  no nav.
-->
{#snippet pageNav()}
  <PrevNextNav currentPath={page.url.pathname} />
{/snippet}

{#if isFullBleed}
  {@render children()}
{:else}
  <!--
    The room scope carries the per-route channel as a data attribute;
    `display:contents` keeps it out of the box tree so SidebarLayout's flex +
    sticky behave exactly as before. rooms-channels.gen.css maps data-room to
    the accent pair and rooms-docs.css derives the whole primary-token family
    from it, so switching route repaints every real component on the page in
    the page's channel colour.
  -->
  <div class="docs-room-scope" style="display:contents" data-room={room}>
    <SidebarLayout
      bind:open={sidebarOpen}
      sidebarWidth="16rem"
      contentMaxWidth="none"
      slotClasses={{ sidebar: 'bg-[var(--docs-bg)]' }}
    >
      {#snippet sidebarHeader()}
        <div class="flex h-14 w-full items-center justify-between" lang={i18nState.locale}>
          <a href={resolve('/')} class="text-text-primary text-lg font-bold tracking-tight">
            {ta('chrome.appTitle' as Parameters<typeof ta>[0])}<span class="pipe" aria-hidden="true"
              >|</span
            >
          </a>
          <ThemeSwitcher size="sm" />
        </div>
      {/snippet}

      {#snippet sidebar()}
        <!-- `display:contents` wrapper carries the chrome `lang` without adding a
             box (mirrors the .docs-room-scope pattern); its two children stay
             direct flow children of the Sidebar content area. -->
        <div class="contents" lang={i18nState.locale}>
          <!--
      Search trigger: a boxed field on the sidebar (design source), sitting on
      the paper surface with an architectural border; label and `⌘K` hint share
      the `font-meta` mono ramp so it reads as an input, not a button.
    -->
          <div class="px-3 pt-3">
            <button
              onclick={() => commandSearch?.toggle()}
              class="border-border-default bg-surface-base text-text-tertiary hover:border-border-emphasis hover:text-text-primary rounded-contain flex w-full items-center gap-2 border px-3 py-2 text-sm transition-colors"
            >
              <SearchIcon class="h-4 w-4 shrink-0" />
              <span class="font-meta">{ta('chrome.search' as Parameters<typeof ta>[0])}</span>
              <span class="font-meta text-text-quaternary ml-auto"><kbd>⌘K</kbd></span>
            </button>
          </div>

          <SidebarNavigation items={navigationItems} />
        </div>
      {/snippet}

      {#snippet sidebarFooter()}
        <div class="p-4" lang={i18nState.locale}>
          <!-- Seems a bit unnecessary/confusing
          <div class="mb-4">
            <DocsThemeToggle />
          </div>
          -->
          <!-- Boxed select, matching the boxed search trigger above (design source). -->
          <LocaleSwitcher variant="outlined" size="sm" onLocaleChange={persistLocale} />
          <!-- `text-tertiary`, not `quaternary`: these are links a reader has to
               read and click. The docs skin binds quaternary to `--docs-softer`,
               which its own comment calls "decoration only (never body text)" —
               measured on this footer it was #b8b5ad on #f7f5f0 at 12px, a
               contrast ratio of 1.88:1 where AA asks 4.5. Tertiary is 5.83:1 and
               still reads as the quiet end of the ink hierarchy. -->
          <nav
            aria-label={ta('chrome.footerNav' as Parameters<typeof ta>[0])}
            class="text-text-tertiary mt-3 space-y-1 text-xs"
          >
            <div>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener"
                class="hover:text-text-secondary transition-colors">GitHub</a
              >
              &middot;
              <a href={resolve('/changelog')} class="hover:text-text-secondary transition-colors"
                >{ta('chrome.changelog' as Parameters<typeof ta>[0])}</a
              >
              &middot;
              <a href={resolve('/ai')} class="hover:text-text-secondary transition-colors"
                >{ta('chrome.aiDx' as Parameters<typeof ta>[0])}</a
              >
            </div>
            <div>
              <a href={asset('/llms.txt')} class="hover:text-text-secondary transition-colors"
                >llms.txt</a
              >
              &middot;
              <a href={asset('/llms-full.txt')} class="hover:text-text-secondary transition-colors"
                >llms-full.txt</a
              >
            </div>
            <div>
              <a href={resolve('/imprint')} class="hover:text-text-secondary transition-colors"
                >{ta('chrome.imprint' as Parameters<typeof ta>[0])}</a
              >
              &middot;
              <a href={resolve('/privacy')} class="hover:text-text-secondary transition-colors"
                >{ta('chrome.privacy' as Parameters<typeof ta>[0])}</a
              >
            </div>
          </nav>
          <div class="text-text-tertiary mt-2 text-xs">© 2026 Urbicon &middot; Felix Urban</div>
          <div class="text-text-tertiary mt-1 text-xs">
            v{__APP_VERSION__} &middot; {ta('chrome.footerTagline' as Parameters<typeof ta>[0])}
          </div>
        </div>
      {/snippet}

      {#snippet mobileHeader({ openSidebar })}
        <!-- `display:contents` wrapper carries the chrome `lang`; the button, title
             and switcher stay direct flex children of SidebarLayout's header. -->
        <div class="contents" lang={i18nState.locale}>
          <button
            type="button"
            aria-label={ta('chrome.openNavMenu' as Parameters<typeof ta>[0])}
            aria-expanded={sidebarOpen}
            onclick={openSidebar}
            class="text-text-secondary hover:text-text-primary flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors"
          >
            <MenuIcon class="h-6 w-6" />
          </button>
          <span class="text-text-primary text-lg font-semibold">
            {ta('chrome.appTitle' as Parameters<typeof ta>[0])}<span class="pipe" aria-hidden="true"
              >|</span
            >
          </span>
          <div class="ml-auto">
            <ThemeSwitcher size="sm" />
          </div>
        </div>
      {/snippet}

      <DocsPageNavProvider {pageNav}>
        {@render children()}
      </DocsPageNavProvider>
    </SidebarLayout>
  </div>
{/if}

<CommandSearch bind:this={commandSearch} />
