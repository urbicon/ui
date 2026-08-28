// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PASSWORD_POLICY } from '../../../password-policy.js';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import type { ResetPasswordPageProps } from './index.js';
import ResetPasswordPage from './ResetPasswordPage.svelte';

// The policy is passed as a prop throughout (see the RegisterPage suite).

const mountInBody = mounter();
const render = (props: Partial<ResetPasswordPageProps> = {}) =>
  mountInBody(ResetPasswordPage, {
    token: 'reset-1',
    passwordPolicy: DEFAULT_PASSWORD_POLICY,
    ...props
  } as ResetPasswordPageProps);

const liveRegion = () => document.body.querySelector('[aria-live="polite"]') as HTMLElement;

async function reset(password = 'hunter2hunter2', confirm = password) {
  await userEvent.type(screen.getByLabelText('New password'), password);
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  await settle();
}

describe('ResetPasswordPage', () => {
  it('renders the labelled fields and ties the password to its requirements', () => {
    render({ fetcher: fetcherReturning() });

    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeTruthy();
    const password = screen.getByLabelText('New password');
    expect(password.getAttribute('type')).toBe('password');
    const describedBy = password.getAttribute('aria-describedby') ?? '';
    const requirements = document.getElementById(describedBy);
    expect(requirements?.getAttribute('aria-label')).toBe('Password requirements');
    expect(screen.getByLabelText('Confirm new password').getAttribute('type')).toBe('password');
    expect(liveRegion()).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends the token and the new password, then swaps the form for the confirmation', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, {}));
    render({ fetcher, slotClasses: { success: 'qa-success' } });

    await reset();

    const [url, init] = vi.mocked(fetcher).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/reset-password');
    expect(JSON.parse(init.body as string)).toEqual({
      token: 'reset-1',
      password: 'hunter2hunter2'
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Your password has been reset.');
    expect(alert.className).toContain('qa-success');
    expect(liveRegion().contains(alert)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull();
    // The one link that appears only now: the user has a password to use.
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/auth/login');
  });

  it('refuses mismatching passwords before any request', async () => {
    const fetcher = fetcherReturning();
    render({ fetcher });

    await reset('hunter2hunter2', 'hunter2hunter3');

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Passwords do not match.');
  });

  it('announces an expired link in the live region and keeps the form', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(400, { code: 'invalid_token' })),
      slotClasses: { error: 'qa-error' }
    });

    await reset();

    const alert = screen.getByRole('alert');
    expect(liveRegion().contains(alert)).toBe(true);
    expect(alert.textContent).toContain('This link is invalid or has expired.');
    expect(alert.className).toContain('qa-error');
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeTruthy();
  });
});
