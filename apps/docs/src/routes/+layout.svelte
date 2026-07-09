<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';
  import { REPO_URL } from '$lib/seo';
  import { afterNavigate } from '$app/navigation';
  import SidebarNavigation from '$lib/SidebarNavigation.svelte';
  import CommandSearch from '$lib/CommandSearch.svelte';
  import DocsThemeToggle from '$lib/DocsThemeToggle.svelte';
  import { navigationItems } from '$lib/navigation';
  import {
    LocaleSwitcher,
    ThemeSwitcher,
    SidebarLayout,
    MenuIcon,
    SearchIcon
  } from '@urbicon-ui/blocks';
  import { provideI18n } from '@urbicon-ui/i18n';
  import { useAppI18n } from '$lib/i18n';
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
    localStorage.setItem('urbicon-locale', locale);
  }

  onMount(() => {
    const stored = localStorage.getItem('urbicon-locale');
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

  afterNavigate(() => {
    sidebarOpen = false;
  });

  // The landing page is a full-bleed stage without docs chrome — it brings its
  // own header/footer. The skip-link and ⌘K stay global.
  const isLanding = $derived(page.url.pathname === '/');

  // Color Rooms accent per section ("Farbe = Ort"). The top-level route segment
  // selects the room; everything outside the four product areas falls back to
  // the blocks green (the design source's default room). The layout only
  // stamps the room NAME — the colour values live solely in rooms-docs.css
  // (route → room mapping), so a palette change never touches this file.
  const ROOM_SEGMENTS = new Set(['blocks', 'table', 'auth', 'ai']);
  const room = $derived.by(() => {
    const seg = page.url.pathname.split('/')[1] ?? '';
    return ROOM_SEGMENTS.has(seg) ? seg : 'blocks';
  });

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

<a class="blocks-skip-link" href="#main-content"
  >{ta('chrome.skipToContent' as Parameters<typeof ta>[0])}</a
>

{#if isLanding}
  {@render children()}
{:else}
  <!--
    The room scope carries the per-route room as a data attribute;
    `display:contents` keeps it out of the box tree so SidebarLayout's flex +
    sticky behave exactly as before. rooms-docs.css maps data-room to the
    accent pair and derives the whole primary-token family from it, so
    switching route repaints every real component on the page in the
    section's room colour.
  -->
  <div class="docs-room-scope" style="display:contents" data-room={room}>
    <SidebarLayout
      bind:open={sidebarOpen}
      sidebarWidth="16rem"
      contentMaxWidth="none"
      slotClasses={{ sidebar: 'bg-[var(--docs-bg)]' }}
    >
      {#snippet sidebarHeader()}
        <div class="flex h-14 w-full items-center justify-between">
          <a href={resolve('/')} class="text-text-primary text-lg font-bold tracking-tight">
            {ta('chrome.appTitle' as Parameters<typeof ta>[0])}<span class="pipe" aria-hidden="true"
              >|</span
            >
          </a>
          <ThemeSwitcher size="sm" />
        </div>
      {/snippet}

      {#snippet sidebar()}
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
      {/snippet}

      {#snippet sidebarFooter()}
        <div class="p-4">
          <div class="mb-4">
            <DocsThemeToggle />
          </div>
          <!-- Boxed select, matching the boxed search trigger above (design source). -->
          <LocaleSwitcher variant="outlined" size="sm" onLocaleChange={persistLocale} />
          <nav
            aria-label={ta('chrome.footerNav' as Parameters<typeof ta>[0])}
            class="text-text-quaternary mt-3 space-y-1 text-xs"
          >
            <div>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener"
                class="hover:text-text-secondary transition-colors">Codeberg</a
              >
              &middot;
              <a href={resolve('/changelog')} class="hover:text-text-secondary transition-colors"
                >{ta('chrome.changelog' as Parameters<typeof ta>[0])}</a
              >
              &middot;
              <a href={resolve('/ai')} class="hover:text-text-secondary transition-colors"
                >{ta('chrome.mcpServer' as Parameters<typeof ta>[0])}</a
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
          <div class="text-text-quaternary mt-2 text-xs">© 2026 Urbicon &middot; Felix Urban</div>
          <div class="text-text-quaternary mt-1 text-xs">
            v{__APP_VERSION__} &middot; {ta('chrome.footerTagline' as Parameters<typeof ta>[0])}
          </div>
        </div>
      {/snippet}

      {#snippet mobileHeader({ openSidebar })}
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
      {/snippet}

      {@render children()}
    </SidebarLayout>
  </div>
{/if}

<CommandSearch bind:this={commandSearch} />
