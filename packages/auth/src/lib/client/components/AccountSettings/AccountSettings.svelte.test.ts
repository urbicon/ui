// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../types.js';
import AccountSettings from './AccountSettings.svelte';
import type { AccountSettingsProps } from './index.js';

// Covers the danger zone: deleting an account is the one action in this package
// that cannot be undone, so what guards it has to be described by a test rather
// than read off the markup. What is asserted here is what this component owns —
// the disabled trigger, the two-step confirmation, the failure path. The
// single-flight of the confirm click belongs to ConfirmDialog and is pinned in
// its own suite, not duplicated here (see the comment at `confirmDelete`).

const user: AuthUser = {
  id: 'u1',
  email: 'a@example.com',
  name: 'Ada',
  role: 'USER',
  emailVerified: true
} as AuthUser;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<AccountSettingsProps> = {}) {
  const instance = mount(AccountSettings, {
    target: document.body,
    props: { user, ...props } as AccountSettingsProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

/**
 * Let a request round-trip finish. A macrotask, not two microtasks: parsing a
 * real `Response` body takes an unspecified number of microtask turns, so
 * counting them is how a component test starts asserting against a DOM that has
 * not caught up yet.
 */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
}

// Three sections ask for the current password; the danger zone is the one that
// is a named landmark, which is how its field and trigger are told apart here.
const dangerZone = () => within(screen.getByRole('region', { name: 'Delete account' }));

/** Fill the password and walk the danger zone up to the open confirm dialog. */
async function openDeleteConfirm() {
  await userEvent.type(dangerZone().getByLabelText('Current password'), 'hunter2');
  await tick();
  await userEvent.click(dangerZone().getByRole('button', { name: 'Delete account' }));
  await tick();
  await tick();
}

/** The confirm button lives in the dialog, which jsdom keeps out of the tree. */
const confirmButton = () =>
  within(screen.getByRole('dialog', { hidden: true })).getByRole('button', {
    name: 'Delete account',
    hidden: true
  });

describe('AccountSettings — danger zone', () => {
  it('keeps the trigger inert until a password is entered', async () => {
    const fetcher = vi.fn() as unknown as typeof globalThis.fetch;
    render({ fetcher });

    const trigger = () => dangerZone().getByRole('button', { name: 'Delete account' });
    expect(trigger().hasAttribute('disabled')).toBe(true);

    await userEvent.type(dangerZone().getByLabelText('Current password'), 'hunter2');
    await tick();
    expect(trigger().hasAttribute('disabled')).toBe(false);
  });

  it('sends nothing until the confirmation is answered', async () => {
    const fetcher = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof globalThis.fetch;
    render({ fetcher });

    await openDeleteConfirm();
    // The policy lookup on mount is the password form's own traffic, not the
    // danger zone's — count only what leaves for the account endpoint.
    const accountRequests = () =>
      vi.mocked(fetcher).mock.calls.filter(([url]) => url !== '/api/auth/password-policy');
    // The one irreversible action in this package is two steps on purpose: the
    // trigger opens the dialog and nothing else. Wiring it straight to
    // `confirmDelete` would delete the account on the first click.
    expect(accountRequests()).toHaveLength(0);
    expect(screen.getByRole('dialog', { hidden: true })).toBeTruthy();

    await userEvent.click(confirmButton());
    await settle();
    expect(accountRequests()).toHaveLength(1);
  });

  it('reports a rejected delete instead of calling onDeleted', async () => {
    const onDeleted = vi.fn();
    render({
      onDeleted,
      fetcher: (async () =>
        jsonResponse(401, { code: 'invalid_credentials' })) as unknown as typeof globalThis.fetch
    });

    await openDeleteConfirm();
    await userEvent.click(confirmButton());
    await settle();

    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
