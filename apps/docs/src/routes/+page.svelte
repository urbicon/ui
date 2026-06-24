<!--
  Landing page as a standalone full-bleed stage: it tells the platform story
  (Urbicon UI → Blocks / Table / Auth / AI-DX) in the editorial language of the
  doc pages — mono markers, pipe cursor, numbered sections, hairline grid. It
  has its own header/footer because the root layout exempts the landing from the
  sidebar chrome.
-->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import { REPO_URL } from '$lib/seo';
  import {
    ArrowRightIcon,
    Avatar,
    Badge,
    Button,
    CheckIcon,
    CopyIcon,
    LocaleSwitcher,
    MenuIcon,
    Popover,
    ThemeSwitcher,
    Toggle
  } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';

  // Mobile nav: below `sm` the four header links collapse into a popover behind
  // a hamburger (the landing is exempt from the SidebarLayout chrome that
  // provides the hamburger on doc pages, so it carries its own).
  let mobileNavOpen = $state(false);
  const mobileNavLinks = [
    { label: 'Components', href: resolve('/blocks'), external: false },
    { label: 'Recipes', href: resolve('/recipes'), external: false },
    { label: 'AI & DX', href: resolve('/ai'), external: false },
    { label: 'Codeberg', href: REPO_URL, external: true }
  ];

  // One-shot entrance trigger for the staggered hero transitions.
  let heroVisible = $state(false);
  onMount(() => {
    const id = setTimeout(() => (heroVisible = true), 80);
    return () => clearTimeout(id);
  });

  const INSTALL_COMMAND = 'bun add @urbicon-ui/blocks';
  let copied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | undefined;
  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      copied = true;
      clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.warn('Clipboard unavailable:', err);
    }
  }

  let demoToggle = $state(true);

  const products = [
    {
      index: '01',
      name: 'Blocks',
      description:
        'The component library: 35 primitives and 18 composed components — forms, overlays, navigation, charts. Every one themable down to the slot.',
      meta: 'form · action · overlay · charts',
      href: resolve('/blocks'),
      cta: 'Browse components'
    },
    {
      index: '02',
      name: 'Table',
      description:
        'A full data table: sorting, filtering, grouping, selection, keyboard navigation, virtualization, column reorder and remote mode with live updates.',
      meta: 'virtualized · remote · live updates',
      href: resolve('/table/table'),
      cta: 'Explore the table'
    },
    {
      index: '03',
      name: 'Auth',
      description:
        'Complete authentication: JWT sessions with refresh rotation, passkeys (WebAuthn), notifications and web push — implemented on the Web Crypto API alone.',
      meta: 'JWT · passkeys · web push',
      href: resolve('/auth'),
      cta: 'Read the auth docs'
    },
    {
      index: '04',
      name: 'AI-native DX',
      description:
        'An MCP server with design intelligence, per-component llms.txt and .cursorrules — your agent picks components, recipes and tokens like a team member.',
      meta: 'MCP · llms.txt · .cursorrules',
      href: resolve('/ai'),
      cta: 'Set up your agent'
    }
  ];

  const principles = [
    {
      index: '01',
      title: 'Zero dependencies',
      description:
        'Variant engine, floating positioning, i18n, WebAuthn, web push — all built in-house. Nothing ships but Svelte and your CSS.',
      meta: '0 runtime deps'
    },
    {
      index: '02',
      title: 'OKLCH token system',
      description:
        'Three layers — foundation, semantic, interaction. Dark mode is a token concern, handled by light-dark(), never a per-component override.',
      meta: 'foundation → semantic → interaction'
    },
    {
      index: '03',
      title: 'Accessible by default',
      description:
        'WCAG AA targets, keyboard navigation everywhere, focus-visible rings, screen-reader fallbacks, prefers-reduced-motion respected.',
      meta: 'WCAG AA · focus-visible'
    },
    {
      index: '04',
      title: 'Tunable to the bone',
      description:
        'Every component takes unstyled and slotClasses. Presets, provider defaults and a runes-based i18n (EN + DE) run through the whole platform.',
      meta: 'unstyled · slotClasses · presets'
    }
  ];

  const footerYear = 2026;
</script>

