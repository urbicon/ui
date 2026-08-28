<script lang="ts">
  import { Button, ConfirmDialog, Input, Separator, getBlocksConfig } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { unmetPasswordRules } from '../../../password-policy.js';
  import type { AuthUser } from '../../../types.js';
  import type { AccountSettingsProps } from './index.js';
  import { errorTextFromBody, postJson as postJsonRequest } from '../../utils/http.js';
  import {
    passwordRefusalFromBody,
    passwordRefusalMessage,
    usePasswordPolicy
  } from '../../utils/password-policy.svelte.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import PasswordRequirements from '../_shared/PasswordRequirements.svelte';

  let {
    user,
    t: tProp,
    apiPath = '/api/auth/account',
    csrf,
    fetcher,
    onProfileUpdated,
    onDeleted,
    passwordPolicy,
    policyPath = '/api/auth/password-policy',
    showRequirements = true,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: AccountSettingsProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'AccountSettings', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));
  const currentEmail = $derived(user?.email ?? '');

  // The danger zone is the one part rendered as its own `<section>`, so it is a
  // landmark; without a name a screen reader announces it as nothing, which is
  // a poor place for that to happen. Two steps because `$props.id()` is only
  // valid as a top-level initializer.
  const propsId = $props.id();
  const dangerTitleId = `account-danger-title-${propsId}`;
  const pwRequirementsId = `account-password-requirements-${propsId}`;

  // The new-password field had no client-side gate: a password below the
  // server's minimum came back as English server prose on a localized page
  // (#290). The policy comes from the server, never from a prop copy of it.
  const policySource = usePasswordPolicy(() => ({
    policy: passwordPolicy,
    path: policyPath,
    fetcher
  }));
  const policy = $derived(policySource.current);

  // Editable draft of the name, seeded once from the initial user. If you
  // resolve `user` after mount (async load / switching users), remount with
  // `{#key user?.id}<AccountSettings {user} />{/key}` to re-seed it.
  let name = $state(untrack(() => user?.name) ?? '');

  // --- per-section state ---
  let profileBusy = $state(false);
  let profileError = $state('');
  let profileSuccess = $state('');

  let newEmail = $state('');
  let emailPassword = $state('');
  let emailBusy = $state(false);
  let emailError = $state('');
  let emailSuccess = $state('');

  let pwCurrent = $state('');
  let pwNew = $state('');
  let pwBusy = $state(false);
  let pwError = $state('');
  let pwSuccess = $state('');
  const pwUnmetRules = $derived(unmetPasswordRules(pwNew, policy));

  let deletePassword = $state('');
  let deleteError = $state('');
  let confirmOpen = $state(false);

  const postJson = (path: string, body: unknown) =>
    postJsonRequest(`${apiPath}${path}`, body, { csrf, fetcher });

  const errText = (data: Record<string, unknown>) => errorTextFromBody(data, t);

  async function saveProfile(e: SubmitEvent) {
    e.preventDefault();
    profileError = '';
    profileSuccess = '';
    profileBusy = true;
    try {
      const { ok, data } = await postJson('/profile', { name });
      if (!ok) {
        profileError = errText(data);
        return;
      }
      profileSuccess = t.account.profile.success;
      if (data.user) onProfileUpdated?.(data.user as AuthUser);
    } catch {
      profileError = t.auth.errors.networkError;
    } finally {
      profileBusy = false;
    }
  }

  async function changeEmail(e: SubmitEvent) {
    e.preventDefault();
    emailError = '';
    emailSuccess = '';
    emailBusy = true;
    try {
      const { ok, data } = await postJson('/change-email', {
        newEmail,
        currentPassword: emailPassword
      });
      if (!ok) {
        emailError = errText(data);
        return;
      }
      // Always-success (enumeration-safe) response → show the same "check your
      // inbox" hint regardless of whether the address was free.
      emailSuccess = t.account.email.success;
      newEmail = '';
      emailPassword = '';
    } catch {
      emailError = t.auth.errors.networkError;
    } finally {
      emailBusy = false;
    }
  }

  async function changePassword(e: SubmitEvent) {
    e.preventDefault();
    pwError = '';
    pwSuccess = '';
    // Checked on submit rather than by disabling the button: the checklist can
    // be turned off (`showRequirements={false}`), and a dead button explains
    // nothing. The message names the failing rules either way.
    if (pwUnmetRules.length > 0) {
      pwError = passwordRefusalMessage({ rules: pwUnmetRules, policy }, t);
      return;
    }
    pwBusy = true;
    try {
      const { ok, data } = await postJson('/change-password', {
        currentPassword: pwCurrent,
        newPassword: pwNew
      });
      if (!ok) {
        // A password refusal carries the failing rules and the policy the
        // server measured against — render our own labels, and adopt the
        // policy so the retry is gated on the real rules.
        const refusal = passwordRefusalFromBody(data);
        if (refusal) {
          policySource.adopt(refusal.policy);
          pwError = passwordRefusalMessage(refusal, t);
          return;
        }
        pwError = errText(data);
        return;
      }
      pwSuccess = t.account.password.success;
      pwCurrent = '';
      pwNew = '';
    } catch {
      pwError = t.auth.errors.networkError;
    } finally {
      pwBusy = false;
    }
  }

  // No busy flag of its own: `onConfirm` returns a promise, and ConfirmDialog
  // contracts to hold the dialog open and loading until it settles, which is
  // where a second confirm click dies. Deliberately not asserted from here —
  // the single-flight is ConfirmDialog's contract and is pinned in its suite.
  async function confirmDelete() {
    deleteError = '';
    try {
      const { ok, data } = await postJson('/delete', { currentPassword: deletePassword });
      if (!ok) {
        deleteError = errText(data);
        return;
      }
      onDeleted?.();
    } catch {
      // A thrown fetch on the most destructive action must still surface
      // feedback rather than failing silently inside the dialog.
      deleteError = t.auth.errors.networkError;
    }
  }

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

