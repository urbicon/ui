<script lang="ts">
  import { Alert, Button, Input, getBlocksConfig } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import type { ResetPasswordPageProps } from './index.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';

  let {
    t: tProp,
    token,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/reset-password',
    csrf,
    fetcher,
    header: headerSnippet,
    footer: footerSnippet,
    links: linksSnippet,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: ResetPasswordPageProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'ResetPasswordPage', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state(false);
  let submitting = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = '';

    if (password !== confirmPassword) {
      error = t.auth.resetPassword.errors.mismatch;
      return;
    }

    submitting = true;

    try {
      const { ok, data } = await postJson(apiPath, { token, password }, { csrf, fetcher });
      if (!ok) {
        const w = wireError(data);
        error =
          errorMessageFromCode(w.code, t, w.error) ?? t.auth.resetPassword.errors.invalidToken;
        return;
      }
      success = true;
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      submitting = false;
    }
  }

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<AuthPageShell
  title={t.auth.resetPassword.title}
  {error}
  header={headerSnippet}
  {unstyled}
  {slotClasses}
  class={className}
>
  {#if success}
    <Alert intent="success" size="sm" {unstyled} class={slotClasses.success}>
      {t.auth.resetPassword.success}
    </Alert>
  {:else}
    <form onsubmit={handleSubmit} class={cls('flex flex-col gap-4', slotClasses.form)}>
      <Input
        label={t.auth.resetPassword.password}
        type="password"
        bind:value={password}
        required
        autoComplete="new-password"
        {unstyled}
        class={slotClasses.field}
      />
      <Input
        label={t.auth.resetPassword.confirmPassword}
        type="password"
        bind:value={confirmPassword}
        required
        autoComplete="new-password"
        {unstyled}
        class={slotClasses.field}
      />

      <Button
        type="submit"
        variant="filled"
        intent="primary"
        loading={submitting}
        disabled={submitting}
        {unstyled}
        class={cls('mt-2 w-full', slotClasses.submit)}
      >
        {t.auth.resetPassword.submit}
      </Button>
    </form>
  {/if}

  {#if footerSnippet}
    <div class={cls('mt-4')}>
      {@render footerSnippet()}
    </div>
  {/if}

  {#if linksSnippet}
    {@render linksSnippet()}
  {:else if success}
    <a
      href={loginUrl}
      class={cls('text-text-link mt-4 inline-block text-sm hover:underline', slotClasses.links)}
    >
      {t.auth.login.submit}
    </a>
  {/if}
</AuthPageShell>
