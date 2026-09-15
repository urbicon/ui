import {
  collectDeepKeys,
  isLocaleSupported,
  type Locale,
  SUPPORTED_LOCALES,
  useI18n
} from '@urbicon-ui/i18n';
import { en } from './en.js';
import type { AuthLocale, DeepPartial, PartialAuthLocale } from './keys.js';

/**
 * The bundles this app has, keyed by locale. **Only `en` is built in** — every
 * other locale enters through {@link registerAuthLocale} plus its own subpath
 * import (`@urbicon-ui/auth/i18n/de`), so an app shipping one language does not
 * carry the others: a static `{ en, de }` object read by a runtime key is
 * something no bundler can narrow, and every auth component would carry both.
 *
 * Module-global, and SSR-safe as such: it holds static, request-identical
 * translation data and no per-request state, so one registration at server start
 * serves every concurrent request. The request-scoped part — *which* locale is
 * active — stays in `<I18nProvider>`'s context, where `useAuthLocale` reads it.
 *
 * Reactive, and **reassigned** rather than mutated: every component reads its
 * bundle inside a `$derived`, and a property written into a plain object is a
 * change no `$derived` can see, so a registration after mount would leave the
 * mounted tree in the old language. `$state.raw` tracks the binding, not the
 * bundle's interior — which is what this holds: whole immutable bundles.
 *
 * `en` is required in the type rather than looked up defensively: it is the
 * fallback every other lookup lands on, so its absence must not be
 * representable. The shipped bundles are `satisfies AuthLocale` (literal
 * structure preserved + parity enforced between en/de).
 */
type AuthLocaleRegistry = Partial<Record<Locale, AuthLocale>> & { en: AuthLocale };

let registry = $state.raw<AuthLocaleRegistry>({ en });

/**
 * Make an `AuthLocale` bundle available to every auth component and to the
 * server-side mail builders, paired with the locale's subpath import:
 *
 * ```ts
 * import { registerAuthLocale } from '@urbicon-ui/auth';
 * import { de } from '@urbicon-ui/auth/i18n/de';
 * registerAuthLocale('de', de);
 * ```
 *
 * **At app start** is the recommendation, not a requirement: the registry is
 * reactive, so a registration after mount re-renders the components that are
 * already on screen. Registering at start is what makes the *first* server
 * render already correct — put the lines in a module that both the server and
 * the client evaluate (e.g. a `src/lib/locales.ts` imported from
 * `hooks.server.ts` **and** from the root `+layout.ts`), or a locale registered
 * on only one side renders German HTML that hydrates into English.
 *
 * Only `en` is built in; without a registration an auth component under
 * `<I18nProvider locale="de">` renders English. Registering `en` replaces the
 * built-in English bundle — the way to restyle the whole surface at once rather
 * than per component through the `t` prop. It replaces rather than merges, so
 * build the full bundle from the shipped one:
 *
 * ```ts
 * import { en } from '@urbicon-ui/auth/i18n/en';
 * registerAuthLocale('en', mergeAuthLocale(en, { auth: { login: { title: 'Welcome back' } } }));
 * ```
 *
 * Write-strict, because a bundle that is wrong here is wrong for every
 * component at once: throws on a locale `@urbicon-ui/i18n` does not support, on
 * a non-object bundle, and on a bundle missing any key the built-in `en` has.
 * TypeScript already refuses an incomplete literal, but a JSON file, a
 * JavaScript caller and an `as AuthLocale` cast do not — and a partial bundle
 * under `en` would make every other locale's fallback throw at render.
 */
export function registerAuthLocale(locale: Locale, bundle: AuthLocale): void {
  if (!isLocaleSupported(locale)) {
    throw new Error(
      `[auth] registerAuthLocale: unsupported locale "${String(locale)}". ` +
        `Supported: ${SUPPORTED_LOCALES.join(', ')}.`
    );
  }
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    const kind = bundle === null ? 'null' : Array.isArray(bundle) ? 'array' : typeof bundle;
    throw new Error(
      `[auth] registerAuthLocale("${locale}"): bundle must be an AuthLocale object, got ${kind}.`
    );
  }
  // `collectDeepKeys` takes an index-signature record; `AuthLocale` is a closed
  // interface, which has none. Same shape, so the widening is safe.
  const asRecord = (b: AuthLocale) => b as unknown as Record<string, unknown>;
  const present = new Set(collectDeepKeys(asRecord(bundle)));
  const missing = collectDeepKeys(asRecord(en)).filter((key) => !present.has(key));
  if (missing.length > 0) {
    throw new Error(
      `[auth] registerAuthLocale("${locale}"): the bundle is missing ${missing.length} key(s) the ` +
        `built-in English bundle has: ${missing.join(', ')}. Build it from a complete one — ` +
        `mergeAuthLocale(en, overrides) — or pass the overrides as a component's \`t\` prop instead.`
    );
  }
  // Reassign: a property write into the previous object is invisible to the
  // `$derived` every component reads its bundle through.
  registry = { ...registry, [locale]: bundle };
}

