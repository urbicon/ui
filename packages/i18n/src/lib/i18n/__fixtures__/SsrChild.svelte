<script lang="ts">
  import { useI18n } from '../context.svelte';

  const i18n = useI18n();
</script>

<span>{i18n.t('ssrtest.hi')}</span>
