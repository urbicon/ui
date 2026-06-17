<script lang="ts">
  import { Button, Input, Card, Alert } from '@urbicon-ui/blocks';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { ForgotPasswordPageProps } from './index.js';

  let {
    t: tProp,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/forgot-password',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: ForgotPasswordPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

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
      const res = await csrfFetch(
        apiPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        },
        csrf,
        fetcher
      );
      if (!res.ok) {
        const data = await res.json();
        error = data.error ?? 'Request failed';
        return;
      }
      submitted = true;
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
        : ['text-text-primary mb-4 text-2xl font-semibold', slotClasses.title]
            .filter(Boolean)
            .join(' ')}
    >
      {t.auth.forgotPassword.title}
    </h1>

    {#if submitted}
      <Alert intent="success" size="sm" {unstyled} class={slotClasses.success}>
        {t.auth.forgotPassword.success}
      </Alert>
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={loginUrl} class="text-text-link mt-4 inline-block text-sm hover:underline">
        {t.auth.forgotPassword.backToLogin}
      </a>
    {:else}
      <p class="text-text-secondary mb-6 text-sm">{t.auth.forgotPassword.description}</p>

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
          class={unstyled
            ? slotClasses.submit
            : ['w-full', slotClasses.submit].filter(Boolean).join(' ')}
        >
          {t.auth.forgotPassword.submit}
        </Button>
      </form>

      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={loginUrl} class="text-text-link mt-4 inline-block text-sm hover:underline">
        {t.auth.forgotPassword.backToLogin}
      </a>
    {/if}
  </Card>
</div>
