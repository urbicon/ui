<script lang="ts">
  import { useI18n } from '$lib/i18n/context.svelte';
  import type { TranslationParams, TranslationOptions } from '$lib/i18n/types';

  interface TProps {
    key: string;
    params?: TranslationParams;
    fallback?: string;
    package?: string;
    options?: TranslationOptions;
  }

  let { key, params, fallback, package: packageName, options }: TProps = $props();

  // Resolves against the request-scoped locale from the nearest <I18nProvider>,
  // or the base locale when none is mounted (read-tolerant). Captured at init.
  const i18n = useI18n();

  // Reactive translation that updates when locale changes
  const translation = $derived.by(() => {
    const opts: TranslationOptions = {
      ...options,
      packageName: packageName || options?.packageName
    };

    const result = i18n.t(key, params, opts);
    return result === key && fallback ? fallback : result;
  });
</script>

{translation}
