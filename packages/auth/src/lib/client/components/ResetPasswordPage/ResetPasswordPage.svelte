<script lang="ts">
  import { Button, Input, Card, Alert } from '@urbicon-ui/blocks';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import type { ResetPasswordPageProps } from './index.js';

  let {
    t: tProp,
    token,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/reset-password',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: ResetPasswordPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

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
      const res = await csrfFetch(
        apiPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        },
        csrf,
        fetcher
      );
      const data = await res.json();
      if (!res.ok) {
        error =
          errorMessageFromCode(data.code, t, data.error) ??
          t.auth.resetPassword.errors.invalidToken;
        return;
      }
      success = true;
    } catch {
      error = 'Network error';
    } finally {
      submitting = false;
    }
  }
</script>

<div
  class={unstyled
    ? [slotClasses.root, className].filter(Boolean).join(' ')
    : ['flex min-h-[60vh] items-center justify-center', slotClasses.root, className]
        .filter(Boolean)
        .join(' ')}
>
  <Card
    variant="outlined"
    padding="xl"
    {unstyled}
    class={unstyled
      ? slotClasses.card
      : ['w-full max-w-md', slotClasses.card].filter(Boolean).join(' ')}
  >
    <h1
      class={unstyled
        ? slotClasses.title
        : ['text-text-primary mb-6 text-2xl font-semibold', slotClasses.title]
            .filter(Boolean)
            .join(' ')}
    >
      {t.auth.resetPassword.title}
    </h1>

    {#if success}
      <Alert intent="success" size="sm" {unstyled} class={slotClasses.success}>
        {t.auth.resetPassword.success}
      </Alert>
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={loginUrl} class="text-text-link mt-4 inline-block text-sm hover:underline">
        {t.auth.login.submit}
      </a>
    {:else}
      <div aria-live="polite">
        {#if error}
          <Alert
            intent="danger"
            size="sm"
            {unstyled}
            class={['mb-4', slotClasses.error].filter(Boolean).join(' ')}
          >
            {error}
          </Alert>
        {/if}
      </div>

      <form
        onsubmit={handleSubmit}
        class={unstyled
          ? slotClasses.form
          : ['flex flex-col gap-4', slotClasses.form].filter(Boolean).join(' ')}
      >
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
          class={unstyled
            ? slotClasses.submit
            : ['mt-2 w-full', slotClasses.submit].filter(Boolean).join(' ')}
        >
          {t.auth.resetPassword.submit}
        </Button>
      </form>
    {/if}
  </Card>
</div>
