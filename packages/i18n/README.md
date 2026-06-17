# @urbicon-ui/i18n

Svelte 5 runes-based internationalization. SSR-correct, package-scoped, type-safe, zero runtime dependencies.

## Why a custom i18n package

Urbicon UI is zero-dependency by design, and existing i18n libraries either predate Svelte 5 runes (`svelte-i18n`), ship a large generic runtime (`i18next`), or compile per-app and so can't ship as a reusable component-library locale source (Paraglide). This package provides exactly what the design system needs: reactive translations via `$state`/`$derived`, a **request-scoped** locale (correct under SSR), and a registry each Urbicon package (blocks, table, auth) plugs into.

The locale lives in **context**, not a module-global singleton — so concurrent SSR requests with different locales never leak into each other. Static translation data stays module-global (it's request-identical); only the mutable active locale is per-request.

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

Peer dependencies: `svelte` (^5.40 — uses runes + `createContext`-era context), `@sveltejs/kit`.

## Quick Start

**1. Mount one provider at your app root** and feed it the initial locale.

```svelte
<!-- +layout.svelte -->
<script>
  import { I18nProvider } from '@urbicon-ui/i18n';
  let { data, children } = $props();
</script>

<I18nProvider locale={data.locale}>
  {@render children()}
</I18nProvider>
```

```ts
// +layout.server.ts — resolve the locale per request (SSR), cookie + Accept-Language
import { resolveLocale } from '@urbicon-ui/i18n';
export const load = ({ request }) => ({ locale: resolveLocale(request) });
```

**2. Read translations in components through a hook** — `useI18n()` for the global surface, or a package's `use<Package>I18n()` for its typed keys.

```svelte
<script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</script>

<p>{i18n.t('greeting', { name: 'Ada' })}</p><p>{i18n.formatNumber(1234.5)}</p>
```

Without a provider, reads resolve against the **base locale** (`en`) — a `<Button>` renders its ARIA strings out of the box, SSR-safe, no setup. Switching the locale (below) requires a provider.

## Read-tolerant, write-strict

- **Reading** without a provider → the constant base locale (`en`). Zero-config, SSR-safe, identical on server and client (no hydration mismatch).
- **Writing** (`setLocale`) without a provider → **throws**. There is no request-scoped state to mutate — you forgot the provider. Loud by design.

## Locale switching

`setLocale` mutates the request-scoped state and re-renders reactively in place (no reload). The built-in `<LocaleSwitcher>` (from `@urbicon-ui/blocks`) does this for you; programmatically:

```svelte
<script>
  import { useI18n } from '@urbicon-ui/i18n';
  const i18n = useI18n();
</script>

<button onclick={() => i18n.setLocale('de')}>Deutsch</button>
```

Persist the choice so the next SSR request renders it — the provider's `onLocaleChange` is the hook (write the cookie `resolveLocale` reads):

```svelte
<I18nProvider
  locale={data.locale}
  onLocaleChange={(l) =>
    (document.cookie = `urbicon-locale=${l}; path=/; max-age=31536000; samesite=lax`)}
>
  {@render children()}
</I18nProvider>
```

### Root layout that itself renders translated chrome

A child `<I18nProvider>` can't serve the parent that mounts it (context only flows downward). When the **same** root component both provides i18n and renders translated chrome (header/footer), call `provideI18n` in its own script instead:

```svelte
<script>
  import { provideI18n, useI18n } from '@urbicon-ui/i18n';
  let { data, children } = $props();
  provideI18n(() => data.locale); // controlled by the load function
  const i18n = useI18n();
</script>

<header>{i18n.t('chrome.appTitle')}</header>
{@render children()}
```

## Package-scoped translations

Each Urbicon package registers its own namespaced keys so consumers get a merged, consistent translation surface without collisions. The factory returns a **hook**, `useTranslate`, re-exported as `use<Package>I18n`:

```ts
// Inside @urbicon-ui/blocks — src/lib/i18n/index.ts
import { createPackageI18n } from '@urbicon-ui/i18n';
import en from '../translations/en';
import de from '../translations/de';

export const blocksI18n = createPackageI18n('blocks', { en, de });

// The context-scoped hook (re-exported for components)
export const useBlocksI18n = blocksI18n.useTranslate;
```

```svelte
<!-- In a blocks component -->
<script>
  import { useBlocksI18n } from '$lib';
  const bt = useBlocksI18n(); // call during component init
</script>

<button aria-label={bt('dialog.close')}>×</button>
```

`bt('dialog.close')` reads the context locale **at call time**, so wrapping it in markup / `$derived` re-renders on locale change. Resolution falls back to the package's base locale, then the global namespace.

## Type-safe keys

`createPackageI18n` is generic over the `en` bundle: with `as const` (or a plain literal object) the key **and** parameter types flow straight through to the hook's `t`, so keys autocomplete and typos are compile errors.

```ts
const en = {
  dialog: { close: 'Close' },
  greeting: 'Hello {{name}}'
} as const;

const blocks = createPackageI18n('blocks', { en /*, de */ });
const t = blocks.useTranslate(); // inside a component

t('dialog.close'); // ✓ autocompletes
t('dialog.nonexistent'); // ✗ compile error — unknown key
t('greeting', { name: 'Ada' }); // ✓ param `name` inferred from {{name}}
t('greeting'); // ✗ compile error — missing required param
```

Additional **eager** locales are checked against the `en` structure, so a missing or misspelled key in `de` is a compile error too (key parity by construction). For **lazy** locales (below) parity is a runtime check — pair with `validatePackageTranslations` in a test.

> `createTypedPackage` is **deprecated** — `createPackageI18n` gives the same type safety directly.

## Pluralization

`useI18n().plural` selects the CLDR category via `Intl.PluralRules` (correct for any BCP-47 locale). Provide a `<key>_plural` entry as a JSON object of categories:

```ts
// translations
{ apple: '{{count}} apple', apple_plural: '{"one":"{{count}} apple","other":"{{count}} apples"}' }
```

```svelte
<script>
  const i18n = useI18n();
</script>

<span>{i18n.plural('apple', { count: 3 })}</span> <!-- 3 apples -->
```

Plural rules follow [Unicode CLDR](https://cldr.unicode.org/index/cldr-spec/plural-rules); `en`/`de` collapse to `one`/`other`, Slavic locales add `few`/`many`, Arabic uses the full set. Without a `_plural` object the base string is returned as-is (fail-honest — no anglocentric `+'s'` guessing).

## SSR — resolving the initial locale

`resolveLocale` derives the request's locale server-side from the persisted cookie, then `Accept-Language`, then a default. Framework-agnostic (`Request` or a `{ cookie, acceptLanguage }` object):

```ts
import { resolveLocale } from '@urbicon-ui/i18n';

resolveLocale(request); // -> 'de'
resolveLocale(request, {
  supportedLocales: ['en', 'de'],
  defaultLocale: 'en',
  cookieName: 'urbicon-locale'
});
```

`supportedLocales` defaults to the locales the registry actually has data for. Feed the result to `<I18nProvider locale={…}>` so SSR and the first client render agree (no hydration mismatch, no `navigator.language` guess).

> Fully **prerendered** (static) sites have no per-request server, so resolve the locale on the client after mount instead (read a cookie/`localStorage`, then `setLocale`). The provider's base-locale-first render keeps hydration stable.

## Locale code-splitting (opt-in)

By default a package registers all its locale bundles eagerly. To keep non-base locales out of the initial bundle, register them as dynamic-import loaders — the base/fallback locale stays eager, the rest load on activation:

```ts
export const blocksI18n = createPackageI18n(
  'blocks',
  { en }, // eager base
  {
    loaders: {
      de: () => import('../translations/de').then((m) => m.default),
      fr: () => import('../translations/fr').then((m) => m.default)
    }
  }
);
```

Vite/Rollup splits each dynamic import into its own chunk, so only the active locale is in the initial bundle. The provider loads the active + fallback locale on mount; `setLocale` loads a target on switch. A lazy non-base initial locale renders the fallback until its chunk lands, then re-resolves reactively. Worth it past a handful of locales; eager is simpler for `en`/`de`.

## Coexisting with an app-level i18n (e.g. Paraglide)

If your app uses Paraglide (or any other i18n) for its **own** strings, you don't run two locale states — you make Urbicon's provider follow the app's locale. Pass the app-i18n locale into the provider as a controlled (reactive) value:

```svelte
<!-- +layout.svelte -->
<script>
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { getLocale } from '$lib/paraglide/runtime'; // Paraglide's reactive locale
  let { children } = $props();
</script>

<!-- getLocale() is reactive → the provider re-syncs when the app switches language -->
<I18nProvider locale={getLocale()}>
  {@render children()}
</I18nProvider>
```

When the app switches language (Paraglide's `setLocale`), `getLocale()` updates, the provider's controlled-sync pushes it into Urbicon's state, and every Urbicon component re-renders in the new language — one switch, both layers. (If you also expose an Urbicon `<LocaleSwitcher>`, route its `onLocaleChange` back into the app's `setLocale` so the two never diverge.)

> Map locale codes if they differ between systems (e.g. Paraglide `en-US` → Urbicon `en`) before passing them in.

## Error handling

Loader failures and unsupported-locale switches default to `console.warn`. Route them to telemetry by configuring an app-global handler **once at startup** (it lives on the process-wide registry — do not set it per request):

```ts
import { configureI18n } from '@urbicon-ui/i18n';
configureI18n({ onError: (e) => reportToSentry(e) });
```

## Parity validation (CI)

`validatePackageTranslations` does a recursive deep-key diff across a package's locale bundles (a missing nested key is an error, an extra one a warning). Wire it into a per-package vitest test to fail CI on drift — it complements the compile-time parity the generic factory enforces for eager bundles, and covers lazy/dynamic ones:

```ts
import { validatePackageTranslations } from '@urbicon-ui/i18n';
import { blocksTranslations } from '$lib/i18n';

it('en/de key parity', () => {
  expect(validatePackageTranslations('blocks', blocksTranslations).errors).toEqual([]);
});
```

## API Surface

```ts
// Provider + hooks + server helper
import {
  I18nProvider, // <I18nProvider locale fallbackLocale? onLocaleChange?>
  provideI18n, // provide from a component's own script (root layouts)
  useI18n, // { locale, setLocale, availableLocales, isLoading, t, plural, exists, formatNumber, ... }
  configureI18n, // app-global error sink
  resolveLocale, // server-side initial-locale resolution
  T, // <T key params? fallback? package? />
  BASE_LOCALE, // 'en'
  SUPPORTED_LOCALES,
  isLocaleSupported
} from '@urbicon-ui/i18n';

// Package integration
import {
  createPackageI18n, // (name, { en }, { loaders }?) -> { useTranslate, t, exists, getLocales, ... }
  createComponentI18n,
  registerTranslationLoaders,
  registerPackages,
  validatePackageTranslations
} from '@urbicon-ui/i18n';

// Deep-key utilities + types
import { getDeepValue, hasDeepKey, collectDeepKeys } from '@urbicon-ui/i18n';
import type {
  Locale,
  I18nApi,
  PackageI18n,
  CreatePackageI18nOptions,
  I18nConfigureOptions,
  LocaleSource,
  ResolveLocaleOptions,
  TranslationParams,
  TranslationOptions,
  PluralParams,
  PluralRules,
  TypedTranslationFunction,
  DeepKeys,
  DeepValue
} from '@urbicon-ui/i18n';
```

> **Breaking (major):** the pre-WP2 module singleton (`i18n`, the free `t` / `plural`, `I18nService`) was **removed** — it leaked the locale across SSR requests. Mount `<I18nProvider>` / `provideI18n` and read through the hooks; replace `i18n.t(k)` → `useI18n().t(k)`, `bt(k)` → `const bt = useBlocksI18n()`.

## Supported Locales (Core)

`en`, `de` ship data. `fr`, `es`, `it`, `nl` are declared target locales (in the `Locale` union / `SUPPORTED_LOCALES`) — register your own bundles for them via `createPackageI18n`.

## Development

```bash
bun --filter='@urbicon-ui/i18n' run dev        # svelte-package watch
bun --filter='@urbicon-ui/i18n' run build      # svelte-package
bun --filter='@urbicon-ui/i18n' run test:run   # vitest
```

## Related

- [`@urbicon-ui/blocks`](../blocks/) — consumes this package; exports `useBlocksI18n`, `<LocaleSwitcher>`
- [`@urbicon-ui/table`](../table/) — ships its own namespace (`table.*`), exports `useTableI18n`
- [`@urbicon-ui/auth`](../auth/) — ships EN/DE bundles; exports `useAuthLocale`
- [Architecture Overview](../../docs/ARCHITECTURE.md#i18n-system)

```

```
