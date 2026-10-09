<script lang="ts">
  import { Button, Checkbox, Input, Separator, getBlocksConfig } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import type { LoginPageProps } from './index.js';
  import { base64UrlToBuffer, bufferToBase64Url } from '../../utils/webauthn.js';
  import {
    errorTextFromBody,
    parseJsonBody,
    postJson,
    userFromSuccess,
    wireError
  } from '../../utils/http.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import AuthPageShell from '../_shared/AuthPageShell.svelte';

  let {
    t: tProp,
    onSuccess,
    mode = 'both',
    rememberMe: showRememberMe = false,
    registerUrl = '/auth/register',
    forgotPasswordUrl = '/auth/forgot-password',
    apiPath = '/api/auth/login',
    twoFactorApiPath = '/api/auth/2fa/verify',
    passkeyApiPath,
    csrf,
    fetcher,
    header: headerSnippet,
    footer: footerSnippet,
    links: linksSnippet,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: LoginPageProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'LoginPage', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  let email = $state('');
  let password = $state('');
  let rememberMeChecked = $state(false);
  let error = $state('');
  let submitting = $state(false);
  let passkeyLoading = $state(false);

  // Two-step state: set after a password login returns `twoFactorRequired`.
  let awaitingTwoFactor = $state(false);
  let twoFactorCode = $state('');

  // Probed after mount (client-only): a top-level `typeof window` check would
  // make the passkey button render only on the client, mismatching the server's
  // button-less SSR HTML during hydration. Starting false and setting it in
  // onMount keeps SSR and the first client render in agreement.
  let passkeySupported = $state(false);
  onMount(() => {
    passkeySupported = 'credentials' in navigator && typeof PublicKeyCredential !== 'undefined';
  });

  const showPassword = $derived(mode === 'password' || mode === 'both');
  const showPasskey = $derived(
    (mode === 'passkey' || mode === 'both') && !!passkeyApiPath && passkeySupported
  );

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = '';
    submitting = true;

    try {
      const { ok, data } = await postJson(
        apiPath,
        {
          email,
          password,
          ...(showRememberMe && rememberMeChecked ? { rememberMe: true } : {})
        },
        { csrf, fetcher }
      );
      if (!ok) {
        const w = wireError(data);
        error = errorMessageFromCode(w.code, t, w.error) ?? t.auth.login.errors.invalid;
        return;
      }
      // Password ok, but the account has 2FA on: switch to the code-entry step
      // instead of completing the login. No session exists yet.
      if (data.twoFactorRequired) {
        awaitingTwoFactor = true;
        return;
      }
      if (!userFromSuccess(data)) {
        error = t.auth.errors.serverError;
        return;
      }
      onSuccess?.();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      submitting = false;
    }
  }

  async function handleTwoFactorSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (submitting) return;
    error = '';
    submitting = true;

    try {
      const { ok, data } = await postJson(
        twoFactorApiPath,
        { code: twoFactorCode },
        { csrf, fetcher }
      );
      if (!ok) {
        const w = wireError(data);
        error = errorMessageFromCode(w.code, t, w.error) ?? t.twoFactor.invalidCode;
        return;
      }
      if (!userFromSuccess(data)) {
        error = t.auth.errors.serverError;
        return;
      }
      onSuccess?.();
    } catch {
      error = t.auth.errors.networkError;
    } finally {
      submitting = false;
    }
  }

  async function handlePasskeyLogin() {
    if (!passkeyApiPath || passkeyLoading) return;
    error = '';
    passkeyLoading = true;

    try {
      const optRes = await csrfFetch(
        `${passkeyApiPath}/authentication-options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email || undefined })
        },
        csrf,
        fetcher
      );
      if (!optRes.ok) {
        error = errorTextFromBody(await parseJsonBody(optRes), t);
        return;
      }
      const { options } = await optRes.json();

      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: base64UrlToBuffer(options.challenge),
        allowCredentials: (options.allowCredentials ?? []).map(
          (c: { id: string; type?: string; transports?: string[] }) => ({
            ...c,
            id: base64UrlToBuffer(c.id)
          })
        )
      };

      const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions
      })) as PublicKeyCredential;

      if (!credential) {
        error = t.passkeys.cancelled;
        return;
      }

      const assertionResponse = credential.response as AuthenticatorAssertionResponse;

      const verifyRes = await csrfFetch(
        `${passkeyApiPath}/authentication-verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credential: {
              id: credential.id,
              rawId: bufferToBase64Url(credential.rawId),
              type: credential.type,
              response: {
                clientDataJSON: bufferToBase64Url(assertionResponse.clientDataJSON),
                authenticatorData: bufferToBase64Url(assertionResponse.authenticatorData),
                signature: bufferToBase64Url(assertionResponse.signature),
                userHandle: assertionResponse.userHandle
                  ? bufferToBase64Url(assertionResponse.userHandle)
                  : undefined
              }
            }
          })
        },
        csrf,
        fetcher
      );

      const data = await parseJsonBody(verifyRes);
      if (!verifyRes.ok) {
        error = errorTextFromBody(data, t);
        return;
      }
      if (!userFromSuccess(data)) {
        error = t.auth.errors.serverError;
        return;
      }
      onSuccess?.();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // NotAllowedError is the browser's privacy catch-all: a user cancel,
        // but also a timeout or an iframe permissions-policy denial. Staying
        // silent here (the old behaviour) made the button appear dead in the
        // non-cancel cases — surface the same message PasskeyManager shows.
        error = t.passkeys.cancelled;
      } else {
        error = t.passkeys.loginFailed;
      }
    } finally {
      passkeyLoading = false;
    }
  }

  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<AuthPageShell
  title={awaitingTwoFactor ? t.twoFactor.loginTitle : t.auth.login.title}
  {error}
  header={headerSnippet}
  {unstyled}
  {slotClasses}
  class={className}