/** Whether `locale` has a bundle — `en` always does. Internal: not a package export. */
export function hasAuthLocale(locale: Locale): boolean {
  return registry[locale] !== undefined;
}

/**
 * Context-scoped hook for the full AuthLocale object at the active locale. Call
 * during component initialisation, then read it inside a `$derived` so it stays
 * reactive and resolves against the nearest `<I18nProvider>`:
 *
 * ```svelte
 * const authLocale = useAuthLocale();
 * const t = $derived(mergeAuthLocale(authLocale(), tProp));
 * ```
 *
 * Resolves to the bundle registered for the provider's locale, or to English
 * when that locale has none — {@link registerAuthLocale} is how a locale other
 * than `en` gets one. Read inside a `$derived` as above, a registration that
 * lands after the component mounted re-renders it; read once into a `const`, it
 * does not.
 *
 * Replaces the former free `getAuthLocale()`, which read the global locale
 * singleton and so could not be request-scoped (SSR-unsafe).
 */
export function useAuthLocale(): () => AuthLocale {
  const i18n = useI18n();
  return () => registry[i18n.locale] ?? registry.en;
}

/**
 * Resolve the full `AuthLocale` bundle for a locale **without** any Svelte
 * context — the SSR-/server-safe counterpart to {@link useAuthLocale}. Used by
 * the server-side email builders to localize the default transactional mails
 * from `config.email.locale`. Falls back to the English bundle when `locale` is
 * omitted or has no registered bundle, so callers never have to guard; the mail
 * path additionally warns once when a configured locale turns out to have none.
 * See {@link registerAuthLocale} for how a locale gets one.
 */
export function resolveAuthLocale(locale?: Locale): AuthLocale {
  if (!locale) return registry.en;
  return registry[locale] ?? registry.en;
}

/**
 * Deep-merge consumer locale `overrides` over a complete `base` bundle — THE
 * single place a `PartialAuthLocale` becomes a full `AuthLocale`.
 * Every component resolves its `t` prop through this, so overriding one string
 * (`{ auth: { login: { title: 'Welcome back' } } }`) keeps every other key from
 * the active bundle instead of blanking whole subtrees. Objects merge
 * recursively, string leaves replace, `undefined` entries are skipped. Returns
 * `base` itself when there is nothing to merge.
 *
 * Kind-preserving: an entry whose kind mismatches the base (`null`/array/
 * primitive where the bundle has a subtree, an object where it has a string)
 * is skipped, keeping the base value. TypeScript rules those out, but JSON is
 * the natural carrier for consumer override files and cannot express
 * `undefined` — a hand-written `null` must not blank a whole subtree the
 * postcondition promises to be complete.
 */
export function mergeAuthLocale(base: AuthLocale, overrides?: PartialAuthLocale): AuthLocale {
  if (!overrides) return base;
  return deepMerge(base, overrides) as AuthLocale;
}

function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (value === undefined) continue;
    // Assigning these would reparent `out` / clobber intrinsics instead of
    // storing data (JSON.parse can hand us own-enumerable `__proto__` keys).
    if (key === '__proto__' || key === 'constructor') continue;
    const baseValue = (base as Record<string, unknown>)[key];
    if (baseValue !== null && typeof baseValue === 'object') {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        out[key] = deepMerge(baseValue as object, value as DeepPartial<object>);
      }
      // kind mismatch (null/array/primitive over a subtree): keep the base
      continue;
    }
    if (typeof value === 'string') out[key] = value;
    // kind mismatch (object/null/number over a string leaf): keep the base
  }
  return out as T;
}

export type { AuthLocale, DeepPartial, PartialAuthLocale } from './keys.js';
