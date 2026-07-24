<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  const navigation = [
    { id: 'provider', title: 'I18nProvider', order: 1 },
    { id: 'use-i18n', title: 'useI18n()', order: 2 },
    { id: 'contract', title: 'Read / Write', order: 3 },
    { id: 'switching', title: 'Switching & Persistence', order: 4 },
    { id: 'root-layout', title: 'Root-Layout Chrome', order: 5 },
    { id: 'ssr', title: 'SSR Resolution', order: 6 },
    { id: 'errors', title: 'Error Handling', order: 7 },
    { id: 'coexistence', title: 'Coexistence', order: 8 }
  ];

  const providerProps = [
    [
      'locale',
      'Locale',
      "'en'",
      'Active locale — the single request-scoped i18n value. Provide it from server-resolved state so SSR and hydration agree. May be a controlled (reactive) value; prop changes sync into the state.'
    ],
    ['fallbackLocale', 'Locale', "'en'", 'Locale used when a key is missing in the active locale.'],
    [
      'onLocaleChange',
      '(locale: Locale) => void',
      '—',
      'Fired when the effective locale changes — via setLocale() or a locale-prop change. The place to persist the choice (write the cookie resolveLocale reads).'
    ],
    ['children', 'Snippet', '—', 'The subtree that reads i18n.']
  ];

  const apiMembers = [
    ['locale', 'Locale (readonly)', 'Active locale, reactive. Base locale without a provider.'],
    [
      'availableLocales',
      'Locale[] (readonly)',
      'Locales with registered data or a loader, reactive.'
    ],
    ['isLoading', 'boolean (readonly)', 'Whether a lazy locale load is in flight.'],
    [
      'setLocale',
      '(locale) => boolean',
      'Switch the active locale in place. Throws without a provider.'
    ],
    ['t', '(key, params?, options?) => string', 'Translate a key against the active locale.'],
    [
      'plural',
      '(key, params, options?) => string',
      'CLDR-correct plural selection via Intl.PluralRules.'
    ],
    ['exists', '(key, packageName?) => boolean', 'Whether a key resolves in the active locale.'],
    ['formatNumber', '(value, options?) => string', 'Locale-aware Intl.NumberFormat.'],
    ['formatDate', '(date, options?) => string', 'Locale-aware Intl.DateTimeFormat.'],
    ['formatRelativeTime', '(value, unit) => string', 'Locale-aware Intl.RelativeTimeFormat.'],
    ['formatTimeAgo', '(date) => string', 'Relative "time ago" string from a Date.']
  ];

  const providerCode =
    `<!-- +layout.svelte -->
<` +
    `script>
  import { I18nProvider } from '@urbicon-ui/i18n';
  let { data, children } = $props();
</` +
    `script>

<I18nProvider locale={data.locale} fallbackLocale="en">
  {@render children()}
</I18nProvider>`;

  const useCode =
    `<` +
    `script>
  import { useI18n } from '@urbicon-ui/i18n';
  // Capture during component init; reads are reactive at call time.
  const i18n = useI18n();
</` +
    `script>

<p>{i18n.t('greeting', { name: 'Ada' })}</p>
<button onclick={() => i18n.setLocale('de')}>Deutsch</button>`;

  const switchCode =
    `<` +
    `script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</` +
    `script>

<!-- setLocale mutates the request-scoped state and re-renders in place — no reload -->
<button onclick={() => i18n.setLocale('de')}>Deutsch</button>`;

  const persistCode = `<!-- Persist the choice so the NEXT SSR request renders it -->
<I18nProvider
  locale={data.locale}
  onLocaleChange={(l) =>
    (document.cookie = \`urbicon-locale=\${l}; path=/; max-age=31536000; samesite=lax\`)}
>
  {@render children()}
</I18nProvider>`;

  const rootLayoutCode =
    `<!-- +layout.svelte — the SAME component both provides i18n and renders chrome -->
<` +
    `script>
  import { provideI18n, useI18n } from '@urbicon-ui/i18n';
  let { data, children } = $props();

  // A child <I18nProvider> can't serve the parent that mounts it (context only
  // flows downward). Call provideI18n in this component's own script instead.
  provideI18n(() => data.locale); // reactive getter → controlled by the load fn
  const i18n = useI18n();
</` +
    `script>

<header>{i18n.t('chrome.appTitle')}</header>
{@render children()}`;

  const resolveCode = `// +layout.server.ts
import { resolveLocale } from '@urbicon-ui/i18n';

export const load = ({ request }) => ({
  // Cookie → Accept-Language → default. Framework-agnostic: pass a Request
  // or a { cookie, acceptLanguage } object.
  locale: resolveLocale(request, {
    supportedLocales: ['en', 'de'], // defaults to locales the registry has data for
    defaultLocale: 'en',
    cookieName: 'urbicon-locale'
  })
});`;

  const prerenderCode =
    `// Fully prerendered (static) sites have no per-request server.
// Resolve on the client after mount instead — the provider's base-locale-first
// render keeps hydration stable, then setLocale swaps in the stored choice.
<` +
    `script>
  import { I18nProvider, useI18n } from '@urbicon-ui/i18n';
  // ...read a cookie / localStorage on mount, then i18n.setLocale(stored)
</` +
    `script>`;

  const errorCode = `// app entry / root setup — call ONCE at startup, never per-request
import { configureI18n } from '@urbicon-ui/i18n';

configureI18n({
  onError: (e) => {
    // e.type: 'load-failed' | 'load-failed-no-fallback' | 'unsupported-locale'
    reportToSentry(e);
  }
});`;

  const coexistCode =
    `<!-- +layout.svelte — make Urbicon's provider FOLLOW the app's locale -->
<` +
    `script>
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { getLocale } from '$lib/paraglide/runtime'; // app's reactive locale
  let { children } = $props();
</` +
    `script>

<!-- getLocale() is reactive → the provider re-syncs when the app switches language -->
<I18nProvider locale={getLocale()}>
  {@render children()}
</I18nProvider>`;
</script>

