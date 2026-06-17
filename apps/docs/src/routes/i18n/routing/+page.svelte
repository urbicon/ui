<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';

  const navigation = [
    { id: 'overview', title: 'Why routing lives here', order: 1 },
    { id: 'reroute', title: 'Map URLs → routes', order: 2 },
    { id: 'resolve', title: 'Read the locale', order: 3 },
    { id: 'switch', title: 'Switch via the switcher', order: 4 },
    { id: 'links', title: 'Locale-aware links', order: 5 },
    { id: 'seo', title: 'hreflang & canonical', order: 6 },
    { id: 'variants', title: 'Variants', order: 7 }
  ];

  const rerouteCode = `// src/hooks.ts — a universal hook: runs on both server and client, before
// 'handle'. It maps the visible URL to an internal route, so the locale prefix
// stays OUT of your route tree (/blocks/button, not /[lang]/blocks/button).
// reroute must be pure & idempotent — SvelteKit caches it per unique URL.
import type { Reroute } from '@sveltejs/kit';
import { isLocaleSupported } from '@urbicon-ui/i18n';

export const reroute: Reroute = ({ url }) => {
  const [, maybeLocale, ...rest] = url.pathname.split('/');
  if (isLocaleSupported(maybeLocale)) {
    return '/' + rest.join('/'); // '/de/blocks/button' -> '/blocks/button'
  }
};`;

  const resolveCode = `// src/routes/+layout.server.ts — the locale now lives in the URL, so read it
// from there. reroute does NOT rewrite event.url, so the prefix is still present.
// A bare path (no prefix) is redirected to the cookie/Accept-Language choice.
import { redirect } from '@sveltejs/kit';
import { resolveLocale, isLocaleSupported } from '@urbicon-ui/i18n';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ url, request }) => {
  const seg = url.pathname.split('/')[1];
  if (!isLocaleSupported(seg)) {
    const locale = resolveLocale(request); // cookie -> Accept-Language -> default
    const rest = url.pathname === '/' ? '' : url.pathname;
    redirect(307, '/' + locale + rest + url.search);
  }
  return { locale: seg };
};`;

  const switchCode =
    `<!-- src/routes/+layout.svelte — the routing lives ENTIRELY in onLocaleChange -->
<` +
    `script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { I18nProvider, isLocaleSupported } from '@urbicon-ui/i18n';
  import { localizeHref } from '$lib/i18n-routing';
  let { data, children } = $props();

  // Drop any locale prefix to get the bare, internal path.
  const barePath = (p) => {
    const [, seg, ...rest] = p.split('/');
    return isLocaleSupported(seg) ? '/' + rest.join('/') : p;
  };
</` +
    `script>

<!-- The built-in <LocaleSwitcher> calls setLocale(); the provider fires
     onLocaleChange, and we turn that into a navigation. No switcher code needed. -->
<I18nProvider
  locale={data.locale}
  onLocaleChange={(l) => {
    const target = localizeHref(barePath(page.url.pathname), l);
    // Idempotent: recomputing from the current path makes re-fires a no-op.
    if (target !== page.url.pathname) goto(target);
  }}
>
  {@render children()}
</I18nProvider>`;

  const linksCode = `// src/lib/i18n-routing.ts — the one place that knows the URL shape.
import type { Locale } from '@urbicon-ui/i18n';

// Build a locale-prefixed href from an internal (unprefixed) path.
export function localizeHref(path: string, locale: Locale): string {
  return '/' + locale + (path === '/' ? '' : path);
}`;

  const linkUsageCode =
    `<` +
    `script lang="ts">
  import { localizeHref } from '$lib/i18n-routing';
  let { data } = $props();
</` +
    `script>

<!-- Internal links carry the active locale so navigation stays in-language -->
<a href={localizeHref('/blocks/button', data.locale)}>Button</a>
<a href={localizeHref('/getting-started', data.locale)}>Getting Started</a>`;

  const seoCode = `<!-- root +layout.svelte head — advertise every locale to crawlers -->
<svelte:head>
  {#each ['en', 'de'] as l (l)}
    <link
      rel="alternate"
      hreflang={l}
      href={'https://example.com' + localizeHref(barePath(page.url.pathname), l)}
    />
  {/each}
  <link rel="canonical" href={'https://example.com' + page.url.pathname} />
</svelte:head>`;

  const variantCode = `// Variant: keep the DEFAULT locale unprefixed (/blocks/button === en),
// prefix only the others (/de/blocks/button). Change two functions:
import { BASE_LOCALE, isLocaleSupported } from '@urbicon-ui/i18n';

// reroute: strip only a NON-base locale prefix
export const reroute = ({ url }) => {
  const [, seg, ...rest] = url.pathname.split('/');
  if (isLocaleSupported(seg) && seg !== BASE_LOCALE) return '/' + rest.join('/');
};

// localizeHref: no prefix for the base locale
export function localizeHref(path, locale) {
  return locale === BASE_LOCALE ? path : '/' + locale + (path === '/' ? '' : path);
}`;
</script>

<SeoMeta
  title="Locale Routing - Localization"
  description="Put the locale in the URL (/de/…) and drive it from the LocaleSwitcher: a SvelteKit reroute hook plus the provider's onLocaleChange. The package owns the locale state; routing stays in your app."
/>

