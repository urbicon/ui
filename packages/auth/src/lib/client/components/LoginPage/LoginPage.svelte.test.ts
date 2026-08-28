// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from '../../../i18n/de.js';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import type { LoginPageProps } from './index.js';
import LoginPage from './LoginPage.svelte';

// Mounts the real page with a stubbed WebAuthn surface: jsdom ships no
// `navigator.credentials`, so `get()` is a mock that returns an assertion-shaped
// object — enough to reach the verify request, whose refusal is what these
// tests are about. The button only renders once `onMount` has seen
// `PublicKeyCredential`, hence the global stub.

const optionsResponse = () =>
  jsonResponse(200, { options: { challenge: 'AAAA', allowCredentials: [] } });

const fakeAssertion = () => ({
  id: 'cred-1',
  rawId: new Uint8Array([1, 2, 3]).buffer,
  type: 'public-key',
  response: {
    clientDataJSON: new Uint8Array([4]).buffer,
    authenticatorData: new Uint8Array([5]).buffer,
    signature: new Uint8Array([6]).buffer,
    userHandle: null
  }
});

const mountInBody = mounter();

beforeEach(() => {
  vi.stubGlobal('PublicKeyCredential', class {});
  Object.defineProperty(navigator, 'credentials', {
    value: { get: vi.fn(async () => fakeAssertion()) },
    configurable: true
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(props: Partial<LoginPageProps>) {
  mountInBody(LoginPage, {
    mode: 'passkey',
    passkeyApiPath: '/api/auth/passkey',
    t: de,
    ...props
  } as LoginPageProps);
}

async function signInWithPasskey() {
  await settle(); // onMount → passkeySupported → button renders
  await userEvent.click(screen.getByRole('button', { name: de.passkeys.loginWithPasskey }));
  await settle();
}

describe('LoginPage passkey refusal copy (de)', () => {
  it('renders the way out for passkey_credential_deleted, not the English prose', async () => {
    render({
      fetcher: fetcherReturning(
        optionsResponse(),
        jsonResponse(400, {
          error: 'This passkey is no longer registered. Sign in another way, then set it up again.',
          code: 'passkey_credential_deleted'
        })
      )
    });
    await signInWithPasskey();

    expect(screen.getByText(de.auth.errors.passkeyCredentialDeleted)).toBeTruthy();
    expect(screen.queryByText(/no longer registered/)).toBeNull();
    expect(screen.queryByText(de.auth.errors.passkeyVerificationFailed)).toBeNull();
  });

  it('still renders "try again" for the uniform passkey_verification_failed', async () => {
    render({
      fetcher: fetcherReturning(
        optionsResponse(),
        jsonResponse(400, {
          error: 'Your passkey could not be verified. Please try again.',
          code: 'passkey_verification_failed'
        })
      )
    });
    await signInWithPasskey();

    expect(screen.getByText(de.auth.errors.passkeyVerificationFailed)).toBeTruthy();
    expect(screen.queryByText(de.auth.errors.passkeyCredentialDeleted)).toBeNull();
  });
});

describe('LoginPage passkey success body', () => {
  it('does not treat a 200 without a user on authentication-verify as signed in', async () => {
    const onSuccess = vi.fn();
    render({ onSuccess, fetcher: fetcherReturning(optionsResponse(), jsonResponse(200, {})) });
    await signInWithPasskey();

    // The same malformed success the password and 2FA steps refuse: a captive
    // portal or proxy answering the verify request with a body of its own.
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain(de.auth.errors.serverError);
  });
});
