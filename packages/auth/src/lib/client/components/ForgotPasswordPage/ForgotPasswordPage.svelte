<script lang="ts">
  import { Alert, Button, Input } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import { slotClass } from '../../utils/slot-class.js';
  import type { ForgotPasswordPageProps } from './index.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';

  let {
    t: tProp,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/forgot-password',
    csrf,
    fetcher,
    header: headerSnippet,
    footer: footerSnippet,
    links: linksSnippet,
    unstyled = false,
    slotClasses = {},
    class: className
  }: ForgotPasswordPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let email = $state('');
  let submitted = $state(false);
  let submitting = $state(false);
  let error = $state('');

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = '';
    submitting = true;

    try {
      const { ok, data } = await postJson(apiPath, { email }, { csrf, fetcher });
      if (!ok) {
        const w = wireError(data);
        error = errorMessageFromCode(w.code, t, w.error) ?? t.auth.errors.serverError;
        return;
      }
      submitted = true;
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      submitting = false;
    }
  }

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<AuthPageShell
  title={t.auth.forgotPassword.title}
  {error}
  header={headerSnippet}
  {unstyled}
  {slotClasses}
  class={className}
>
  {#if submitted}
    <Alert intent="success" size="sm" {unstyled} class={slotClasses.success}>
      {t.auth.forgotPassword.success}
    </Alert>
  {:else}
    <p class={cls('text-text-secondary mb-6 text-sm')}>{t.auth.forgotPassword.description}</p>

    <form onsubmit={handleSubmit} class={cls('flex flex-col gap-4', slotClasses.form)}>
      <Input
        label={t.auth.forgotPassword.email}
        type="email"
        bind:value={email}
        required
        autoComplete="email"
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
        class={cls('w-full', slotClasses.submit)}
      >
        {t.auth.forgotPassword.submit}
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
  {:else}
    <a
      href={loginUrl}
      class={cls('text-text-link mt-4 inline-block text-sm hover:underline', slotClasses.links)}
    >
      {t.auth.forgotPassword.backToLogin}
    </a>
  {/if}
</AuthPageShell>
