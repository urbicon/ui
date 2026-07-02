<script lang="ts">
  import { Card, Alert, Spinner } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { VerifyEmailPageProps } from './index.js';

  let {
    t: tProp,
    token,
    apiPath = '/api/auth/verify-email',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: VerifyEmailPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let verifying = $state(true);
  let success = $state(false);
  let error = $state('');

  onMount(async () => {
    // No token in the URL → nothing to verify; show the error without a
    // pointless round-trip that the server would reject anyway.
    if (!token) {
      error = t.auth.verifyEmail.error;
      verifying = false;
      return;
    }
    try {
      const res = await csrfFetch(
        apiPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        },
        csrf,
        fetcher
      );
      if (res.ok) {
        success = true;
      } else {
        error = t.auth.verifyEmail.error;
      }
    } catch {
      error = t.auth.verifyEmail.error;
    } finally {
      verifying = false;
    }
  });
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
      : ['w-full max-w-md text-center', slotClasses.card].filter(Boolean).join(' ')}
  >
    <h1
      class={unstyled
        ? slotClasses.title
        : ['text-text-primary mb-6 text-2xl font-semibold', slotClasses.title]
            .filter(Boolean)
            .join(' ')}
    >
      {t.auth.verifyEmail.title}
    </h1>

    <div aria-live="polite">
      {#if verifying}
        <div class={unstyled ? undefined : 'flex flex-col items-center gap-3 py-8'}>
          <Spinner size="lg" {unstyled} />
          <p class={unstyled ? undefined : 'text-text-secondary text-sm'}>
            {t.auth.verifyEmail.verifying}
          </p>
        </div>
      {:else if success}
        <Alert intent="success" {unstyled} class={slotClasses.success}>
          {t.auth.verifyEmail.success}
        </Alert>
      {:else}
        <Alert intent="danger" {unstyled} class={slotClasses.error}>
          {error}
        </Alert>
      {/if}
    </div>
  </Card>
</div>
