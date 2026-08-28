// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../types.js';
import { fetcherReturning, jsonResponse, mounter, settle } from '../__fixtures__/fetcher.js';
import type { TwoFactorManagerProps } from './index.js';
import TwoFactorManager from './TwoFactorManager.svelte';

// The panel renders its error inline rather than through the shared shell, so
// the `error` slot is the only handle a consumer has on it.

const user = {
  id: 'u1',
  email: 'a@example.com',
  name: 'Ada',
  role: 'USER',
  emailVerified: true,
  totpEnabled: false
} as AuthUser;

const mountInBody = mounter();
const render = (props: Partial<TwoFactorManagerProps> = {}) =>
  mountInBody(TwoFactorManager, { user, ...props } as TwoFactorManagerProps);

const enableButton = () => screen.getByRole('button', { name: 'Enable two-factor authentication' });

describe('TwoFactorManager', () => {
  it('renders a failed setup through the `error` slot', async () => {
    render({
      slotClasses: { error: 'qa-error' },
      fetcher: fetcherReturning(jsonResponse(500, { code: 'server_error' }))
    });

    await userEvent.click(enableButton());
    await settle();

    expect(screen.getByRole('alert').className).toContain('qa-error');
  });

  it('refuses a 200 that carries no TOTP material instead of opening a dead setup view', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(200, {})) });

    await userEvent.click(enableButton());
    await settle();

    // An empty QR payload and an empty key would be a setup screen nothing can
    // be confirmed from.
    expect(screen.queryByText('Setup key')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('walks setup → code → backup codes → enabled, reporting onEnabled once', async () => {
    const onEnabled = vi.fn();
    const fetcher = fetcherReturning(
      jsonResponse(200, { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x?secret=J' }),
      jsonResponse(200, { backupCodes: ['aaaa-1111', 'bbbb-2222'] })
    );
    render({ fetcher, onEnabled });

    await userEvent.click(enableButton());
    await settle();

    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Confirm and enable' });
    // Nothing to confirm yet.
    expect(confirm.hasAttribute('disabled')).toBe(true);

    await userEvent.type(screen.getByLabelText('Enter the 6-digit code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm and enable' }));
    await settle();

    const [, init] = vi.mocked(fetcher).mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ code: '123456' });
    expect(screen.getByText('aaaa-1111')).toBeTruthy();
    expect(screen.getByText('bbbb-2222')).toBeTruthy();
    expect(onEnabled).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: "I've saved my codes" }));

    // Back on the idle view, the panel now reports 2FA as on — without a
    // round-trip, so the state has to have been flipped locally.
    expect(screen.queryByText('aaaa-1111')).toBeNull();
    expect(screen.getByText('Two-factor authentication is on.')).toBeTruthy();
    expect(screen.getByLabelText('Current password')).toBeTruthy();
  });

  it('turns 2FA off with the current password and reports onDisabled', async () => {
    const onDisabled = vi.fn();
    render({
      user: { ...user, totpEnabled: true } as AuthUser,
      onDisabled,
      fetcher: fetcherReturning(jsonResponse(200, {}))
    });

    const disable = () => screen.getByRole('button', { name: 'Disable' });
    expect(disable().hasAttribute('disabled')).toBe(true);
    await userEvent.type(screen.getByLabelText('Current password'), 'hunter2');
    expect(disable().hasAttribute('disabled')).toBe(false);

    await userEvent.click(disable());
    await settle();

    expect(onDisabled).toHaveBeenCalledTimes(1);
    expect(enableButton()).toBeTruthy();
  });
});