{#if user}
  <div class={cls('flex flex-col gap-8', [slotClasses.root, className].filter(Boolean).join(' '))}>
    <h2 class={cls('text-text-primary text-lg font-semibold', slotClasses.title)}>
      {t.account.title}
    </h2>

    <!-- Profile -->
    <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={saveProfile}>
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.account.profile.title}
      </h3>
      <Input
        label={t.account.profile.name}
        bind:value={name}
        autoComplete="name"
        {unstyled}
        class={slotClasses.field}
      />
      <FormErrorAlert error={profileError} success={profileSuccess} {unstyled} />
      <Button
        type="submit"
        variant="filled"
        intent="primary"
        size="sm"
        loading={profileBusy}
        disabled={profileBusy}
        {unstyled}
        class={cls('self-start', slotClasses.submit)}
      >
        {t.account.profile.save}
      </Button>
    </form>

    <Separator {unstyled} />

    <!-- Email -->
    <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={changeEmail}>
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.account.email.title}
      </h3>
      <p class={cls('text-text-tertiary text-sm', undefined)}>
        {t.account.email.current}:
        <span class={cls('text-text-secondary')}>{currentEmail}</span>
      </p>
      <Input
        label={t.account.email.newEmail}
        type="email"
        bind:value={newEmail}
        required
        autoComplete="email"
        {unstyled}
        class={slotClasses.field}
      />
      <Input
        label={t.account.email.currentPassword}
        type="password"
        bind:value={emailPassword}
        required
        autoComplete="current-password"
        {unstyled}
        class={slotClasses.field}
      />
      <FormErrorAlert error={emailError} success={emailSuccess} {unstyled} />
      <Button
        type="submit"
        variant="filled"
        intent="primary"
        size="sm"
        loading={emailBusy}
        disabled={emailBusy}
        {unstyled}
        class={cls('self-start', slotClasses.submit)}
      >
        {t.account.email.submit}
      </Button>
    </form>

    <Separator {unstyled} />

    <!-- Password -->
    <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={changePassword}>
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.account.password.title}
      </h3>
      <Input
        label={t.account.password.currentPassword}
        type="password"
        bind:value={pwCurrent}
        required
        autoComplete="current-password"
        {unstyled}
        class={slotClasses.field}
      />
      <Input
        label={t.account.password.newPassword}
        type="password"
        bind:value={pwNew}
        required
        minlength={policy.minLength}
        autoComplete="new-password"
        aria-describedby={showRequirements ? pwRequirementsId : undefined}
        {unstyled}
        class={slotClasses.field}
      />
      {#if showRequirements}
        <PasswordRequirements
          id={pwRequirementsId}
          {policy}
          password={pwNew}
          {t}
          {unstyled}
          class={slotClasses.requirements}
        />
      {/if}
      <FormErrorAlert error={pwError} success={pwSuccess} {unstyled} />
      <Button
        type="submit"
        variant="filled"
        intent="primary"
        size="sm"
        loading={pwBusy}
        disabled={pwBusy}
        {unstyled}
        class={cls('self-start', slotClasses.submit)}
      >
        {t.account.password.submit}
      </Button>
    </form>

    <Separator {unstyled} />

    <!-- Danger zone -->
    <section
      aria-labelledby={dangerTitleId}
      class={cls(
        'flex flex-col gap-3',
        [slotClasses.section, slotClasses.danger].filter(Boolean).join(' ')
      )}
    >
      <h3
        id={dangerTitleId}
        class={cls('text-danger-text text-sm font-semibold', slotClasses.sectionTitle)}
      >
        {t.account.delete.title}
      </h3>
      <p class={cls('text-text-tertiary text-sm', undefined)}>
        {t.account.delete.description}
      </p>
      <Input
        label={t.account.delete.currentPassword}
        type="password"
        bind:value={deletePassword}
        autoComplete="current-password"
        {unstyled}
        class={slotClasses.field}
      />
      <FormErrorAlert error={deleteError} {unstyled} />
      <Button
        variant="outlined"
        intent="danger"
        size="sm"
        disabled={!deletePassword}
        onclick={() => (confirmOpen = true)}
        {unstyled}
        class={cls('self-start', slotClasses.submit)}
      >
        {t.account.delete.submit}
      </Button>
    </section>

    <ConfirmDialog
      bind:open={confirmOpen}
      title={t.account.delete.confirmTitle}
      description={t.account.delete.confirmBody}
      intent="danger"
      confirmLabel={t.account.delete.confirm}
      cancelLabel={t.account.delete.cancel}
      onConfirm={confirmDelete}
    />
  </div>
{/if}
