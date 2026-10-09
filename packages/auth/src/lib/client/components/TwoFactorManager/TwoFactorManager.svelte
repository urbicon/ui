<script lang="ts">
  import { Button, getBlocksConfig, Input, resolveClassChain, Separator } from '@urbicon-ui/blocks';
  import { tick, untrack } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import type { TwoFactorManagerProps } from './index.js';
  import { errorTextFromBody, postJson as postJsonRequest } from '../../utils/http.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';

  let {
    user,
    t: tProp,
    apiPath = '/api/auth/account/2fa',
    csrf,
    fetcher,
    qr,
    onEnabled,
    onDisabled,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: TwoFactorManagerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'TwoFactorManager', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

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

  /** The panel root, read to tell focus inside it from focus a user moved away. */
  let panel: HTMLDivElement | undefined = $state();

  /**
   * A step swaps the panel's content in place: the control that had focus is
   * gone and nothing says where the user now is. Move focus to the heading the
   * new step opens with — its `tabindex="-1"` exists for this.
   *
   * Called from the success branches only. A rejected code leaves the step
   * where it was, and pulling the caret out of the field the user is still
   * typing in is the failure this must not have.
   */
  async function focusStep() {
    const held = document.activeElement;
    const ours = held === null || held === document.body || panel?.contains(held) === true;
    await tick();
    if (!ours) return;
    // Queried after the swap, not bound: exactly one step heading exists at a
    // time, and a query cannot be left holding the outgoing branch's element.
    // The enable step is a lone button, so it falls back to the panel heading.
    const target =
      panel?.querySelector<HTMLElement>('h3') ?? panel?.querySelector<HTMLElement>('h2');
    target?.focus();
  }

  const postJson = (path: string, body: unknown) =>
    postJsonRequest(`${apiPath}${path}`, body, { csrf, fetcher });

  const errText = (data: Record<string, unknown>) => errorTextFromBody(data, t);

  async function startSetup() {
    error = '';
    busy = true;
    try {
      const { ok, data } = await postJson('/setup', {});
      if (!ok) {
        error = errText(data);
        return;
      }
      const secret = typeof data.secret === 'string' ? data.secret : '';
      const uri = typeof data.otpauthUri === 'string' ? data.otpauthUri : '';
      if (!secret || !uri) {
        // A 200 without the TOTP material would build a dead-end setup view
        // (empty QR payload, empty key, nothing to confirm) — surface it.
        error = errText(data);
        return;
      }
      setupSecret = secret;
      setupUri = uri;
      view = 'setup';
      void focusStep();
    } catch {
      error = t.auth.errors.networkError;
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
      // The enable handler always returns the one-time backup codes; a 200
      // without them is malformed. Showing the backup view with an empty list
      // (and a one-newline download) would hide that — surface it instead. A
      // retry then answers two_factor_already_enabled, which is localized and
      // states what happened.
      if (!Array.isArray(data.backupCodes) || data.backupCodes.length === 0) {
        error = errText(data);
        return;
      }
      backupCodes = data.backupCodes as string[];
      enabled = true;
      code = '';
      view = 'backup';
      void focusStep();
      onEnabled?.();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      busy = false;
    }
  }

  function finishBackup() {
    backupCodes = [];
    setupSecret = '';
    setupUri = '';
    view = 'idle';
    void focusStep();
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
    void focusStep();
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
      // `view` stays `idle`, but the section under it swaps the disable form
      // for the enable button — the submit the user pressed is gone either way.
      enabled = false;
      disablePassword = '';
      void focusStep();
      onDisabled?.();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      busy = false;
    }
  }

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);

  // The library ring on the programmatic focus targets below, keyboard-only.
  // The un-gated `focus:outline-none` is what Safari needs: it paints its
  // default outline on a programmatically focused element where Chrome and
  // Firefox gate on `:focus-visible` and paint nothing — same construct and
  // same fix as `Guide`'s article title (guide.variants.ts).
  const STEP_HEADING =
    'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50';
</script>

{#if user}
  <div
    bind:this={panel}
    class={cls('flex flex-col gap-4', resolveClassChain(slotClasses.root, className))}
  >
    <h2
      tabindex="-1"
      class={cls(`text-text-primary text-lg font-semibold ${STEP_HEADING}`, slotClasses.title)}
    >
      {t.twoFactor.title}
    </h2>

    <FormErrorAlert {error} {unstyled} class={slotClasses.error} />

    {#if view === 'idle'}
      <p class={cls('text-text-secondary text-sm', undefined)}>
        {enabled ? t.twoFactor.statusEnabled : t.twoFactor.description}
      </p>

      {#if enabled}
        <!-- Disable: password re-auth -->
        <form class={cls('flex flex-col gap-3', slotClasses.section)} onsubmit={disable}>
          <h3
            tabindex="-1"
            class={cls(
              `text-text-primary text-sm font-semibold ${STEP_HEADING}`,
              slotClasses.sectionTitle
            )}
          >
            {t.twoFactor.disableTitle}
          </h3>
          <p class={cls('text-text-tertiary text-sm', undefined)}>
            {t.twoFactor.disableDescription}
          </p>
          <Input
            label={t.twoFactor.disablePassword}
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
            {t.twoFactor.disableConfirm}
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
          {t.twoFactor.enable}
        </Button>
      {/if}
    {:else if view === 'setup'}
      <!-- Setup: scan the QR / enter the key, then confirm a code -->
      <h3
        tabindex="-1"
        class={cls(
          `text-text-primary text-sm font-semibold ${STEP_HEADING}`,
          slotClasses.sectionTitle
        )}
      >
        {t.twoFactor.setupTitle}
      </h3>
      <p class={cls('text-text-secondary text-sm', undefined)}>
        {t.twoFactor.setupScan}
      </p>

      {#if qr}
        {@render qr({ uri: setupUri, secret: setupSecret })}
      {/if}

      <div class={cls('flex flex-col gap-1', undefined)}>
        <span class={cls('text-text-tertiary text-xs', undefined)}>
          {t.twoFactor.setupSecret}
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
          label={t.twoFactor.setupCode}
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
            {t.twoFactor.setupConfirm}
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
            {t.twoFactor.cancel}
          </Button>
        </div>
      </form>
    {:else if view === 'backup'}
      <!-- One-time backup codes -->
      <h3
        tabindex="-1"
        class={cls(
          `text-text-primary text-sm font-semibold ${STEP_HEADING}`,
          slotClasses.sectionTitle
        )}
      >
        {t.twoFactor.backupTitle}
      </h3>
      <p class={cls('text-text-tertiary text-sm', undefined)}>
        {t.twoFactor.backupDescription}
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
          {t.twoFactor.backupDownload}
        </Button>
        <Button
          variant="filled"
          intent="primary"
          size="sm"
          onclick={finishBackup}
          {unstyled}
          class={slotClasses.submit}
        >
          {t.twoFactor.backupDone}
        </Button>
      </div>
    {/if}

    <Separator {unstyled} />
  </div>
{/if}