<SeoMeta />

<div class="bg-surface-base min-h-screen">
  <!-- Top bar -->
  <header class="border-border-hairline border-b">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
      <a href={resolve('/')} class="text-text-primary text-lg font-bold tracking-tight">
        Urbicon UI<span class="pipe" aria-hidden="true">|</span>
      </a>
      <nav aria-label="Landing" class="flex items-center gap-1 sm:gap-2">
        <a
          href={resolve('/blocks')}
          class="text-text-tertiary hover:text-text-primary hidden px-2 py-1 text-sm transition-colors sm:block"
          >Components</a
        >
        <a
          href={resolve('/recipes')}
          class="text-text-tertiary hover:text-text-primary hidden px-2 py-1 text-sm transition-colors sm:block"
          >Recipes</a
        >
        <a
          href={resolve('/ai')}
          class="text-text-tertiary hover:text-text-primary hidden px-2 py-1 text-sm transition-colors sm:block"
          >AI &amp; DX</a
        >
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener"
          class="text-text-tertiary hover:text-text-primary hidden px-2 py-1 text-sm transition-colors sm:block"
          >Codeberg</a
        >

        <!-- Mobile: the four links above collapse into this popover. Closes on
             link click; a route navigation unmounts the landing anyway. -->
        <div class="sm:hidden">
          <Popover bind:open={mobileNavOpen} placement="bottom-end" offsetDistance={8}>
            {#snippet trigger()}
              <button
                type="button"
                aria-label="Open navigation menu"
                class="text-text-secondary hover:text-text-primary hover:bg-surface-hover flex h-9 w-9 items-center justify-center rounded-modify transition-colors"
              >
                <MenuIcon class="h-5 w-5" />
              </button>
            {/snippet}
            <nav aria-label="Site" class="flex min-w-44 flex-col gap-0.5">
              {#each mobileNavLinks as link (link.href)}
                <a
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener' : undefined}
                  onclick={() => (mobileNavOpen = false)}
                  class="text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-modify px-3 py-2 text-sm transition-colors"
                  >{link.label}</a
                >
              {/each}
            </nav>
          </Popover>
        </div>

        <ThemeSwitcher size="sm" />
      </nav>
    </div>
  </header>

  <main id="main-content">
    <!-- Hero -->
    <section class="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
      <div
        class={[
          'transform transition-[transform,opacity] duration-500',
          { 'translate-y-0 opacity-100': heroVisible, 'translate-y-4 opacity-0': !heroVisible }
        ]}
      >
        <p class="meta-marker">Urbicon UI — Svelte 5 · Tailwind 4 · zero deps</p>
      </div>

      <h1
        class={[
          'text-text-primary mt-6 max-w-4xl transform text-5xl font-bold tracking-tight transition-[transform,opacity] delay-100 duration-500 sm:text-6xl md:text-7xl',
          { 'translate-y-0 opacity-100': heroVisible, 'translate-y-4 opacity-0': !heroVisible }
        ]}
      >
        A UI library that depends on nothing.<span class="pipe" aria-hidden="true">|</span>
      </h1>

      <p
        class={[
          'text-text-secondary mt-8 max-w-2xl transform text-lg transition-[transform,opacity] delay-200 duration-500 md:text-xl',
          { 'translate-y-0 opacity-100': heroVisible, 'translate-y-4 opacity-0': !heroVisible }
        ]}
      >
        Written from scratch on Svelte 5 and the web platform. No transitive dependency tree, no
        supply-chain surprises. Zero runtime deps, and it stays that way.
      </p>

      <div
        class={[
          'mt-10 flex transform flex-col gap-4 transition-[transform,opacity] delay-300 duration-500 sm:flex-row sm:items-center',
          { 'translate-y-0 opacity-100': heroVisible, 'translate-y-4 opacity-0': !heroVisible }
        ]}
      >
        <a href={resolve('/getting-started')}>
          <Button size="lg" intent="primary" class="px-6">Get started</Button>
        </a>
        <a href={resolve('/blocks')}>
          <Button variant="outlined" size="lg" class="px-6">Browse components</Button>
        </a>
        <div
          class="border-border-subtle bg-surface-elevated flex items-center gap-3 rounded-lg border py-2 pr-2 pl-4"
        >
          <code class="text-text-secondary font-mono text-sm">{INSTALL_COMMAND}</code>
          <button
            type="button"
            onclick={copyInstall}
            aria-label={copied ? 'Copied' : 'Copy install command'}
            class="text-text-quaternary hover:text-text-secondary rounded-modify p-1.5 transition-colors"
          >
            {#if copied}
              <CheckIcon class="text-success h-4 w-4" />
            {:else}
              <CopyIcon class="h-4 w-4" />
            {/if}
          </button>
        </div>
      </div>

      <!-- Live strip: real components, rendered by the library itself -->
      <div
        class={[
          'mt-16 transform transition-[transform,opacity] delay-500 duration-700',
          { 'translate-y-0 opacity-100': heroVisible, 'translate-y-8 opacity-0': !heroVisible }
        ]}
      >
        <div
          class="border-border-subtle bg-surface-elevated rounded-[var(--docs-radius-card,1rem)] border"
        >
          <div class="border-border-hairline flex items-center justify-between border-b px-5 py-3">
            <span class="meta-marker">Live — rendered by the library</span>
            <span class="font-meta text-text-quaternary hidden sm:block">this page runs on it</span>
          </div>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-6">
            <Button intent="primary">Save changes</Button>
            <Button variant="outlined">Cancel</Button>
            <Badge intent="success">Synced</Badge>
            <Toggle checked={demoToggle} onCheckedChange={(v: boolean) => (demoToggle = v)} />
            <Avatar name="Priya Nair" />
            <Badge variant="outlined" intent="neutral" class="font-mono text-xs"
              >v{__APP_VERSION__}</Badge
            >
          </div>
        </div>
      </div>
    </section>

    <!-- The platform -->
    <section class="border-border-hairline border-t">
      <div class="mx-auto max-w-6xl px-6 py-20">
        <p class="meta-marker">The platform</p>
        <h2 class="text-text-primary mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Four products, one system, zero dependencies<span class="pipe" aria-hidden="true">|</span>
        </h2>
        <p class="text-text-secondary mt-4 max-w-2xl">
          Everything is built on the same tokens, the same variant engine and the same i18n — so the
          table looks like the forms, and the auth pages look like your app.
        </p>

        <div class="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          {#each products as product (product.index)}
            <a
              href={product.href}
              class="group border-border-subtle bg-surface-elevated hover:border-border-default flex gap-5 rounded-[var(--docs-radius-card,1rem)] border p-6 transition-colors"
            >
              <span
                class="text-text-quaternary shrink-0 font-[family-name:var(--font-display)] text-5xl leading-none tabular-nums"
                aria-hidden="true">{product.index}</span
              >
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-4">
                  <h3 class="text-text-primary text-xl font-semibold">{product.name}</h3>
                  <span class="font-meta text-text-quaternary hidden lg:block">{product.meta}</span>
                </div>
                <p class="text-text-secondary mt-3 text-sm leading-relaxed">
                  {product.description}
                </p>
                <span
                  class="text-text-tertiary group-hover:text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                >
                  {product.cta}
                  <ArrowRightIcon
                    class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    </section>

    <!-- The system -->
    <section class="border-border-hairline border-t">
      <div class="mx-auto max-w-6xl px-6 py-20">
        <p class="meta-marker">The system</p>
        <h2 class="text-text-primary mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Opinionated where it counts<span class="pipe" aria-hidden="true">|</span>
        </h2>

        <dl class="divide-border-hairline border-border-hairline mt-12 divide-y border-y">
          {#each principles as principle (principle.index)}
            <div class="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[4.5rem_1fr_auto] sm:gap-6">
              <span
                class="text-text-quaternary font-[family-name:var(--font-display)] text-4xl leading-none tabular-nums"
                aria-hidden="true">{principle.index}</span
              >
              <div>
                <dt class="text-text-primary font-semibold">{principle.title}</dt>
                <dd class="text-text-secondary mt-1 max-w-2xl text-sm leading-relaxed">
                  {principle.description}
                </dd>
              </div>
              <span class="font-meta text-text-quaternary pt-1 sm:text-right">
                {principle.meta}
              </span>
            </div>
          {/each}
        </dl>
      </div>
    </section>

    <!-- Personal note — the person-driven "why" behind the thesis (Cluster G.1). -->
    <section class="border-border-hairline border-t">
      <div class="mx-auto max-w-6xl px-6 py-20">
        <p class="meta-marker">Why this exists</p>
        <p
          class="text-text-primary mt-6 max-w-3xl font-[family-name:var(--font-display)] text-2xl leading-relaxed sm:text-3xl"
        >
          Built because nothing like it existed for Svelte — and because, the way supply-chain
          attacks are going, the safest dependency is none.
        </p>
        <p class="font-meta text-text-tertiary mt-6">— Felix Urban</p>
      </div>
    </section>

    <!-- Closing CTA: same goal, different framing (human vs. agent).
         Inverted brand-green block — the page's single dominant colour moment (Cluster F). -->
    <section class="cta-invert">
      <div class="mx-auto max-w-6xl px-6 py-20">
        <p class="meta-marker">Start building</p>
        <h2 class="text-text-primary mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          With your hands — or your agent<span class="pipe" aria-hidden="true">|</span>
        </h2>

        <div class="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div
            class="border-border-subtle bg-surface-elevated rounded-[var(--docs-radius-card,1rem)] border p-6"
          >
            <span class="meta-marker">For you</span>
            <p class="text-text-secondary mt-3 text-sm leading-relaxed">
              Install the package and import your first component in under a minute.
            </p>
            <code
              class="border-border-hairline text-text-secondary mt-4 block rounded-lg border px-4 py-3 font-mono text-sm"
              >{INSTALL_COMMAND}</code
            >
            <a href={resolve('/getting-started')} class="mt-5 inline-block">
              <Button
                intent="primary"
                class="!border-transparent !bg-[#f9f7f2] !text-[#1f3d12] hover:!bg-white"
                >Get started</Button
              >
            </a>
          </div>

          <div
            class="border-border-subtle bg-surface-elevated rounded-[var(--docs-radius-card,1rem)] border p-6"
          >
            <span class="meta-marker">For your agent</span>
            <p class="text-text-secondary mt-3 text-sm leading-relaxed">
              Connect the MCP server for component search, recipes and design principles — or feed
              the full API surface as plain text.
            </p>
            <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              <a
                href={asset('/llms.txt')}
                class="text-text-tertiary hover:text-primary font-mono text-sm underline"
                >llms.txt</a
              >
              <a
                href={asset('/llms-full.txt')}
                class="text-text-tertiary hover:text-primary font-mono text-sm underline"
                >llms-full.txt</a
              >
            </div>
            <a href={resolve('/ai')} class="mt-5 inline-block">
              <Button
                variant="outlined"
                class="!border-[#f9f7f2a6] !text-[#f9f7f2] hover:!bg-[#f9f7f21f]"
                >Set up the MCP server</Button
              >
            </a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer (landing-local; mirrors the sidebar footer of the docs chrome) -->
  <footer class="border-border-hairline border-t">
    <div
      class="text-text-quaternary mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener"
          class="hover:text-text-secondary transition-colors">Codeberg</a
        >
        &middot;
        <a href={resolve('/changelog')} class="hover:text-text-secondary transition-colors"
          >Changelog</a
        >
        &middot;
        <a href={resolve('/ai')} class="hover:text-text-secondary transition-colors">MCP server</a>
        &middot;
        <a href={asset('/llms.txt')} class="hover:text-text-secondary transition-colors">llms.txt</a
        >
        &middot;
        <a href={resolve('/imprint')} class="hover:text-text-secondary transition-colors">Imprint</a
        >
        &middot;
        <a href={resolve('/privacy')} class="hover:text-text-secondary transition-colors">Privacy</a
        >
      </div>
      <div class="flex items-center gap-4">
        <span>© {footerYear} Urbicon &middot; Felix Urban &middot; v{__APP_VERSION__}</span>
        <LocaleSwitcher
          variant="ghost"
          size="sm"
          onLocaleChange={(l) => localStorage.setItem('urbicon-locale', l)}
        />
      </div>
    </div>
  </footer>
</div>
