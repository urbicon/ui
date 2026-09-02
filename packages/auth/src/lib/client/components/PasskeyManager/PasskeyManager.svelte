<script lang="ts">
  import {
    Button,
    getBlocksConfig,
    Input,
    resolveClassChain,
    Separator,
    Spinner
  } from '@urbicon-ui/blocks';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import { onMount, tick } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { PasskeyManagerProps } from './index.js';
  import { base64UrlToBuffer, bufferToBase64Url } from '../../utils/webauthn.js';
  import { errorTextFromBody, getJson, parseJsonBody } from '../../utils/http.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import { MAX_DISPLAY_NAME_LENGTH } from '../../../display-name.js';

  let {
    t: tProp,
    apiPath = '/api/auth/passkey',
    csrf,
    fetcher,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: PasskeyManagerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'PasskeyManager', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  interface PasskeyItem {
    credentialId: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    aaguid: string;
  }

  let passkeys = $state<PasskeyItem[]>([]);
  let loading = $state(true);
  let registering = $state(false);
  // Two failures with different reach, kept apart so neither can silently
  // stand in for the other: `loadError` disowns the list region — spinner,
  // rows and "none yet" all describe a list that was actually fetched —
  // while `actionError` is a failed add or delete while the rows on screen stay
  // valid. Both speak through the one alert below, so the region can never go
  // blank without a message.
  let actionError = $state('');
  let loadError = $state('');
  const error = $derived(actionError || loadError);
  // Reported through the same live region as the errors, so a screen reader
  // hears the rename land — the row's own text changes silently otherwise.
  let actionSuccess = $state('');

  // The row being renamed, its draft, and whether the write is in flight. One
  // row at a time: a second open form would put two submit buttons and two
  // fields with the same label in the list at once.
  let renamingId = $state<string | null>(null);
  let renameDraft = $state('');
  let renameBusy = $state(false);

  const propsId = $props.id();
  // The rename trigger is unmounted while its row is in edit mode, so a stored
  // element reference would be stale by the time focus goes back to it. The id
  // survives the swap; `credentialId` is base64url, whose alphabet is valid in
  // one.
  const renameTriggerId = (credentialId: string) => `pk-rename-${propsId}-${credentialId}`;

  /**
   * Put the caret in the freshly-opened field with the current name selected,
   * so typing replaces it. A `const`, not an inline arrow: an attachment re-runs
   * whenever its value changes, and a new closure per render would re-select the
   * text on every keystroke.
   */
  const focusOnOpen = (node: HTMLElement) => {
    node.focus();
    (node as HTMLInputElement).select?.();
  };

  function onRenameKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    // The panel is mountable inside a Dialog or Drawer, which close on Escape.
    // The key belongs to the innermost thing it can dismiss — the rename form.
    e.stopPropagation();
    cancelRename();
  }

  /** Focus the row's rename button — where focus was before the form opened. */
  async function focusRenameTrigger(credentialId: string) {
    await tick();
    document.getElementById(renameTriggerId(credentialId))?.focus();
  }

  function startRename(passkey: PasskeyItem) {
    actionError = '';
    actionSuccess = '';
    renamingId = passkey.credentialId;
    renameDraft = passkey.name;
  }

  async function cancelRename() {
    // Inert, not unfocusable, while the write is in flight — abandoning the
    // form mid-request would leave the panel showing the old name for a rename
    // the server is about to commit.
    if (renameBusy) return;
    const credentialId = renamingId;
    renamingId = null;
    renameDraft = '';
    if (credentialId) await focusRenameTrigger(credentialId);
  }

  async function saveRename(e: SubmitEvent) {
    e.preventDefault();
    // A consumer may wrap this panel in a form of their own — a settings page
    // is the obvious one — and a rename is not their submit. Same reason
    // `onRenameKeydown` stops Escape.
    e.stopPropagation();
    // Enter during a flight would submit a second time: the field stays
    // focusable while the request runs (see the markup), so the guard is here
    // rather than on the control.
    if (renameBusy) return;
    const credentialId = renamingId;
    if (!credentialId) return;
    actionError = '';
    actionSuccess = '';
    renameBusy = true;
    try {
      const res = await csrfFetch(
        `${apiPath}/${encodeURIComponent(credentialId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: renameDraft })
        },
        csrf,
        fetcher
      );
      if (!res.ok) {
        // The form stays open on its draft and nothing here moves focus, which
        // is only a true statement because the in-flight state leaves every
        // control focusable — a `disabled` field loses focus to <body> the
        // moment it is set, and the refusal would strand the user at the top of
        // the document. Measured in Chromium and Firefox; jsdom does not
        // implement it, so the guarding test is an e2e one.
        actionError = errorTextFromBody(await parseJsonBody(res), t);
        return;
      }
      const updated = (await parseJsonBody(res)).passkey as PasskeyItem | undefined;
      if (updated) {
        // Adopt the server's row rather than the draft — the server trims, so
        // echoing the draft would show a name the store does not hold.
        passkeys = passkeys.map((p) => (p.credentialId === credentialId ? updated : p));
      } else {
        // A 2xx carrying no row says the rename happened but not what was
        // stored. Re-read instead of guessing.
        await loadPasskeys();
      }
      renamingId = null;
      renameDraft = '';
      actionSuccess = t.passkeys.renamed;
      await focusRenameTrigger(credentialId);
    } catch {
      actionError = t.auth.errors.networkError;
    } finally {
      renameBusy = false;
    }
  }

  async function loadPasskeys() {
    loading = true;
    loadError = '';
    try {
      const { ok, data } = await getJson(`${apiPath}/list`, { fetcher });
      if (!ok) {
        // A 401/500 must not render as "no passkeys registered".
        loadError = errorTextFromBody(data, t);
        return;
      }
      passkeys = (data.passkeys as PasskeyItem[] | undefined) ?? [];
    } catch {
      // Surface the failure instead of rendering the empty state, which is
      // indistinguishable from "no passkeys registered".
      loadError = t.auth.errors.networkError;
    } finally {
      loading = false;
    }
  }

  async function registerPasskey() {
    actionError = '';
    actionSuccess = '';
    registering = true;

    try {
      // 1. Get registration options from server
      const optRes = await csrfFetch(
        `${apiPath}/registration-options`,
        { method: 'POST' },
        csrf,
        fetcher
      );
      if (!optRes.ok) {
        actionError = errorTextFromBody(await parseJsonBody(optRes), t);
        return;
      }
      const { options } = await optRes.json();

      // 2. Decode challenge and user.id for browser API
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        ...options,
        challenge: base64UrlToBuffer(options.challenge),
        user: {
          ...options.user,
          id: base64UrlToBuffer(options.user.id)
        },
        excludeCredentials: (options.excludeCredentials ?? []).map(
          (c: { id: string; type?: string; transports?: string[] }) => ({
            ...c,
            id: base64UrlToBuffer(c.id)
          })
        )
      };

      // 3. Call browser WebAuthn API
      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions
      })) as PublicKeyCredential;

      if (!credential) {
        actionError = t.passkeys.cancelled;
        return;
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // 4. Send to server for verification
      const verifyRes = await csrfFetch(
        `${apiPath}/registration-verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential: {
              id: credential.id,
              rawId: bufferToBase64Url(credential.rawId),
              type: credential.type,
              response: {
                clientDataJSON: bufferToBase64Url(attestationResponse.clientDataJSON),
                attestationObject: bufferToBase64Url(attestationResponse.attestationObject),
                transports: attestationResponse.getTransports?.() ?? []
              }
            }
          })
        },
        csrf,
        fetcher
      );

      if (!verifyRes.ok) {
        actionError = errorTextFromBody(await parseJsonBody(verifyRes), t);
        return;
      }

      await loadPasskeys();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        actionError = t.passkeys.cancelled;
      } else {
        actionError = t.passkeys.addFailed;
      }
    } finally {
      registering = false;
    }
  }

  async function deletePasskey(credentialId: string) {
    actionError = '';
    actionSuccess = '';
    try {
      const res = await csrfFetch(
        `${apiPath}/${encodeURIComponent(credentialId)}`,
        { method: 'DELETE' },
        csrf,
        fetcher
      );
      if (!res.ok) {
        actionError = errorTextFromBody(await parseJsonBody(res), t);
        return;
      }
      // Drop it locally only once the server confirms — an unchecked optimistic
      // remove would hide a failed delete and could lock the user out of a key
      // they think is gone.
      passkeys = passkeys.filter((p) => p.credentialId !== credentialId);
    } catch {
      actionError = t.auth.errors.networkError;
    }
  }

  // Fire-once load on mount — not an $effect: this must run exactly once, and
  // re-running on a reactive read (e.g. apiPath) would re-fetch needlessly.
  onMount(() => {
    loadPasskeys();
  });

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<div class={cls('flex flex-col gap-4', resolveClassChain(slotClasses.root, className))}>
  <div class={cls('flex items-center justify-between gap-4')}>
    <h2 class={cls('text-text-primary min-w-0 truncate text-lg font-semibold', slotClasses.title)}>
      {t.passkeys.title}
    </h2>
    <Button
      variant="filled"
      intent="primary"
      size="sm"
      loading={registering}
      disabled={registering}
      onclick={registerPasskey}
      {unstyled}
      class={cls('shrink-0')}
    >
      {t.passkeys.add}
    </Button>
  </div>

  <FormErrorAlert
    {error}
    success={actionSuccess}
    {unstyled}
    class={slotClasses.error}
    successClass={slotClasses.success}
  />

  <Separator {unstyled} />

  {#if loading}
    <div class={cls('flex justify-center py-4')}>
      <Spinner size="sm" {unstyled} />
    </div>
  {:else if loadError}
    <!-- The alert above carries the reason; a list that was never fetched has no
         reading of its own down here. -->
  {:else if passkeys.length === 0}
    <p class={cls('text-text-tertiary py-4 text-center text-sm', slotClasses.empty)}>
      {t.passkeys.empty}
    </p>
  {:else}
    <ul class={cls('flex flex-col gap-2', slotClasses.list)}>
      {#each passkeys as passkey (passkey.credentialId)}
        <li
          class={cls(
            'bg-surface-subtle border-border-subtle flex items-center justify-between gap-3 rounded-lg border px-4 py-3',
            slotClasses.item
          )}
        >
          {#if renamingId === passkey.credentialId}
            <!-- Escape is handled on the form, not on the field: one Tab puts
                 focus on Save, and from there the key reaches a surrounding
                 Dialog and closes it with the rename form still open. The
                 listener sits on the container so a control added later is
                 covered without anyone remembering to wire it; every element
                 that can hold focus inside is itself interactive, which is what
                 the rule below is actually about. -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <form
              class={cls('flex w-full items-end gap-2', slotClasses.renameForm)}
              onsubmit={saveRename}
              onkeydown={onRenameKeydown}
            >
              <Input
                label={t.passkeys.renameLabel}
                bind:value={renameDraft}
                maxlength={MAX_DISPLAY_NAME_LENGTH}
                readonly={renameBusy}
                aria-busy={renameBusy}
                {@attach focusOnOpen}
                {unstyled}
                class={cls('min-w-0 flex-1', slotClasses.renameField)}
              />
              <Button
                type="submit"
                variant="filled"
                intent="primary"
                size="sm"
                loading={renameBusy}
                disabled={renameDraft.trim() === ''}
                {unstyled}
                class={cls('shrink-0')}
              >
                {t.passkeys.renameSave}
              </Button>
              <Button
                type="button"
                variant="ghost"
                intent="neutral"
                size="sm"
                aria-disabled={renameBusy}
                onclick={cancelRename}
                {unstyled}
                class={cls('shrink-0')}
              >
                {t.passkeys.renameCancel}
              </Button>
            </form>
          {:else}
            <div class={cls('flex min-w-0 flex-col gap-0.5')}>
              <span class={cls('text-text-primary truncate text-sm font-medium')}
                >{passkey.name}</span
              >
              <span class={cls('text-text-tertiary text-xs')}>
                {new Date(passkey.createdAt).toLocaleDateString()}
                {#if passkey.lastUsedAt}
                  &middot; {t.passkeys.lastUsed}: {new Date(
                    passkey.lastUsedAt
                  ).toLocaleDateString()}
                {/if}
              </span>
            </div>
            <div class={cls('flex shrink-0 items-center gap-1')}>
              <Button
                id={renameTriggerId(passkey.credentialId)}
                variant="ghost"
                intent="neutral"
                size="sm"
                onclick={() => startRename(passkey)}
                aria-label={`${t.passkeys.rename} — ${passkey.name}`}
                {unstyled}
              >
                {t.passkeys.rename}
              </Button>
              <Button
                variant="ghost"
                intent="danger"
                size="sm"
                onclick={() => deletePasskey(passkey.credentialId)}
                aria-label={`${t.passkeys.delete} — ${passkey.name}`}
                {unstyled}
              >
                {t.passkeys.delete}
              </Button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
