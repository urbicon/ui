<script lang="ts">
  import { Button, Input, Card, Alert, Checkbox, Separator } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';
  import { useAuthLocale } from '../../../i18n/index.js';
  import { csrfFetch } from '../../csrf.js';
  import { errorMessageFromCode } from '../../utils/error-message.js';
  import type { LoginPageProps } from './index.js';
  import { base64UrlToBuffer, bufferToBase64Url } from '../../utils/webauthn.js';

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
    unstyled = false,
    slotClasses = {},
    class: className
  }: LoginPageProps = $props();

  const authLocale = useAuthLocale();
  const t = $derived(tProp ?? authLocale());

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
      const res = await csrfFetch(
        apiPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            ...(showRememberMe && rememberMeChecked ? { rememberMe: true } : {})
          })
        },
        csrf,
        fetcher
      );
      const data = await res.json();
      if (!res.ok) {
        error = errorMessageFromCode(data.code, t, data.error) ?? t.auth.login.errors.invalid;
        return;
      }
      // Password ok, but the account has 2FA on: switch to the code-entry step
      // instead of completing the login. No session exists yet.
      if (data.twoFactorRequired) {
        awaitingTwoFactor = true;
        return;
      }
      onSuccess?.();
    } catch {
      error = t.auth.login.errors.invalid;
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
      const res = await csrfFetch(
        twoFactorApiPath,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: twoFactorCode })
        },
        csrf,
        fetcher
      );
      const data = await res.json();
      if (!res.ok) {
        error =
          errorMessageFromCode(data.code, t, data.error) ??
          t.twoFactor?.invalidCode ??
          t.auth.login.errors.invalid;
        return;
      }
      onSuccess?.();
    } catch {
      error = t.twoFactor?.invalidCode ?? t.auth.login.errors.invalid;
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
        const data = await optRes.json().catch(() => ({}));
        error = data.error ?? 'Passkey login failed';
        return;
      }
      const { options } = await optRes.json();

      // eslint-disable-next-line no-undef
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

      if (!credential) return;

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

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        error = data.error ?? 'Passkey login failed';
        return;
      }

      onSuccess?.();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // User cancelled
      } else {
        error = 'Passkey login failed';
      }
    } finally {
      passkeyLoading = false;
    }
  }
</script>

<div
  class={unstyled
    ? [slotClasses.root, className].filter(Boolean).join(' ')
    : ['flex min-h-[60vh] items-center justify-center', slotClasses.root, className]
        .filter(Boolean)
        .join(' ')}
>
  <Card
    variant="outlined"
    padding="xl"
    {unstyled}
    class={unstyled
      ? slotClasses.card
      : ['w-full max-w-md', slotClasses.card].filter(Boolean).join(' ')}
  >
    <h1
      class={unstyled
        ? slotClasses.title
        : ['text-text-primary mb-6 text-2xl font-semibold', slotClasses.title]
            .filter(Boolean)
            .join(' ')}
    >
      {awaitingTwoFactor
        ? (t.twoFactor?.loginTitle ?? 'Two-step verification')
        : t.auth.login.title}
    </h1>

    {#if headerSnippet}
      {@render headerSnippet()}
    {/if}

    <div aria-live="polite">
      {#if error}
        <Alert
          intent="danger"
          size="sm"
          {unstyled}
          class={['mb-4', slotClasses.error].filter(Boolean).join(' ')}
        >
          {error}
        </Alert>
      {/if}
    </div>

    {#if awaitingTwoFactor}
      <form
        onsubmit={handleTwoFactorSubmit}
        class={unstyled
          ? slotClasses.form
          : ['flex flex-col gap-4', slotClasses.form].filter(Boolean).join(' ')}
      >
        <p class={unstyled ? undefined : 'text-text-secondary text-sm'}>
          {t.twoFactor?.loginPrompt ?? 'Enter the code from your authenticator app.'}
        </p>
        <Input
          label={t.twoFactor?.loginCode ?? 'Authentication code'}
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
          class={unstyled
            ? slotClasses.submit
            : ['mt-2 w-full', slotClasses.submit].filter(Boolean).join(' ')}
        >
          {t.twoFactor?.loginSubmit ?? 'Verify'}
        </Button>
        <p class={unstyled ? undefined : 'text-text-tertiary text-center text-xs'}>
          {t.twoFactor?.loginBackupHint ?? 'You can also enter one of your backup codes.'}
        </p>
      </form>
    {:else}
      {#if showPassword}
        <form
          onsubmit={handleSubmit}
          class={unstyled
            ? slotClasses.form
            : ['flex flex-col gap-4', slotClasses.form].filter(Boolean).join(' ')}
        >
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
            <Checkbox
              bind:checked={rememberMeChecked}
              label={t.auth.login.rememberMe ?? 'Remember me'}
              {unstyled}
            />
          {/if}

          <Button
            type="submit"
            variant="filled"
            intent="primary"
            loading={submitting}
            disabled={submitting}
            {unstyled}
            class={unstyled
              ? slotClasses.submit
              : ['mt-2 w-full', slotClasses.submit].filter(Boolean).join(' ')}
          >
            {t.auth.login.submit}
          </Button>
        </form>
      {/if}

      {#if showPassword && showPasskey}
        <div class="my-4 flex items-center gap-3">
          <Separator {unstyled} class="flex-1" />
          <span class="text-text-tertiary text-xs">{t.passkeys?.or ?? 'or'}</span>
          <Separator {unstyled} class="flex-1" />
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
          class={unstyled ? undefined : 'w-full'}
        >
          {t.passkeys?.loginWithPasskey ?? 'Sign in with passkey'}
        </Button>
      {/if}

      {#if footerSnippet}
        <div class="mt-4">
          {@render footerSnippet()}
        </div>
      {/if}

      {#if linksSnippet}
        {@render linksSnippet()}
      {:else}
        <div
          class={unstyled
            ? slotClasses.links
            : [
                'text-text-secondary mt-6 flex flex-col items-center gap-2 text-sm',
                slotClasses.links
              ]
                .filter(Boolean)
                .join(' ')}
        >
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={forgotPasswordUrl} class="text-text-link hover:underline">
            {t.auth.login.forgotPassword}
          </a>
          <span>
            {t.auth.login.noAccount}
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a href={registerUrl} class="text-text-link hover:underline">{t.auth.login.register}</a>
          </span>
        </div>
      {/if}
    {/if}
  </Card>
</div>
