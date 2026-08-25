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
// than read off the markup.

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

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
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
  it('sends one delete request when the confirm button is clicked twice', async () => {
    let release: ((res: Response) => void) | undefined;
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        })
    ) as unknown as typeof globalThis.fetch;
    render({ fetcher });

    await openDeleteConfirm();

    await userEvent.click(confirmButton());
    await tick();
    await userEvent.click(confirmButton());
    await tick();

    // ConfirmDialog owns the single-flight guard (its `busy` flag disables both
    // buttons and `handleConfirm` returns early while loading), which is why the
    // handler here carries none of its own.
    expect(fetcher).toHaveBeenCalledTimes(1);

    release?.(jsonResponse(200, {}));
    await settle();
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
