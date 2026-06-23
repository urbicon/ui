<script lang="ts">
  import { Alert, Button, Input, Separator } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import type { TwoFactorManagerProps } from './index.js';

  let {
    user,
    t: tProp,
    basePath = '/api/auth/account/2fa',
    csrf,
    fetcher,
    qr,
    onEnabled,
    onDisabled,
    unstyled = false,
    slotClasses = {},
    class: className
  }: TwoFactorManagerProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

  // Local enabled state, seeded once from the user. Updated optimistically after
  // enable/disable so the panel reflects the change without a round-trip.
  let enabled = $state(untrack(() => user?.totpEnabled) ?? false);
  let view = $state<'idle' | 'setup' | 'backup'>('idle');

  // Setup step
  let setupSecret = $state('');
  let setupUri = $state('');
  let code = $state('');

  // Backup-codes step
  let backupCodes = $state<string[]>([]);

  // Disable step
  let disablePassword = $state('');

  let busy = $state(false);
  let error = $state('');

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

  const errText = (data: Record<string, unknown>) => {
    const code = typeof data.code === 'string' ? data.code : undefined;
    const prose = typeof data.error === 'string' ? data.error : undefined;
    return errorMessageFromCode(code, t, prose) ?? t.common?.error ?? 'An error occurred';
  };

  async function startSetup() {
    error = '';
    busy = true;
    try {
      const { ok, data } = await postJson('/setup', {});
      if (!ok) {
        error = errText(data);
        return;
      }
      setupSecret = typeof data.secret === 'string' ? data.secret : '';
      setupUri = typeof data.otpauthUri === 'string' ? data.otpauthUri : '';
      view = 'setup';
    } catch {
      error = t.common?.error ?? 'An error occurred';
    } finally {
      busy = false;
    }
  }

  async function confirmEnable(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const { ok, data } = await postJson('/enable', { code });
      if (!ok) {
        error = errText(data);
        return;
      }
      backupCodes = Array.isArray(data.backupCodes) ? (data.backupCodes as string[]) : [];
      enabled = true;
      code = '';
      view = 'backup';
      onEnabled?.();
    } catch {
      error = t.common?.error ?? 'An error occurred';
    } finally {
      busy = false;
    }
  }

  function finishBackup() {
    backupCodes = [];
    setupSecret = '';
    setupUri = '';
    view = 'idle';
  }

  function downloadCodes() {
    const blob = new Blob([backupCodes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  function cancelSetup() {
    code = '';
    setupSecret = '';
    setupUri = '';
    error = '';
    view = 'idle';
  }

  async function disable(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const { ok, data } = await postJson('/disable', { currentPassword: disablePassword });
      if (!ok) {
        error = errText(data);
        return;
      }
      enabled = false;
      disablePassword = '';
      onDisabled?.();
    } catch {
      error = t.common?.error ?? 'An error occurred';
    } finally {
      busy = false;
    }
  }

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) =>
    (unstyled ? [slot] : [base, slot]).filter(Boolean).join(' ');
</script>

{#if user}
  <div class={cls('flex flex-col gap-4', [slotClasses.root, className].filter(Boolean).join(' '))}>
    <h2 class={cls('text-text-primary text-lg font-semibold', slotClasses.title)}>
      {t.twoFactor?.title ?? 'Two-factor authentication'}
    </h2>

    <div aria-live="polite">
      {#if error}<Alert intent="danger" size="sm" {unstyled}>{error}</Alert>{/if}
    </div>

    {#if view === 'idle'}
      <p class={cls('text-text-secondary text-sm', undefined)}>
        {enabled
          ? (t.twoFactor?.statusEnabled ?? 'Two-factor authentication is on.')
          : (t.twoFactor?.description ??
            'Add a second step to sign-in using an authenticator app.')}
      </p>

      {#if enabled}
        <!-- Disable: password re-auth -->
        <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={disable}>
          <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
            {t.twoFactor?.disableTitle ?? 'Disable two-factor authentication'}
          </h3>
          <p class={cls('text-text-tertiary text-sm', undefined)}>
            {t.twoFactor?.disableDescription ??
              'Enter your password to turn off two-factor authentication.'}
          </p>
          <Input
            label={t.twoFactor?.disablePassword ?? 'Current password'}
            type="password"
            bind:value={disablePassword}
            required
            autoComplete="current-password"
            {unstyled}
            class={slotClasses.field}
          />
          <Button
            type="submit"
            variant="outlined"
            intent="danger"
            size="sm"
            loading={busy}
            disabled={busy || !disablePassword}
            {unstyled}
            class={cls('self-start', slotClasses.submit)}
          >
            {t.twoFactor?.disableConfirm ?? 'Disable'}
          </Button>
        </form>
      {:else}
        <Button
          variant="filled"
          intent="primary"
          size="sm"
          loading={busy}
          disabled={busy}
          onclick={startSetup}
          {unstyled}
          class={cls('self-start', slotClasses.submit)}
        >
          {t.twoFactor?.enable ?? 'Enable two-factor authentication'}
        </Button>
      {/if}
    {:else if view === 'setup'}
      <!-- Setup: scan the QR / enter the key, then confirm a code -->
      <p class={cls('text-text-secondary text-sm', undefined)}>
        {t.twoFactor?.setupScan ??
          'Scan this QR code with your authenticator app, or enter the key manually.'}
      </p>

      {#if qr}
        {@render qr({ uri: setupUri, secret: setupSecret })}
      {/if}

      <div class={cls('flex flex-col gap-1', undefined)}>
        <span class={cls('text-text-tertiary text-xs', undefined)}>
          {t.twoFactor?.setupSecret ?? 'Setup key'}
        </span>
        <code
          class={cls(
            'text-text-primary bg-surface-quiet rounded px-2 py-1 text-sm',
            slotClasses.code
          )}
        >
          {setupSecret}
        </code>
      </div>

      <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={confirmEnable}>
        <Input
          label={t.twoFactor?.setupCode ?? 'Enter the 6-digit code'}
          inputmode="numeric"
          autoComplete="one-time-code"
          bind:value={code}
          required
          {unstyled}
          class={slotClasses.field}
        />
        <div class={cls('flex gap-2', undefined)}>
          <Button
            type="submit"
            variant="filled"
            intent="primary"
            size="sm"
            loading={busy}
            disabled={busy || !code}
            {unstyled}
            class={slotClasses.submit}
          >
            {t.twoFactor?.setupConfirm ?? 'Confirm and enable'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            intent="neutral"
            size="sm"
            disabled={busy}
            onclick={cancelSetup}
            {unstyled}
          >
            {t.twoFactor?.cancel ?? 'Cancel'}
          </Button>
        </div>
      </form>
    {:else if view === 'backup'}
      <!-- One-time backup codes -->
      <h3 class={cls('text-text-primary text-sm font-semibold', slotClasses.sectionTitle)}>
        {t.twoFactor?.backupTitle ?? 'Save your backup codes'}
      </h3>
      <p class={cls('text-text-tertiary text-sm', undefined)}>
        {t.twoFactor?.backupDescription ??
          'Each code works once if you lose access to your authenticator. Store them somewhere safe — they will not be shown again.'}
      </p>
      <ul
        class={cls(
          'bg-surface-quiet grid grid-cols-2 gap-1 rounded p-3 font-mono text-sm',
          undefined
        )}
      >
        {#each backupCodes as backupCode (backupCode)}
          <li class={cls('text-text-primary', slotClasses.backupCode)}>{backupCode}</li>
        {/each}
      </ul>
      <div class={cls('flex gap-2', undefined)}>
        <Button variant="outlined" intent="neutral" size="sm" onclick={downloadCodes} {unstyled}>
          {t.twoFactor?.backupDownload ?? 'Download codes'}
        </Button>
        <Button
          variant="filled"
          intent="primary"
          size="sm"
          onclick={finishBackup}
          {unstyled}
          class={slotClasses.submit}
        >
          {t.twoFactor?.backupDone ?? "I've saved my codes"}
        </Button>
      </div>
    {/if}

    <Separator {unstyled} />
  </div>
{/if}
