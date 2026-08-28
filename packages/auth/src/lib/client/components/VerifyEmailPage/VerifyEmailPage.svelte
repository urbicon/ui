<script lang="ts">
  import { Spinner, getBlocksConfig } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import type { VerifyEmailPageProps } from './index.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';

  let {
    t: tProp,
    token,
    apiPath = '/api/auth/verify-email',
    csrf,
    fetcher,
    header: headerSnippet,
    footer: footerSnippet,
    links: linksSnippet,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: VerifyEmailPageProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'VerifyEmailPage', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  // Until one of the two is set, the region shows the spinner.
  let success = $state(false);
  let error = $state('');

  onMount(async () => {
    // No token in the URL → nothing to verify; show the error without a
    // pointless round-trip that the server would reject anyway.
    if (!token) {
      error = t.auth.verifyEmail.error;
      return;
    }
    try {
      const { ok, data } = await postJson(apiPath, { token }, { csrf, fetcher });
      if (ok) {
        success = true;
      } else {
        // A 429/500 must not read as "your link is broken" (which steers the
        // user into requesting a new link when retrying would work); only a
        // code-less failure defaults to the invalid-link prose.
        const w = wireError(data);
        error = errorMessageFromCode(w.code, t, w.error) ?? t.auth.verifyEmail.error;
      }
    } catch {
      error = t.auth.errors.networkError;
    }
  });

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<!-- No `error` prop on the shell: the outcome is this page's whole content, so
     it renders its own region at page size, with the spinner inside it. -->
<AuthPageShell
  title={t.auth.verifyEmail.title}
  centered
  header={headerSnippet}
  {unstyled}
  {slotClasses}
  class={className}
>
  <FormErrorAlert
    {error}
    success={success ? t.auth.verifyEmail.success : ''}
    size="md"
    {unstyled}
    class={slotClasses.error}
    successClass={slotClasses.success}
  >
    <div class={cls('flex flex-col items-center gap-3 py-8')}>
      <Spinner size="lg" {unstyled} />
      <p class={cls('text-text-secondary text-sm')}>
        {t.auth.verifyEmail.verifying}
      </p>
    </div>
  </FormErrorAlert>

  {#if footerSnippet}
    <div class={cls('mt-4')}>
      {@render footerSnippet()}
    </div>
  {/if}

  {#if linksSnippet}
    {@render linksSnippet()}
  {/if}
</AuthPageShell>
