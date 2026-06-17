<script lang="ts">
  import { useI18n } from '../context.svelte';

  // Attempt an in-place switch during init and render the outcome. Referencing
  // `outcome` in the markup forces the instance script to run under SSR; the IIFE
  // keeps it a single const assignment (no reactive-update warning).
  const i18n = useI18n();
  const outcome = (() => {
    try {
      i18n.setLocale('de');
      return 'no-error';
    } catch (err) {
      return err instanceof Error && /I18nProvider/.test(err.message)
        ? 'needs-provider'
        : 'other-error';
    }
  })();
</script>

<span>{outcome}</span>
