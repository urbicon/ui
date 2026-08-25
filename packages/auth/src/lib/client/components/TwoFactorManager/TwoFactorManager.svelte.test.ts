// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthUser } from '../../../types.js';
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

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<TwoFactorManagerProps> = {}) {
  const instance = mount(TwoFactorManager, {
    target: document.body,
    props: { user, ...props } as TwoFactorManagerProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
}

describe('TwoFactorManager', () => {
  it('renders a failed setup through the `error` slot', async () => {
    render({
      slotClasses: { error: 'qa-error' },
      fetcher: (async () =>
        new Response(JSON.stringify({ code: 'server_error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })) as unknown as typeof globalThis.fetch
    });

    await userEvent.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));
    await settle();

    expect(screen.getByRole('alert').className).toContain('qa-error');
  });

  it('refuses a 200 that carries no TOTP material instead of opening a dead setup view', async () => {
    render({
      fetcher: (async () =>
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })) as unknown as typeof globalThis.fetch
    });

    await userEvent.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }));
    await settle();

    // An empty QR payload and an empty key would be a setup screen nothing can
    // be confirmed from.
    expect(screen.queryByText('Setup key')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
