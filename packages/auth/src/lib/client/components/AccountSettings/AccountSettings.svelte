<script lang="ts">
  import { Alert, Button, ConfirmDialog, Input, Separator } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import type { AuthUser } from '../../../types.js';
  import type { AccountSettingsProps } from './index.js';
  import { errorTextFromBody, postJson as postJsonRequest } from '../../utils/http.js';
  import { slotClass } from '../../utils/slot-class.js';

  let {
    user,
    t: tProp,
    apiPath = '/api/auth/account',
    csrf,
    fetcher,
    onProfileUpdated,
    onDeleted,
    unstyled = false,
    slotClasses = {},
    class: className
  }: AccountSettingsProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));
  const currentEmail = $derived(user?.email ?? '');

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
    pwBusy = true;
    try {
      const { ok, data } = await postJson('/change-password', {
        currentPassword: pwCurrent,
        newPassword: pwNew
      });
      if (!ok) {
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
      <div aria-live="polite">
        {#if profileError}<Alert intent="danger" size="sm" {unstyled}>{profileError}</Alert>{/if}
        {#if profileSuccess}<Alert intent="success" size="sm" {unstyled}>{profileSuccess}</Alert
          >{/if}
      </div>
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
      <div aria-live="polite">
        {#if emailError}<Alert intent="danger" size="sm" {unstyled}>{emailError}</Alert>{/if}
        {#if emailSuccess}<Alert intent="success" size="sm" {unstyled}>{emailSuccess}</Alert>{/if}
      </div>
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
        autoComplete="new-password"
        {unstyled}
        class={slotClasses.field}
      />
      <div aria-live="polite">
        {#if pwError}<Alert intent="danger" size="sm" {unstyled}>{pwError}</Alert>{/if}
        {#if pwSuccess}<Alert intent="success" size="sm" {unstyled}>{pwSuccess}</Alert>{/if}
      </div>
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
      class={cls(
        'flex flex-col gap-3',
        [slotClasses.section, slotClasses.danger].filter(Boolean).join(' ')
      )}
    >
      <h3 class={cls('text-danger text-sm font-semibold', slotClasses.sectionTitle)}>
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
      <div aria-live="polite">
        {#if deleteError}<Alert intent="danger" size="sm" {unstyled}>{deleteError}</Alert>{/if}
      </div>
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
