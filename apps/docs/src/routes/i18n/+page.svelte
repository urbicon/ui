<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, InfoCard, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';

  const navigation = [
    { id: 'overview', title: 'Overview', order: 1 },
    { id: 'architecture', title: 'Architecture', order: 2 },
    { id: 'quick-start', title: 'Quick Start', order: 3 },
    { id: 'guides', title: 'Guides', order: 4 },
    { id: 'api', title: 'API Surface', order: 5 },
    { id: 'locales', title: 'Supported Locales', order: 6 }
  ];

  const providerCode =
    `<!-- +layout.svelte — mount ONE provider at the app root -->
<` +
    `script>
  import { I18nProvider } from '@urbicon-ui/i18n';
  let { data, children } = $props();
</` +
    `script>

<I18nProvider locale={data.locale}>
  {@render children()}
</I18nProvider>`;

  const resolveCode = `// +layout.server.ts — resolve the locale per request (cookie + Accept-Language)
import { resolveLocale } from '@urbicon-ui/i18n';

export const load = ({ request }) => ({ locale: resolveLocale(request) });`;

  const readCode =
    `<!-- Read translations through a hook — call during component init -->
<` +
    `script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</` +
    `script>

<p>{i18n.t('greeting', { name: 'Ada' })}</p>
<p>{i18n.formatNumber(1234.5)}</p>`;

  const apiCode = `import {
  // Provider + hooks + server helper
  I18nProvider,      // <I18nProvider locale fallbackLocale? onLocaleChange?>
  provideI18n,       // provide from a component's own script (root layouts)
  useI18n,           // { locale, setLocale, availableLocales, isLoading, t, plural, exists, formatNumber, … }
  configureI18n,     // app-global error sink (onError)
  resolveLocale,     // server-side initial-locale resolution
  T,                 // <T key params? fallback? package? />
  BASE_LOCALE,       // 'en'
  SUPPORTED_LOCALES,
  isLocaleSupported,

  // Package integration
  createPackageI18n, // (name, { en }, { loaders }?) -> { useTranslate, t, exists, getLocales, … }
  validatePackageTranslations,

  // Deep-key utilities
  getDeepValue, hasDeepKey, collectDeepKeys
} from '@urbicon-ui/i18n';`;
</script>

<SeoMeta
  title="Localization (i18n)"
  description="SSR-correct, package-scoped, type-safe internationalization for Svelte 5 — zero runtime dependencies."
/>

<DocsPageLayout
  title="Localization"
  description="SSR-correct, package-scoped, type-safe internationalization for Svelte 5. A request-scoped locale lives in context (never a module-global singleton), reactive translations come from runes, and every Urbicon package plugs into one shared registry — all with zero runtime dependencies."
  maxWidth="2xl"
  showToc={true}
  {navigation}
