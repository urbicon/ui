<script lang="ts">
  import { Button, Separator, Spinner } from '@urbicon-ui/blocks';
  import FormErrorAlert from '../_shared/FormErrorAlert.svelte';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import type { PasskeyManagerProps } from './index.js';
  import { base64UrlToBuffer, bufferToBase64Url } from '../../utils/webauthn.js';
  import { errorTextFromBody } from '../../utils/http.js';
  import { slotClass } from '../../utils/slot-class.js';

  let {
    t: tProp,
    basePath = '/api/auth/passkey',
    csrf,
    fetcher,
    unstyled = false,
    slotClasses = {},
    class: className
  }: PasskeyManagerProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  // Wrapped so the default path calls the global fetch unbound-safe; a custom
  // fetcher (demo mock, test double, retry layer) takes precedence.
  const doFetch: typeof globalThis.fetch = (input, init) =>
    fetcher ? fetcher(input, init) : fetch(input, init);

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
  let error = $state('');

  async function loadPasskeys() {
    loading = true;
    try {
      const res = await doFetch(`${basePath}/list`);
      if (!res.ok) {
        // A 401/500 must not render as "no passkeys registered".
        error = t.common.error;
        return;
      }
      const data = await res.json();
      passkeys = data.passkeys ?? [];
    } catch {
      // Surface the failure instead of rendering the empty state, which is
      // indistinguishable from "no passkeys registered".
      error = t.auth.errors.networkError;
    } finally {
      loading = false;
    }
  }

  async function registerPasskey() {
    error = '';
    registering = true;

    try {
      // 1. Get registration options from server
      const optRes = await csrfFetch(
        `${basePath}/registration-options`,
        { method: 'POST' },
        csrf,
        fetcher
      );
      if (!optRes.ok) {
        const data = await optRes.json().catch(() => ({}));
        error = errorTextFromBody(data, t);
        return;
      }
      const { options } = await optRes.json();

      // 2. Decode challenge and user.id for browser API
      // eslint-disable-next-line no-undef
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
        error = t.passkeys.cancelled;
        return;
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // 4. Send to server for verification
      const verifyRes = await csrfFetch(
        `${basePath}/registration-verify`,
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
        const data = (await verifyRes.json().catch(() => ({}))) as Record<string, unknown>;
        error = errorTextFromBody(data, t);
        return;
      }

      await loadPasskeys();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        error = t.passkeys.cancelled;
      } else {
        error = t.passkeys.addFailed;
      }
    } finally {
      registering = false;
    }
  }

  async function deletePasskey(credentialId: string) {
    error = '';
    try {
      const res = await csrfFetch(
        `${basePath}/${encodeURIComponent(credentialId)}`,
        { method: 'DELETE' },
        csrf,
        fetcher
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        error = errorTextFromBody(data, t);
        return;
      }
      // Drop it locally only once the server confirms — an unchecked optimistic
      // remove would hide a failed delete and could lock the user out of a key
      // they think is gone.
      passkeys = passkeys.filter((p) => p.credentialId !== credentialId);
    } catch {
      error = t.auth.errors.networkError;
    }
  }

  // Fire-once load on mount — not an $effect: this must run exactly once, and
  // re-running on a reactive read (e.g. basePath) would re-fetch needlessly.
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

  <FormErrorAlert {error} {unstyled} />

  <Separator {unstyled} />

  {#if loading}
    <div class={cls('flex justify-center py-4')}>
      <Spinner size="sm" {unstyled} />
    </div>
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
