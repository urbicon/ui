<script lang="ts">
  import { Button, Input } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import { slotClass } from '../../utils/slot-class.js';
  import type { RegisterPageProps } from './index.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';

  let {
    t: tProp,
    onSuccess,
    defaultEmail,
    token,
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
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

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
      label: t.auth.register.requirements.minLength.replace('{n}', String(passwordMinLength)),
      met: password.length >= passwordMinLength
    });
    if (requireUppercase) {
      reqs.push({
        key: 'uppercase',
        label: t.auth.register.requirements.uppercase,
        met: /[A-Z]/.test(password)
      });
    }
    if (requireLowercase) {
      reqs.push({
        key: 'lowercase',
        label: t.auth.register.requirements.lowercase,
        met: /[a-z]/.test(password)
      });
    }
    if (requireDigit) {
      reqs.push({
        key: 'digit',
        label: t.auth.register.requirements.digit,
        met: /[0-9]/.test(password)
      });
    }
    if (requireSpecial) {
      reqs.push({
        key: 'special',
        label: t.auth.register.requirements.special,
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
      // The token travels in the BODY, never as a query param on the POST:
      // query strings land in server logs and the Referer header, and this one
      // is a credential (#149).
      const { ok, data } = await postJson(
        apiPath,
        { name, email, password, token },
        { csrf, fetcher }
      );
      if (!ok) {
        const w = wireError(data);
        error = errorMessageFromCode(w.code, t, w.error) ?? t.auth.errors.serverError;
        return;
      }
      onSuccess?.();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      submitting = false;
    }
  }

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<AuthPageShell
  title={t.auth.register.title}
  {error}
  header={headerSnippet}
  {unstyled}
  {slotClasses}
  class={className}
>
  <form onsubmit={handleSubmit} class={cls('flex flex-col gap-4', slotClasses.form)}>
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

    <div class={cls('flex flex-col gap-1.5')}>
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
      {#if showRequirements && password}
        <!-- The checklist is functionality, not decoration: it must survive
             `unstyled` (review R18) \u2014 only the default classes drop. `data-met`
             carries the pass/fail state structurally so unstyled consumers can
             target it from CSS. -->
        <ul
          class={cls('flex flex-col gap-0.5 pl-1 text-xs', slotClasses.requirements)}
          aria-label={t.auth.register.requirementsLabel}
        >
          {#each requirements as req (req.key)}
            <li
              class={unstyled ? undefined : req.met ? 'text-success' : 'text-text-tertiary'}
              data-met={req.met || undefined}
            >
              <span class={cls('mr-1 inline-block w-3')}>{req.met ? '\u2713' : '\u2717'}</span>
              {req.label}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <Input
      label={t.auth.register.confirmPassword}
      type="password"
      bind:value={confirmPassword}
      required
      autoComplete="new-password"
      error={!passwordsMatch ? t.auth.register.errors.passwordMismatch : undefined}
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
      class={cls('mt-2 w-full', slotClasses.submit)}
    >
      {t.auth.register.submit}
    </Button>
  </form>

  {#if footerSnippet}
    <div class={cls('mt-4')}>
      {@render footerSnippet()}
    </div>
  {/if}

  {#if linksSnippet}
    {@render linksSnippet()}
  {:else}
    <div class={cls('text-text-secondary mt-6 text-center text-sm', slotClasses.links)}>
      {t.auth.register.hasAccount}
      <a href={loginUrl} class={cls('text-text-link hover:underline')}>{t.auth.register.login}</a>
    </div>
  {/if}
</AuthPageShell>
