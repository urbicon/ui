<script lang="ts">
  import { Button, Input } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { unmetPasswordRules } from '../../../password-policy.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import { usePasswordPolicy } from '../../utils/password-policy.svelte.js';
  import { slotClass } from '../../utils/slot-class.js';
  import type { RegisterPageProps } from './index.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';
  import PasswordRequirements from '../_shared/PasswordRequirements.svelte';

  let {
    t: tProp,
    onSuccess,
    defaultEmail,
    token,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/register',
    csrf,
    fetcher,
    passwordPolicy,
    policyPath = '/api/auth/password-policy',
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

  // The server owns the policy; this reads it from there rather than from a
  // second copy in props (#290). Until it arrives the package defaults apply —
  // which is what an unconfigured server enforces.
  const policySource = usePasswordPolicy(() => ({
    policy: passwordPolicy,
    path: policyPath,
    fetcher
  }));
  const policy = $derived(policySource.current);

  // Two steps: `$props.id()` is only valid as a top-level initializer.
  const propsId = $props.id();
  const requirementsId = `register-password-requirements-${propsId}`;

  let name = $state('');
  // Seeded once from the invite link's `?email=` (passed as `defaultEmail`), then
  // editable — `untrack` reads the initial prop without subscribing (mirrors
  // AccountSettings' name seed). To re-seed after mount, remount with `{#key}`.
  let email = $state(untrack(() => defaultEmail) ?? '');
  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let submitting = $state(false);

  const allRequirementsMet = $derived(unmetPasswordRules(password, policy).length === 0);
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
        minlength={policy.minLength}
        autoComplete="new-password"
        aria-describedby={showRequirements && password ? requirementsId : undefined}
        {unstyled}
        class={slotClasses.field}
      />
      {#if showRequirements && password}
        <PasswordRequirements
          id={requirementsId}
          {policy}
          {password}
          {t}
          {unstyled}
          class={slotClasses.requirements}
        />
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
