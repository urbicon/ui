<script lang="ts">
  import { Button, Input, Card, Alert } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { RegisterPageProps } from './index.js';

  let {
    t: tProp,
    onSuccess,
    defaultEmail,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/register',
    csrf,
    fetcher,
    passwordMinLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireDigit = true,
    requireSpecial = false,
    showRequirements = true,
    header: headerSnippet,
    footer: footerSnippet,
    links: linksSnippet,
    unstyled = false,
    slotClasses = {},
    class: className
  }: RegisterPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

  let name = $state('');
  // Seeded once from the invite link's `?email=` (passed as `defaultEmail`), then
  // editable — `untrack` reads the initial prop without subscribing (mirrors
  // AccountSettings' name seed). To re-seed after mount, remount with `{#key}`.
  let email = $state(untrack(() => defaultEmail) ?? '');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let submitting = $state(false);

  const requirements = $derived.by(() => {
    const reqs: Array<{ key: string; label: string; met: boolean }> = [];
    reqs.push({
      key: 'minLength',
      label: t.auth.register.requirements?.minLength ?? `At least ${passwordMinLength} characters`,
      met: password.length >= passwordMinLength
    });
    if (requireUppercase) {
      reqs.push({
        key: 'uppercase',
        label: t.auth.register.requirements?.uppercase ?? 'One uppercase letter',
        met: /[A-Z]/.test(password)
      });
    }
    if (requireLowercase) {
      reqs.push({
        key: 'lowercase',
        label: t.auth.register.requirements?.lowercase ?? 'One lowercase letter',
        met: /[a-z]/.test(password)
      });
    }
    if (requireDigit) {
      reqs.push({
        key: 'digit',
        label: t.auth.register.requirements?.digit ?? 'One digit',
        met: /[0-9]/.test(password)
      });
    }
    if (requireSpecial) {
      reqs.push({
        key: 'special',
        label: t.auth.register.requirements?.special ?? 'One special character',
        met: /[^A-Za-z0-9]/.test(password)
      });
    }
    return reqs;
  });

  const allRequirementsMet = $derived(requirements.every((r) => r.met));
  const passwordsMatch = $derived(!confirmPassword || password === confirmPassword);
  const canSubmit = $derived(
    !submitting && allRequirementsMet && passwordsMatch && confirmPassword.length > 0
  );

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    error = '';
    submitting = true;

    try {
      const res = await csrfFetch(
        apiPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        },
        csrf,
        fetcher
      );
      const data = await res.json();
      if (!res.ok) {
        error = data.error ?? 'Registration failed';
        return;
      }
      onSuccess?.();
    } catch {
      error = t.common?.error ?? 'An error occurred';
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
      {t.auth.register.title}
    </h1>

    {#if headerSnippet}
      {@render headerSnippet()}
    {/if}

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
        label={t.auth.register.name}
        type="text"
        bind:value={name}
        required
        autoComplete="name"
        {unstyled}
        class={slotClasses.field}
      />
      <Input
        label={t.auth.register.email}
        type="email"
        bind:value={email}
        required
        autoComplete="email"
        {unstyled}
        class={slotClasses.field}
      />

      <div class="flex flex-col gap-1.5">
        <Input
          label={t.auth.register.password}
          type="password"
          bind:value={password}
          required
          minlength={passwordMinLength}
          autoComplete="new-password"
          {unstyled}
          class={slotClasses.field}
        />
        {#if showRequirements && password && !unstyled}
          <ul class="flex flex-col gap-0.5 pl-1 text-xs" aria-label="Password requirements">
            {#each requirements as req (req.key)}
              <li class={req.met ? 'text-success' : 'text-text-tertiary'}>
                <span class="mr-1 inline-block w-3">{req.met ? '\u2713' : '\u2717'}</span>
                {req.label}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <Input
        label={t.auth.register.confirmPassword ?? 'Confirm password'}
        type="password"
        bind:value={confirmPassword}
        required
        autoComplete="new-password"
        error={!passwordsMatch
          ? (t.auth.register.errors?.passwordMismatch ?? 'Passwords do not match')
          : undefined}
        {unstyled}
        class={slotClasses.field}
      />

      <Button
        type="submit"
        variant="filled"
        intent="primary"
        loading={submitting}
        disabled={!canSubmit}
        {unstyled}
        class={unstyled
          ? slotClasses.submit
          : ['mt-2 w-full', slotClasses.submit].filter(Boolean).join(' ')}
      >
        {t.auth.register.submit}
      </Button>
    </form>

    {#if footerSnippet}
      <div class="mt-4">
        {@render footerSnippet()}
      </div>
    {/if}

    {#if linksSnippet}
      {@render linksSnippet()}
    {:else}
      <div
        class={unstyled
          ? slotClasses.links
          : ['text-text-secondary mt-6 text-center text-sm', slotClasses.links]
              .filter(Boolean)
              .join(' ')}
      >
        {t.auth.register.hasAccount}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href={loginUrl} class="text-text-link hover:underline">{t.auth.register.login}</a>
      </div>
    {/if}
  </Card>
</div>
