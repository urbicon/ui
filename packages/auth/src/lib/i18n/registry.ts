import type { Locale } from '@urbicon-ui/i18n';
import { createSubscriber } from 'svelte/reactivity';
import { en } from './en.js';
import type { AuthLocale } from './keys.js';

/**
 * The bundles this app has, keyed by locale. **Only `en` is built in** — every
 * other locale enters through `registerAuthLocale` plus its own subpath import
 * (`@urbicon-ui/auth/i18n/de`), so an app shipping one language does not carry
 * the others: a static `{ en, de }` object read by a runtime key is something
 * no bundler can narrow, and every auth component would carry both.
 *
 * Module-global, and SSR-safe as such: it holds static, request-identical
 * translation data and no per-request state, so one registration at server start
 * serves every concurrent request. The request-scoped part — *which* locale is
 * active — stays in `<I18nProvider>`'s context, where `useAuthLocale` reads it.
 *
 * A plain module, not a runes one, and it imports nothing that is: the mail
 * builders read it from behind `@urbicon-ui/auth/server`, which has to load in
 * a process without the Svelte compiler — `svelte-package` ships a `.svelte.js`
 * module with its runes uncompiled. Components still re-render on a
 * registration after mount: a read inside a `$derived` or an effect subscribes
 * that reader, and every write invalidates the subscribers. Elsewhere — on the
 * server, in a script — `svelte/reactivity` resolves to its server build and
 * the subscription does nothing.
 *
 * `en` is required in the type rather than looked up defensively: it is the
 * fallback every other lookup lands on, so its absence must not be
 * representable. The shipped bundles are `satisfies AuthLocale` (literal
 * structure preserved + parity enforced between en/de).
 */
type AuthLocaleRegistry = Partial<Record<Locale, AuthLocale>> & { en: AuthLocale };

const registry: AuthLocaleRegistry = { en };

let invalidate: (() => void) | undefined;
const subscribe = createSubscriber((update) => {
  invalidate = update;
  return () => {
    invalidate = undefined;
  };
});

/**
 * Put `bundle` under `locale` and re-render whatever read the registry.
 * Unchecked — `registerAuthLocale` is the write-strict public entry, and it
 * stays out of this module because its checks come from `@urbicon-ui/i18n`:
 * the root entry ships Svelte components Node cannot load, and the subpath
 * that re-exports the checks without them, `/audit`, is documented as dev-only,
 * which a server runtime dependency on it would contradict. Internal: not a
 * package export.
 */
export function storeAuthLocale(locale: Locale, bundle: AuthLocale): void {
  registry[locale] = bundle;
  invalidate?.();
}

/** Whether `locale` has a bundle — `en` always does. Internal: not a package export. */
export function hasAuthLocale(locale: Locale): boolean {
  subscribe();
  return registry[locale] !== undefined;
}

/**
 * Resolve the full `AuthLocale` bundle for a locale **without** any Svelte
 * context — the SSR-/server-safe counterpart to `useAuthLocale`, which reads
 * through this. Used by the server-side email builders to localize the default
 * transactional mails from `config.email.locale`. Falls back to the English
 * bundle when `locale` is omitted or has no registered bundle, so callers never
 * have to guard; the mail path additionally warns once when a configured locale
 * turns out to have none. `registerAuthLocale` is how a locale gets one.
 */
export function resolveAuthLocale(locale?: Locale): AuthLocale {
  subscribe();
  if (!locale) return registry.en;
  return registry[locale] ?? registry.en;
}
