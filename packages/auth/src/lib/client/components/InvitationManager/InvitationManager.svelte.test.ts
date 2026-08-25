// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InvitationManager from './InvitationManager.svelte';
import type { InvitationManagerProps } from './index.js';

// First component test in this package. It mounts a real component, so it needs
// both jsdom knobs the blocks-testing skill names: the docblock above and
// `resolve.conditions: ['browser']` in vitest.config.ts. Without the condition
// Svelte resolves to its server build and `mount()` dies on
// `lifecycle_function_unavailable` — and `onMount`, which is how every manager
// in this package loads its data, never runs.
//
// The suite drives the component through its injected `fetcher`, so no global
// fetch is touched and each test states its own server.

const roles = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER', label: 'User' }
];

const invitation = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  email: 'invitee@example.com',
  role: 'USER',
  usedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/** A fetch that answers each call from the queue, in order. */
function fetcherReturning(...responses: Array<Response | Error>): typeof globalThis.fetch {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('fetcher queue exhausted');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof globalThis.fetch;
}

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<InvitationManagerProps> = {}) {
  const instance = mount(InvitationManager, {
    target: document.body,
    props: { roles, ...props } as InvitationManagerProps
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

describe('InvitationManager (component)', () => {
  it('loads the list on mount and renders one row per invitation', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { invitations: [invitation({ email: 'a@example.com' })] })
      )
    });
    await settle();

    expect(screen.getByText('a@example.com')).toBeTruthy();
    expect(screen.queryByText('No invitations yet.')).toBeNull();
  });

  it('renders the error, not the empty state, when the load fails', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(401, { code: 'unauthorized' })) });
    await settle();

    // The empty state would read as "nobody has been invited" — a 401 must not
    // be indistinguishable from an empty list.
    expect(screen.queryByText('No invitations yet.')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('shows the empty state through the `empty` slot when the list is empty', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(200, { invitations: [] })),
      slotClasses: { empty: 'my-empty' }
    });
    await settle();

    const empty = screen.getByText('No invitations yet.');
    expect(empty.className).toContain('my-empty');
  });

  it('never leaves the list region blank and silent after a failed load', async () => {
    let releaseSend: ((res: Response) => void) | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse(401, { code: 'unauthorized' }))
      .mockImplementationOnce(() => new Promise<Response>((r) => (releaseSend = r)));
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });
    await settle();

    expect(screen.queryByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No invitations yet.')).toBeNull();

    await userEvent.type(screen.getByLabelText(/Email address/), 'invitee@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await tick();

    // Submitting clears the *action* error. The load failure still owns the list
    // region, so the region shows nothing — and the alert must therefore still
    // speak, or the user faces an unexplained blank where a list should be.
    expect(screen.queryByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No invitations yet.')).toBeNull();

    releaseSend?.(jsonResponse(500, {}));
    await settle();
  });

  it('keeps the row and shows the error when a delete fails', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { invitations: [invitation()] }),
        jsonResponse(500, { code: 'server_error' })
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /Delete — invitee@example.com/ }));
    await settle();

    // An optimistic remove would hide a delete that never happened.
    expect(screen.getByText('invitee@example.com')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('drops the row once the server confirms the delete', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { invitations: [invitation()] }),
        jsonResponse(200, {})
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /Delete — invitee@example.com/ }));
    await settle();

    expect(screen.queryByText('invitee@example.com')).toBeNull();
    expect(screen.getByText('No invitations yet.')).toBeTruthy();
  });
});
