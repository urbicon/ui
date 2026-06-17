<script lang="ts">
  import { Alert, Button, ConfirmDialog, Input, Separator } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { AuthUser } from '../../../types.js';
  import type { AccountSettingsProps } from './index.js';

  let {
    user,
    t: tProp,
    basePath = '/api/auth/account',
    csrf,
    fetcher,
    onProfileUpdated,
    onDeleted,
    unstyled = false,
    slotClasses = {},
    class: className
  }: AccountSettingsProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());
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

  async function postJson(
    path: string,
    body: unknown
  ): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await csrfFetch(
      `${basePath}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      },
      csrf,
      fetcher
    );
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  const errText = (data: Record<string, unknown>) =>
    (typeof data.error === 'string' && data.error) || t.common?.error || 'An error occurred';

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
      profileSuccess = t.account?.profile?.success ?? 'Profile updated.';
      if (data.user) onProfileUpdated?.(data.user as AuthUser);
    } catch {
      profileError = t.common?.error ?? 'An error occurred';
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
      emailSuccess = t.account?.email?.success ?? 'Check your new inbox to confirm the change.';
      newEmail = '';
      emailPassword = '';
    } catch {
      emailError = t.common?.error ?? 'An error occurred';
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
      pwSuccess = t.account?.password?.success ?? 'Your password has been changed.';
      pwCurrent = '';
      pwNew = '';
    } catch {
      pwError = t.common?.error ?? 'An error occurred';
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
      deleteError = t.common?.error ?? 'An error occurred';
    }
  }

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) =>
    (unstyled ? [slot] : [base, slot]).filter(Boolean).join(' ');
</script>

{#if user}
  <div class={cls('flex flex-col gap-8', [slotClasses.root, className].filter(Boolean).join(' '))}>
    <h2 class={cls('text-text-primary text-lg font-semibold', slotClasses.title)}>
      {t.account?.title ?? 'Account settings'}
    </h2>

    <!-- Profile -->
    <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={saveProfile}>
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.account?.profile?.title ?? 'Profile'}
      </h3>
      <Input
        label={t.account?.profile?.name ?? 'Name'}
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
        {t.account?.profile?.save ?? 'Save'}
      </Button>
    </form>

    <Separator {unstyled} />

    <!-- Email -->
    <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={changeEmail}>
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.account?.email?.title ?? 'Email address'}
      </h3>
      <p class={cls('text-text-tertiary text-sm', undefined)}>
        {t.account?.email?.current ?? 'Current email'}:
        <span class="text-text-secondary">{currentEmail}</span>
      </p>
      <Input
        label={t.account?.email?.newEmail ?? 'New email'}
        type="email"
        bind:value={newEmail}
        required
        autoComplete="email"
        {unstyled}
        class={slotClasses.field}
      />
      <Input
        label={t.account?.email?.currentPassword ?? 'Current password'}
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
        {t.account?.email?.submit ?? 'Change email'}
      </Button>
    </form>

    <Separator {unstyled} />

    <!-- Password -->
    <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={changePassword}>
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.account?.password?.title ?? 'Password'}
      </h3>
      <Input
        label={t.account?.password?.currentPassword ?? 'Current password'}
        type="password"
        bind:value={pwCurrent}
        required
        autoComplete="current-password"
        {unstyled}
        class={slotClasses.field}
      />
      <Input
        label={t.account?.password?.newPassword ?? 'New password'}
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
        {t.account?.password?.submit ?? 'Change password'}
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
        {t.account?.delete?.title ?? 'Delete account'}
      </h3>
      <p class={cls('text-text-tertiary text-sm', undefined)}>
        {t.account?.delete?.description ??
          'This permanently deletes your account and all associated data. This cannot be undone.'}
      </p>
      <Input
        label={t.account?.delete?.currentPassword ?? 'Current password'}
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
        {t.account?.delete?.submit ?? 'Delete account'}
      </Button>
    </section>

    <ConfirmDialog
      bind:open={confirmOpen}
      title={t.account?.delete?.confirmTitle ?? 'Delete your account?'}
      description={t.account?.delete?.confirmBody ??
        'This permanently erases your account and cannot be undone.'}
      intent="danger"
      confirmLabel={t.account?.delete?.confirm ?? 'Delete account'}
      cancelLabel={t.account?.delete?.cancel ?? 'Cancel'}
      onConfirm={confirmDelete}
    />
  </div>
{/if}