<DocsPageLayout
  title="Locale Routing"
  description="Carry the locale in the URL (/de/blocks/button) and switch it from the built-in LocaleSwitcher. The package deliberately doesn't own routing — it gives you the onLocaleChange seam; SvelteKit's reroute hook does the rest."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="overview" intent="primary">
    <p class="text-text-secondary mb-4">
      <a class="text-primary hover:underline" href={resolve('/i18n/provider')}>Provider &amp; SSR</a
      >
      switches the locale <em>in place</em> — no URL change. That is enough for an app whose locale
      is a user preference. When the locale should be <strong>addressable</strong> — shareable
      <code>/de/…</code> links, distinct pages for crawlers, a browser back-button that walks language
      history — it belongs in the URL. That is a routing concern, and routing is a framework decision,
      not a component one.
    </p>
    <div class="border-border-subtle bg-surface-elevated mb-4 rounded-2xl border p-6">
      <h4 class="text-text-primary mb-3 text-sm font-semibold">
        The package owns state, not routes
      </h4>
      <p class="text-text-secondary text-sm">
        <code>setLocale</code> mutates the request-scoped locale and fires the provider's
        <code>onLocaleChange</code>. That callback is the seam: it is where <em>your</em> app
        decides what a locale switch means — write a cookie, call another i18n, or (here) navigate.
        The path prefix vs. query-param vs. subdomain choice, with its <code>hreflang</code> and canonical
        implications, stays yours. This guide wires the recommended path-prefix strategy end to end.
      </p>
    </div>
  </Section>

  <Section id="reroute" title="1. Map the URL to a route">
    <p class="text-text-secondary mb-4">
      SvelteKit's <code>reroute</code> hook runs before <code>handle</code> and turns the visible
      URL into the route used for matching. Strip the locale segment there, and your route tree
      never needs a <code>[lang]</code> param — <code>/de/blocks/button</code> and
      <code>/en/blocks/button</code>
      both render <code>src/routes/blocks/button</code>.
    </p>
    <CodeExample code={rerouteCode} language="typescript" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      <code>reroute</code> does not change the address bar or <code>event.url</code> — it only picks
      the route. Because it is cached per URL, keep it pure (no I/O, no <code>Date.now()</code>).
    </p>
  </Section>

  <Section id="resolve" title="2. Read the locale per request">
    <p class="text-text-secondary mb-4">
      Since <code>event.url</code> keeps the prefix, the root server load reads the locale straight
      from it and feeds the provider — SSR and the first client render agree, with no
      <code>navigator.language</code> guess. A bare path (first visit, or a legacy unprefixed link)
      has no locale to read, so redirect it to the
      <a class="text-primary hover:underline" href={resolve('/i18n/provider')}
        ><code>resolveLocale</code></a
      >
      choice — the single point where cookie and <code>Accept-Language</code> still decide.
    </p>
    <CodeExample code={resolveCode} language="typescript" preview={false} />
  </Section>

  <Section id="switch" title="3. Switch from the LocaleSwitcher">
    <p class="text-text-secondary mb-4">
      Nothing about the switcher changes — the built-in
      <a class="text-primary hover:underline" href={resolve('/blocks/components/locale-switcher')}
        >LocaleSwitcher</a
      >
      calls <code>setLocale</code> as always. You only translate the resulting
      <code>onLocaleChange</code> into a navigation to the prefixed URL. That one handler is the whole
      routing layer.
    </p>
    <CodeExample code={switchCode} language="svelte" preview={false} />
    <p class="text-text-tertiary mt-3 text-xs">
      After the <code>goto</code> lands, the new <code>data.locale</code> flows into the provider as
      a controlled value — but it already equals the state <code>setLocale</code> set, so no
      <code>onLocaleChange</code> re-fires. Locale changes triggered by a plain link (not the
      switcher) do fire it, and resolve to the same URL — the <code>target !== current</code> guard makes
      that a no-op.
    </p>
  </Section>

  <Section id="links" title="4. Locale-aware links">
    <p class="text-text-secondary mb-4">
      Internal links must carry the active locale, or a click drops the visitor back to the bare
      path (and a redirect). Centralize the URL shape in one helper so a strategy change touches one
      file.
    </p>
    <CodeExample code={linksCode} language="typescript" preview={false} />
    <CodeExample code={linkUsageCode} language="svelte" preview={false} />
  </Section>

  <Section id="seo" title="5. hreflang & canonical">
    <p class="text-text-secondary mb-4">
      Addressable locales exist for crawlers — so tell them. Emit an <code>alternate</code> link per
      locale and a <code>canonical</code> for the current one. This is the payoff path-prefix routing
      buys you over an in-place switch.
    </p>
    <CodeExample code={seoCode} language="svelte" preview={false} />
  </Section>

  <Section id="variants" title="Variants">
    <p class="text-text-secondary mb-4">
      The recipe above always prefixes, including the default — unambiguous, but it gives up a clean
      default URL. Two common alternatives, both wired through the same <code>onLocaleChange</code> seam:
    </p>
    <h3 class="text-text-primary mb-2 text-lg font-semibold">Default locale unprefixed</h3>
    <p class="text-text-secondary mb-2 text-sm">
      Leave the base locale at the bare path and prefix only the others. Nicer URLs at the cost of
      one ambiguity: a crawler can't tell an explicit <code>en</code> page from an undecided one, so
      the
      <code>canonical</code> tag from the previous step does real work here.
    </p>
    <CodeExample code={variantCode} language="typescript" preview={false} />
    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">Query parameter</h3>
    <p class="text-text-secondary text-sm">
      If you don't need SEO-distinct pages, <code>?lang=de</code> is the lightest option: skip
      <code>reroute</code> entirely, read <code>url.searchParams.get('lang')</code> in the load, and
      in
      <code>onLocaleChange</code> <code>goto</code> the same path with the param set. Same seam, no route
      tree changes — but search engines may treat the variants as one page.
    </p>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