>
  {#if awaitingTwoFactor}
    <form onsubmit={handleTwoFactorSubmit} class={cls('flex flex-col gap-4', slotClasses.form)}>
      <p class={cls('text-text-secondary text-sm')}>
        {t.twoFactor.loginPrompt}
      </p>
      <Input
        label={t.twoFactor.loginCode}
        inputmode="numeric"
        autoComplete="one-time-code"
        bind:value={twoFactorCode}
        required
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
        {t.twoFactor.loginSubmit}
      </Button>
      <p class={cls('text-text-tertiary text-center text-xs')}>
        {t.twoFactor.loginBackupHint}
      </p>
    </form>
  {:else}
    {#if showPassword}
      <form onsubmit={handleSubmit} class={cls('flex flex-col gap-4', slotClasses.form)}>
        <Input
          label={t.auth.login.email}
          type="email"
          bind:value={email}
          required
          autoComplete="email"
          {unstyled}
          class={slotClasses.field}
        />

        <Input
          label={t.auth.login.password}
          type="password"
          bind:value={password}
          required
          autoComplete="current-password"
          {unstyled}
          class={slotClasses.field}
        />

        {#if showRememberMe}
          <Checkbox bind:checked={rememberMeChecked} label={t.auth.login.rememberMe} {unstyled} />
        {/if}

        <Button
          type="submit"
          variant="filled"
          intent="primary"
          loading={submitting}
          disabled={submitting}
          {unstyled}
          class={cls('mt-2 w-full', slotClasses.submit)}
        >
          {t.auth.login.submit}
        </Button>
      </form>
    {/if}

    {#if showPassword && showPasskey}
      <div class={cls('my-4 flex items-center gap-3')}>
        <Separator {unstyled} class={cls('flex-1')} />
        <span class={cls('text-text-tertiary text-xs')}>{t.passkeys.or}</span>
        <Separator {unstyled} class={cls('flex-1')} />
      </div>
    {/if}

    {#if showPasskey}
      <Button
        variant="outlined"
        intent="neutral"
        loading={passkeyLoading}
        disabled={passkeyLoading || submitting}
        onclick={handlePasskeyLogin}
        {unstyled}
        class={cls('w-full')}
      >
        {t.passkeys.loginWithPasskey}
      </Button>
    {/if}

    {#if footerSnippet}
      <div class={cls('mt-4')}>
        {@render footerSnippet()}
      </div>
    {/if}

    {#if linksSnippet}
      {@render linksSnippet()}
    {:else}
      <div
        class={cls(
          'text-text-secondary mt-6 flex flex-col items-center gap-2 text-sm',
          slotClasses.links
        )}
      >
        <a href={forgotPasswordUrl} class={cls('text-text-link hover:underline')}>
          {t.auth.login.forgotPassword}
        </a>
        <span>
          {t.auth.login.noAccount}
          <a href={registerUrl} class={cls('text-text-link hover:underline')}>
            {t.auth.login.register}
          </a>
        </span>
      </div>
    {/if}
  {/if}
</AuthPageShell>
