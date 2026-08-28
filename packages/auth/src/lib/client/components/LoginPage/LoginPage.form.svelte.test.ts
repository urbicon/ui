// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import type { LoginPageProps } from './index.js';
import LoginPage from './LoginPage.svelte';

// The form paths of the login page: password sign-in, the two-step branch, and
// what the page tells the user when the server says no. The WebAuthn ceremony
// itself is covered in the sibling suite; the one passkey case here stops at
// the options request, before any authenticator is asked.

const mountInBody = mounter();
const render = (props: Partial<LoginPageProps> = {}) =>
  mountInBody(LoginPage, props as LoginPageProps);

const liveRegion = () => document.body.querySelector('[aria-live="polite"]') as HTMLElement;

async function signIn(email = 'ada@example.com', password = 'hunter2hunter2') {
  await userEvent.type(screen.getByLabelText('Email address'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await settle();
}

const lastRequestBody = (fetcher: typeof globalThis.fetch) => {
  const calls = vi.mocked(fetcher).mock.calls;
  const [, init] = calls[calls.length - 1] as [string, RequestInit];
  return JSON.parse(init.body as string);
};

describe('LoginPage — form paths', () => {
  it('renders the labelled fields and the default links', () => {
    render({ fetcher: fetcherReturning() });

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByLabelText('Email address').getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
    expect(screen.getByRole('link', { name: 'Forgot password?' }).getAttribute('href')).toBe(
      '/auth/forgot-password'
    );
    expect(screen.getByRole('link', { name: 'Create account' }).getAttribute('href')).toBe(
      '/auth/register'
    );
    // The region exists before there is anything to say — that is what makes
    // a later error an announcement rather than a silent DOM change.
    expect(liveRegion()).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls onSuccess once the server accepts the credentials', async () => {
    const onSuccess = vi.fn();
    const fetcher = fetcherReturning(jsonResponse(200, { user: { id: 'u1' } }));
    render({ onSuccess, fetcher });

    await signIn();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(lastRequestBody(fetcher)).toEqual({
      email: 'ada@example.com',
      password: 'hunter2hunter2'
    });
  });

  it('sends rememberMe only when the box is shown and ticked', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, { user: { id: 'u1' } }));
    render({ rememberMe: true, fetcher });

    await userEvent.click(screen.getByLabelText('Remember me'));
    await signIn();

    expect(lastRequestBody(fetcher)).toMatchObject({ rememberMe: true });
  });

  it('announces a refusal in the live region and keeps onSuccess unfired', async () => {
    const onSuccess = vi.fn();
    render({
      onSuccess,
      fetcher: fetcherReturning(jsonResponse(401, { code: 'invalid_credentials' })),
      slotClasses: { error: 'qa-error' }
    });

    await signIn();

    const alert = screen.getByRole('alert');
    expect(liveRegion().contains(alert)).toBe(true);
    expect(alert.textContent).toContain('Invalid email or password');
    expect(alert.className).toContain('qa-error');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('switches to the code step on twoFactorRequired and completes the login from there', async () => {
    const onSuccess = vi.fn();
    const fetcher = fetcherReturning(
      jsonResponse(200, { twoFactorRequired: true }),
      jsonResponse(200, { user: { id: 'u1' } })
    );
    render({ onSuccess, fetcher });

    await signIn();

    // No session exists yet: a 200 with twoFactorRequired must not count as
    // signed in.
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Two-step verification' })).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();

    await userEvent.type(screen.getByLabelText('Authentication code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();

    expect(vi.mocked(fetcher).mock.calls[1][0]).toBe('/api/auth/2fa/verify');
    expect(lastRequestBody(fetcher)).toEqual({ code: '123456' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('reports a wrong code without leaving the code step', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { twoFactorRequired: true }),
        jsonResponse(401, { code: 'invalid_code' })
      )
    });

    await signIn();
    await userEvent.type(screen.getByLabelText('Authentication code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('Invalid code');
    expect(screen.getByLabelText('Authentication code')).toBeTruthy();
  });

  it('does not treat a 200 without a user as signed in', async () => {
    const onSuccess = vi.fn();
    render({ onSuccess, fetcher: fetcherReturning(jsonResponse(200, {})) });

    await signIn();

    // A captive portal or broken proxy answers 200 with a body of its own;
    // reporting success would send the consumer into a navigate → guard-bounce
    // loop with no session and no feedback.
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
  });

  it('does not treat a 200 without a user as a verified code either', async () => {
    const onSuccess = vi.fn();
    render({
      onSuccess,
      fetcher: fetcherReturning(
        jsonResponse(200, { twoFactorRequired: true }),
        jsonResponse(200, {})
      )
    });

    await signIn();
    await userEvent.type(screen.getByLabelText('Authentication code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await settle();

    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByLabelText('Authentication code')).toBeTruthy();
  });

  it('reports a thrown fetch as a network error', async () => {
    render({ fetcher: fetcherReturning(new TypeError('Failed to fetch')) });

    await signIn();

    expect(screen.getByRole('alert').textContent).toContain('Network error');
  });

  it('hides the password form in passkey-only mode', () => {
    render({ mode: 'passkey', passkeyApiPath: '/api/auth/passkey', fetcher: fetcherReturning() });

    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  describe('passkey options request', () => {
    // The button only renders where the platform could answer; neither exists
    // in jsdom, so the probe is satisfied by hand. The options request fails
    // before the (absent) authenticator is ever consulted.
    afterEach(() => {
      Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
      Reflect.deleteProperty(navigator, 'credentials');
    });

    it.each([
      ['null', null],
      ['an array', []]
    ])(
      'reports a refusal whose JSON body is %s as the generic error, not as a failed sign-in',
      async (_, body) => {
        Object.defineProperty(globalThis, 'PublicKeyCredential', {
          configurable: true,
          value: class {}
        });
        Object.defineProperty(navigator, 'credentials', {
          configurable: true,
          value: { get: vi.fn() }
        });
        render({
          passkeyApiPath: '/api/auth/passkey',
          fetcher: fetcherReturning(jsonResponse(500, body))
        });
        await settle();

        await userEvent.click(screen.getByRole('button', { name: 'Sign in with passkey' }));
        await settle();

        // The server refused before any ceremony ran — "sign-in failed" would
        // point the user at their authenticator, which was never asked.
        expect(screen.getByRole('alert').textContent).toContain('An error occurred');
      }
    );
  });
});
