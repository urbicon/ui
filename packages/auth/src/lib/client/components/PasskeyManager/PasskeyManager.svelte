<script lang="ts">
  import { Button, Separator, Spinner, getBlocksConfig } from '@urbicon-ui/blocks';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { PasskeyManagerProps } from './index.js';
  import { base64UrlToBuffer, bufferToBase64Url } from '../../utils/webauthn.js';
  import { errorTextFromBody, getJson, parseJsonBody } from '../../utils/http.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';

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

<div class={cls('flex flex-col gap-4', [slotClasses.root, className].filter(Boolean).join(' '))}>
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

  <FormErrorAlert {error} {unstyled} class={slotClasses.error} />

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
            'bg-surface-subtle border-border-subtle flex items-center justify-between rounded-lg border px-4 py-3',
            slotClasses.item
          )}
        >
          <div class={cls('flex flex-col gap-0.5')}>
            <span class={cls('text-text-primary text-sm font-medium')}>{passkey.name}</span>
            <span class={cls('text-text-tertiary text-xs')}>
              {new Date(passkey.createdAt).toLocaleDateString()}
              {#if passkey.lastUsedAt}
                &middot; {t.passkeys.lastUsed}: {new Date(passkey.lastUsedAt).toLocaleDateString()}
              {/if}
            </span>
          </div>
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
        </li>
      {/each}
    </ul>
  {/if}
</div>
