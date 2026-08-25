<script lang="ts">
  import { Alert, Button, Input } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { unmetPasswordRules } from '../../../password-policy.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import { usePasswordPolicy } from '../../utils/password-policy.svelte.js';
  import { slotClass } from '../../utils/slot-class.js';
  import type { ResetPasswordPageProps } from './index.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';
  import PasswordRequirements from '../_shared/PasswordRequirements.svelte';

  let {
    t: tProp,
    token,
    loginUrl = '/auth/login',
    apiPath = '/api/auth/reset-password',
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
  }: ResetPasswordPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  // Same policy source as RegisterPage: without it this form had no client-side
  // gate at all, so the most ordinary slip — a password below the server's
  // minimum — came back as English server prose on a localized page (#290).
  const policySource = usePasswordPolicy(() => ({
    policy: passwordPolicy,
    path: policyPath,
    fetcher
  }));
  const policy = $derived(policySource.current);

  // Two steps: `$props.id()` is only valid as a top-level initializer.
  const propsId = $props.id();
  const requirementsId = `reset-password-requirements-${propsId}`;

  let password = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let success = $state(false);
  let submitting = $state(false);

  const allRequirementsMet = $derived(unmetPasswordRules(password, policy).length === 0);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = '';

    if (password !== confirmPassword) {
      error = t.auth.resetPassword.errors.mismatch;
      return;
    }
    // Checked on submit rather than by disabling the button: the checklist can
    // be turned off (`showRequirements={false}`), and a dead button with no
    // explanation is worse than the English server prose this replaces.
    if (!allRequirementsMet) {
      error = t.auth.errors.validationError;
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
      <div class={cls('flex flex-col gap-1.5')}>
        <Input
          label={t.auth.resetPassword.password}
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
