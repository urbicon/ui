<script lang="ts">
  import { Button, Input, getBlocksConfig } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { unmetPasswordRules } from '../../../password-policy.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import { postJson, wireError } from '../../utils/http.js';
  import {
    passwordRefusalFromBody,
    passwordRefusalMessage,
    usePasswordPolicy
  } from '../../utils/password-policy.svelte.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
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

  const unmetRules = $derived(unmetPasswordRules(password, policy));

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = '';

    if (password !== confirmPassword) {
      error = t.auth.resetPassword.errors.mismatch;
      return;
    }
    // Checked on submit rather than by disabling the button: the checklist can
    // be turned off (`showRequirements={false}`), and a dead button explains
    // nothing. The message names the failing rules either way.
    if (unmetRules.length > 0) {
      error = passwordRefusalMessage({ rules: unmetRules, policy }, t);
      return;
    }

    submitting = true;

    try {
      const { ok, data } = await postJson(apiPath, { token, password }, { csrf, fetcher });
      if (!ok) {
        // A password refusal carries the failing rules and the policy the
        // server measured against — render our own labels, and adopt the
        // policy so the retry is gated on the real rules.
        const refusal = passwordRefusalFromBody(data);
        if (refusal) {
          policySource.adopt(refusal.policy);
          error = passwordRefusalMessage(refusal, t);
          return;
        }
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
  success={success ? t.auth.resetPassword.success : ''}
  header={headerSnippet}
  {unstyled}
  {slotClasses}
  class={className}
>
  {#if !success}
    <form onsubmit={handleSubmit} class={cls('flex flex-col gap-4', slotClasses.form)}>
      <div class={cls('flex flex-col gap-1.5')}>
        <Input
          label={t.auth.resetPassword.password}
          type="password"
          bind:value={password}
          required
          minlength={policy.minLength}
          autoComplete="new-password"
          aria-describedby={showRequirements ? requirementsId : undefined}
          {unstyled}
          class={slotClasses.field}
        />
        {#if showRequirements}
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
