// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProviderHarness from '../__fixtures__/ProviderHarness.svelte';
import type { PasskeyManagerProps } from './index.js';
import PasskeyManager from './PasskeyManager.svelte';

// Mounts the real component and drives it through its injected `fetcher`; see
// the sibling InvitationManager suite for why this needs both jsdom knobs.
//
// The WebAuthn call itself is out of reach here — jsdom ships no
// `navigator.credentials` and no authenticator — so the register path is
// covered where it is decidable: the cancel branch, which is the one the user
// reaches by pressing Escape on the platform prompt.

const passkey = (over: Record<string, unknown> = {}) => ({
  credentialId: 'c1',
  name: 'MacBook',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: null,
  aaguid: '00000000-0000-0000-0000-000000000000',
  ...over
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

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

function render(props: Partial<PasskeyManagerProps> = {}) {
  const instance = mount(PasskeyManager, {
    target: document.body,
    props: props as PasskeyManagerProps
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

describe('PasskeyManager (component)', () => {
  it('loads the list on mount and renders one row per passkey', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] })) });
    await settle();

    expect(screen.getByText('MacBook')).toBeTruthy();
    expect(screen.queryByText('No passkeys registered.')).toBeNull();
  });

  it('renders the error, not the empty state, when the load fails', async () => {
    render({ fetcher: fetcherReturning(jsonResponse(401, { code: 'unauthorized' })) });
    await settle();

    // "No passkeys registered." next to a 401 would invite the user to add a
    // key they may already have.
    expect(screen.queryByText('No passkeys registered.')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('never leaves the list region blank and silent after a failed load', async () => {
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { create: vi.fn(async () => null) }
    });
    let releaseOptions: ((res: Response) => void) | undefined;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse(401, { code: 'unauthorized' }))
      .mockImplementationOnce(() => new Promise<Response>((r) => (releaseOptions = r)));
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });
    await settle();

    expect(screen.queryByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No passkeys registered.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await tick();

    // The window this covers is the long one: the platform prompt can stand open
    // for seconds. Clearing the *action* error must not silence the load failure
    // that still owns the region.
    expect(screen.queryByRole('alert')).toBeTruthy();
    expect(screen.queryByText('No passkeys registered.')).toBeNull();

    releaseOptions?.(jsonResponse(500, {}));
    await settle();
  });

  it('keeps a later error from blanking the list region', async () => {
    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [passkey()] }),
        jsonResponse(500, { code: 'server_error' })
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /Delete — MacBook/ }));
    await settle();

    // A failed delete is not a failed load: the rows on screen are still valid.
    expect(screen.getByText('MacBook')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('drops the passkey once the server confirms the delete', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(200, { passkeys: [passkey()] }), jsonResponse(200, {}))
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: /Delete — MacBook/ }));
    await settle();

    expect(screen.queryByText('MacBook')).toBeNull();
    expect(screen.getByText('No passkeys registered.')).toBeTruthy();
  });

  it('reports a cancelled platform prompt and re-enables the add button', async () => {
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        create: vi.fn(async () => {
          throw new DOMException('cancelled', 'NotAllowedError');
        })
      }
    });

    render({
      fetcher: fetcherReturning(
        jsonResponse(200, { passkeys: [] }),
        jsonResponse(200, { options: { challenge: 'AA', user: { id: 'AA' } } })
      )
    });
    await settle();

    await userEvent.click(screen.getByRole('button', { name: 'Add passkey' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('The passkey prompt was cancelled.');
    // `registering` must be cleared on the failure path too — a stuck busy flag
    // would leave the only way to add a passkey permanently disabled.
    expect(screen.getByRole('button', { name: 'Add passkey' }).hasAttribute('disabled')).toBe(
      false
    );
  });

  it('resolves provider defaults, then the preset, then the instance slotClasses', async () => {
    const instance = mount(ProviderHarness, {
      target: document.body,
      props: {
        component: PasskeyManager,
        componentProps: {
          preset: 'branded',
          slotClasses: { empty: 'qa-instance' },
          fetcher: fetcherReturning(jsonResponse(200, { passkeys: [] }))
        },
        defaults: { PasskeyManager: { slotClasses: { empty: 'qa-defaults' } } },
        presets: { PasskeyManager: { branded: { slotClasses: { empty: 'qa-preset' } } } }
      } as ComponentProps<typeof ProviderHarness>
    });
    dispose = () => unmount(instance);
    flushSync();
    await settle();

    // All three sources contribute. The markers deliberately match no Tailwind
    // utility: `resolveSlotClasses` drops an earlier class when a later one
    // occupies the same bucket, and a `from-*` triple (the first attempt) is one
    // bucket — the gradient colour stop — so only the last would have survived.
    const empty = screen.getByText('No passkeys registered.').className;
    expect(empty).toContain('qa-defaults');
    expect(empty).toContain('qa-preset');
    expect(empty).toContain('qa-instance');
    expect(empty.indexOf('qa-defaults')).toBeLessThan(empty.indexOf('qa-preset'));
    expect(empty.indexOf('qa-preset')).toBeLessThan(empty.indexOf('qa-instance'));
  });

  it('renders standalone, with no provider mounted', async () => {
    render({
      fetcher: fetcherReturning(jsonResponse(200, { passkeys: [] })),
      slotClasses: { empty: 'instance-empty' }
    });
    await settle();

    // `getBlocksConfig()` is optional context: without a provider the cascade
    // must degrade to the instance classes rather than throw.
    expect(screen.getByText('No passkeys registered.').className).toContain('instance-empty');
  });
});