<SeoMeta
  title="Provider & SSR - Localization"
  description="I18nProvider, the useI18n() API, locale switching and persistence, server-side locale resolution, error handling, and coexisting with an app-level i18n."
/>

<DocsPageLayout
  title="Provider & SSR"
  description="Mount one provider, read through useI18n(), and resolve the locale per request so server and client agree."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Localization', href: resolve('/i18n') }]}
>
  <Section id="provider" title="I18nProvider">
    <p class="text-text-secondary mb-4">
      One provider at the app root holds the single request-scoped locale state. Feed it a
      server-resolved <code>locale</code> so the first client render matches the server.
    </p>
    <CodeExample code={providerCode} language="svelte" preview={false} />

    <div class="border-border-subtle mt-4 overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-subtle border-border-subtle border-b">
            <th class="text-text-primary px-4 py-2 text-left font-medium">Prop</th>
            <th class="text-text-primary px-4 py-2 text-left font-medium">Type</th>
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium sm:table-cell"
              >Default</th
            >
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium md:table-cell"
              >Description</th
            >
          </tr>
        </thead>
        <tbody>
          {#each providerProps as [name, type, def, desc] (name)}
            <tr class="border-border-subtle border-b last:border-0">
              <td class="text-text-primary px-4 py-2 font-mono text-xs">{name}</td>
              <td class="text-text-secondary px-4 py-2 font-mono text-xs">{type}</td>
              <td class="text-text-tertiary hidden px-4 py-2 font-mono text-xs sm:table-cell"
                >{def}</td
              >
              <td class="text-text-tertiary hidden px-4 py-2 text-xs md:table-cell">{desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Section>

  <Section id="use-i18n" title="useI18n()">
    <p class="text-text-secondary mb-4">
      The general hook for locale control and locale-aware formatting. Call it during component init
      and capture the result; every member reads the context locale at call time, so wrapping a read
      in markup or <code>$derived</code> re-renders on a locale switch.
    </p>
    <CodeExample code={useCode} language="svelte" preview={false} />

    <div class="border-border-subtle mt-4 overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-subtle border-border-subtle border-b">
            <th class="text-text-primary px-4 py-2 text-left font-medium">Member</th>
            <th class="text-text-primary px-4 py-2 text-left font-medium">Signature</th>
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium md:table-cell"
              >Description</th
            >
          </tr>
        </thead>
        <tbody>
          {#each apiMembers as [name, sig, desc] (name)}
            <tr class="border-border-subtle border-b last:border-0">
              <td class="text-text-primary px-4 py-2 font-mono text-xs">{name}</td>
              <td class="text-text-secondary px-4 py-2 font-mono text-xs">{sig}</td>
              <td class="text-text-tertiary hidden px-4 py-2 text-xs md:table-cell">{desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Section>

  <Section id="contract" title="Read-tolerant, write-strict">
    <p class="text-text-secondary mb-4">
      The contract that lets components ship before a consumer wires up i18n, while still catching a
      real bug:
    </p>
    <ul class="text-text-secondary mb-4 space-y-2 text-sm">
      <li>
        <strong class="text-text-primary">Reading</strong> (<code>locale</code>, <code>t</code>,
        formatters) without a provider resolves against the constant base locale (<code>en</code>) —
        SSR-safe, identical on server and client.
      </li>
      <li>
        <strong class="text-text-primary">Writing</strong> (<code>setLocale</code>) without a
        provider
        <strong>throws</strong>. There is no request-scoped state to change — the error names the
        fix (mount <code>&lt;I18nProvider&gt;</code>).
      </li>
    </ul>
    <p class="text-text-tertiary text-xs">
      <code>setLocale</code> returns <code>false</code> (and reports
      <code>unsupported-locale</code>) for a locale outside <code>SUPPORTED_LOCALES</code>, without
      switching; otherwise it switches and returns <code>true</code>.
    </p>
  </Section>

  <Section id="switching" title="Switching & Persistence">
    <p class="text-text-secondary mb-4">
      <code>setLocale</code> mutates the request-scoped state and re-renders reactively in place —
      no reload. The built-in
      <a class="text-primary hover:underline" href={resolve('/blocks/components/locale-switcher')}
        >LocaleSwitcher</a
      > does this for you; programmatically:
    </p>
    <CodeExample code={switchCode} language="svelte" preview={false} />

    <p class="text-text-secondary mt-6 mb-2">
      An in-place switch lasts only for the current page session. To make the choice survive the
      next SSR request, persist it where <code>resolveLocale</code> reads — the provider's
      <code>onLocaleChange</code> is the hook:
    </p>
    <CodeExample code={persistCode} language="svelte" preview={false} />
  </Section>

  <Section id="root-layout" title="Root-layout chrome that itself is translated">
    <p class="text-text-secondary mb-4">
      A child <code>&lt;I18nProvider&gt;</code> can't serve the parent that mounts it — context only
      flows downward. When the <strong>same</strong> root component both provides i18n and renders
      translated chrome (header/footer), call <code>provideI18n</code> in its own script. Pass a
      reactive getter (<code>() =&gt; data.locale</code>) to keep it controlled: a load change flows
      in, while an in-place <code>setLocale</code> switch is never clobbered.
    </p>
    <CodeExample code={rootLayoutCode} language="svelte" preview={false} />
  </Section>

  <Section id="ssr" title="SSR — resolving the initial locale">
    <p class="text-text-secondary mb-4">
      <code>resolveLocale</code> derives the request's locale server-side from the persisted cookie,
      then <code>Accept-Language</code>, then a default. It is framework-agnostic — pass a
      <code>Request</code> or a <code>{'{ cookie, acceptLanguage }'}</code> object. Feed the result
      to the provider so SSR and the first client render agree (no hydration mismatch, no
      <code>navigator.language</code> guess).
    </p>
    <CodeExample code={resolveCode} language="typescript" preview={false} />

    <p class="text-text-secondary mt-6 mb-2">
      Fully prerendered (static) sites have no per-request server, so resolve on the client after
      mount instead:
    </p>
    <CodeExample code={prerenderCode} language="svelte" preview={false} />
  </Section>

  <Section id="errors" title="Error Handling">
    <p class="text-text-secondary mb-4">
      Loader failures and unsupported-locale switches default to <code>console.warn</code>. Route
      them to telemetry with an app-global handler — set <strong>once at startup</strong> (it lives on
      the process-wide registry; a per-request assignment would race under concurrent SSR).
    </p>
    <CodeExample code={errorCode} language="typescript" preview={false} />
  </Section>

  <Section id="coexistence" title="Coexisting with an app-level i18n (e.g. Paraglide)">
    <p class="text-text-secondary mb-4">
      If your app already uses Paraglide (or any other i18n) for its <strong>own</strong> strings,
      don't run two locale states — make Urbicon's provider <em>follow</em> the app's locale. Pass the
      app-i18n locale into the provider as a controlled (reactive) value:
    </p>
    <CodeExample code={coexistCode} language="svelte" preview={false} />

    <p class="text-text-tertiary mt-3 text-xs">
      When the app switches language, <code>getLocale()</code> updates, the provider's
      controlled-sync pushes it into Urbicon's state, and every Urbicon component re-renders — one
      switch, both layers. If you also expose an Urbicon <code>&lt;LocaleSwitcher&gt;</code>, route
      its
      <code>onLocaleChange</code> back into the app's <code>setLocale</code> so the two never
      diverge. Map locale codes if they differ (e.g. Paraglide <code>en-US</code> → Urbicon
      <code>en</code>).
    </p>
  </Section>
</DocsPageLayout>
