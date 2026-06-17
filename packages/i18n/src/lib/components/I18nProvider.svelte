<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { provideI18n } from '$lib/i18n/context.svelte';
  import type { Locale } from '$lib/i18n/types';

  interface I18nProviderProps {
    /**
     * Active locale. The single request-scoped i18n value — provide it from
     * server-resolved state (cookie/Accept-Language via `resolveLocale`) so SSR
     * and hydration agree. May be a reactive (controlled) value; prop changes are
     * synced into the internal state.
     * @default 'en'
     */
    locale?: Locale;
    /**
     * Locale used when a key is missing in the active locale.
     * @default 'en'
     */
    fallbackLocale?: Locale;
    /**
     * Fired when the *effective* locale changes — both via `setLocale()`
     * (LocaleSwitcher, programmatic) and via a `locale`-prop change. The place to
     * persist the choice (e.g. write the locale cookie that `resolveLocale` reads
     * on the next request).
     */
    onLocaleChange?: (locale: Locale) => void;
    children: Snippet;
  }

  let {
    locale = 'en',
    fallbackLocale = 'en',
    onLocaleChange,
    children
  }: I18nProviderProps = $props();

  // One reactive state object per provider instance → per request tree on the
  // server. This is what makes concurrent SSR requests with different locales
  // render independently: no module-global mutable locale is involved. provideI18n
  // creates + provides the state and keeps it in controlled sync with the
  // `locale` prop (an in-place setLocale switch is never clobbered).
  const state = provideI18n(
    () => locale,
    untrack(() => fallbackLocale)
  );

  // Notify on effective-locale change (from either source), skipping the initial
  // value. Tracks `state.locale`; the bookkeeping is untracked so it adds no
  // dependencies and never loops.
  let lastNotified = untrack(() => locale);
  $effect(() => {
    const current = state.locale;
    untrack(() => {
      if (current !== lastNotified) {
        lastNotified = current;
        onLocaleChange?.(current);
      }
    });
  });
</script>

{@render children()}