>
  <Section id="overview" intent="primary">
    <p class="text-text-secondary mb-4">
      <code>@urbicon-ui/i18n</code> is the localization layer the design system runs on:
      <code>&lt;Pagination&gt;</code>, <code>&lt;Menu&gt;</code>, the data table, and the auth pages
      all resolve their text through it. You can also use it for your own app strings — it is a
      complete i18n solution, not just an internal helper.
    </p>
    <p class="text-text-secondary mb-4">
      It exists because the system is zero-dependency by design, and the established libraries each
      miss a requirement: <code>svelte-i18n</code> predates Svelte 5 runes, <code>i18next</code> ships
      a large generic runtime, and Paraglide compiles per app (so it can't ship as a reusable component-library
      locale source). This package gives exactly four things:
    </p>
    <div class="grid gap-4 sm:grid-cols-2">
      <InfoCard title="SSR-correct">
        The active locale is request-scoped (in context), so concurrent server renders with
        different languages never leak into each other.
      </InfoCard>
      <InfoCard title="Package-scoped">
        Each package (blocks, table, auth) registers its own namespaced keys into one shared
        registry — a merged surface, no collisions.
      </InfoCard>
      <InfoCard title="Type-safe">
        Keys and their <code>{'{{params}}'}</code> flow from the <code>en</code> bundle straight
        into the hook's <code>t</code> — typos are compile errors.
      </InfoCard>
      <InfoCard title="Zero-dependency">
        Reactive via <code>$state</code>/<code>$derived</code>; pluralization and formatting via the
        platform <code>Intl</code> APIs. No runtime deps.
      </InfoCard>
    </div>
  </Section>

  <Section id="architecture" title="Architecture">
    <p class="text-text-secondary mb-4">
      The package splits state by lifetime. <strong>Static translation data</strong> is
      module-global — it is request-identical, so sharing it is safe. The
      <strong>mutable active locale</strong>
      is request-scoped, held in a Svelte context created by the provider. That split is what makes SSR
      correct: two requests rendering <code>de</code> and <code>en</code> at the same time each read their
      own locale, never a shared global.
    </p>

    <div class="border-border-subtle bg-surface-elevated mb-4 rounded-2xl border p-6">
      <h4 class="text-text-primary mb-3 text-sm font-semibold">Read-tolerant, write-strict</h4>
      <ul class="text-text-secondary space-y-2 text-sm">
        <li>
          <strong class="text-text-primary">Reading</strong> without a provider → the constant base
          locale (<code>en</code>). A provider-less <code>&lt;Button&gt;</code> renders its ARIA strings
          out of the box, identical on server and client (no hydration mismatch). Zero-config.
        </li>
        <li>
          <strong class="text-text-primary">Writing</strong> (<code>setLocale</code>) without a
          provider → <strong>throws</strong>. There is no request-scoped state to mutate — you
          forgot the provider. Loud by design.
        </li>
      </ul>
    </div>

    <p class="text-text-tertiary text-xs">
      Read tolerant, write strict: a component library must render before any consumer wires up
      i18n, but a locale <em>switch</em> with nowhere to store the choice is a real bug, not a default.
    </p>
  </Section>

  <Section id="quick-start" title="Quick Start">
    <p class="text-text-secondary mb-4">
      Two steps: mount a provider fed by a server-resolved locale, then read through a hook.
    </p>

    <h3 class="text-text-primary mb-2 text-lg font-semibold">1. Mount the provider</h3>
    <CodeExample code={providerCode} language="svelte" preview={false} />

    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">
      2. Resolve the locale per request
    </h3>
    <p class="text-text-secondary mb-2 text-sm">
      <code>resolveLocale</code> reads the persisted cookie, then <code>Accept-Language</code>, then
      a default — so SSR and the first client render agree.
    </p>
    <CodeExample code={resolveCode} language="typescript" preview={false} />

    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">3. Read translations</h3>
    <CodeExample code={readCode} language="svelte" preview={false} />

    <p class="text-text-tertiary mt-3 text-xs">
      Switching language at runtime needs no reload — the built-in
      <a class="text-primary hover:underline" href={resolve('/blocks/components/locale-switcher')}
        >LocaleSwitcher</a
      >
      calls <code>setLocale</code> for you. See
      <a class="text-primary hover:underline" href={resolve('/i18n/provider')}>Provider &amp; SSR</a
      >.
    </p>
  </Section>

  <Section id="guides" title="Guides">
    <div class="grid gap-4 sm:grid-cols-2">
      <InfoCard title="Provider & SSR" href={resolve('/i18n/provider')}>
        <code>&lt;I18nProvider&gt;</code>, the <code>useI18n()</code> API, locale switching &amp;
        persistence, <code>resolveLocale</code>, error handling, and coexisting with an app-level
        i18n.
      </InfoCard>
      <InfoCard title="Package Integration" href={resolve('/i18n/package-integration')}>
        <code>createPackageI18n</code>, namespaced keys, the <code>use&lt;Package&gt;I18n</code>
        hook pattern, the <code>&lt;T&gt;</code> component, and registering your own package.
      </InfoCard>
      <InfoCard title="Type Safety" href={resolve('/i18n/typed-keys')}>
        How keys and params infer from the <code>en</code> bundle, eager vs. lazy parity, the
        <code>DeepKeys</code> utilities, and CI parity validation.
      </InfoCard>
      <InfoCard title="Formatting & Plurals" href={resolve('/i18n/formatting')}>
        CLDR pluralization via <code>Intl.PluralRules</code> and locale-aware number, date, and relative-time
        formatting.
      </InfoCard>
      <InfoCard title="Lazy Loading" href={resolve('/i18n/lazy-loading')}>
        Opt-in locale code-splitting: keep non-base languages out of the initial bundle as
        dynamic-import chunks.
      </InfoCard>
      <InfoCard title="Locale Routing" href={resolve('/i18n/routing')}>
        Put the locale in the URL (<code>/de/…</code>) and drive it from the
        <code>&lt;LocaleSwitcher&gt;</code> — a SvelteKit <code>reroute</code> hook plus the
        provider's
        <code>onLocaleChange</code>, with <code>hreflang</code>.
      </InfoCard>
    </div>
  </Section>

  <Section id="api" title="API Surface">
    <p class="text-text-secondary mb-4">Everything is a named export from the package root.</p>
    <CodeExample code={apiCode} language="typescript" preview={false} />
  </Section>

  <Section id="locales" title="Supported Locales">
    <p class="text-text-secondary mb-4">
      <code>en</code> and <code>de</code> ship translation data for every Urbicon package.
      <code>fr</code>, <code>es</code>, <code>it</code>, and <code>nl</code> are declared target
      locales (in the <code>Locale</code> union and <code>SUPPORTED_LOCALES</code>) — register your
      own bundles for them via <code>createPackageI18n</code>.
    </p>
    <div class="border-border-subtle overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-subtle border-border-subtle border-b">
            <th class="text-text-primary px-4 py-2 text-left font-medium">Locale</th>
            <th class="text-text-primary px-4 py-2 text-left font-medium">Status</th>
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium sm:table-cell"
              >Notes</th
            >
          </tr>
        </thead>
        <tbody>
          {#each [['en', 'Ships data (base)', 'The base & default fallback locale'], ['de', 'Ships data', 'Full parity with en across all packages'], ['fr', 'Declared', 'Register your own bundles'], ['es', 'Declared', 'Register your own bundles'], ['it', 'Declared', 'Register your own bundles'], ['nl', 'Declared', 'Register your own bundles']] as [code, status, note] (code)}
            <tr class="border-border-subtle border-b last:border-0">
              <td class="text-text-primary px-4 py-2 font-mono text-xs">{code}</td>
              <td class="text-text-secondary px-4 py-2 text-xs">{status}</td>
              <td class="text-text-tertiary hidden px-4 py-2 text-xs sm:table-cell">{note}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
