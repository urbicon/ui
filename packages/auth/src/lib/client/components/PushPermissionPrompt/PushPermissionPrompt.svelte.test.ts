// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushPermissionPromptProps } from './index.js';
import PushPermissionPrompt from './PushPermissionPrompt.svelte';

// `subscribeToPush` reaches the platform (service worker + PushManager), which
// jsdom has neither of, so it is the seam this suite drives from.
const subscribeToPush = vi.hoisted(() => vi.fn());
vi.mock('../../utils/service-worker.js', () => ({ subscribeToPush }));

const subscription = {
  toJSON: () => ({ endpoint: 'https://push.example/1' })
} as unknown as PushSubscription;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

let dispose: (() => void) | undefined;

beforeEach(() => {
  subscribeToPush.mockReset();
  // The component logs the developer-facing cause of an operational failure;
  // the assertions describe the user-facing state, so keep the run readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function render(props: Partial<PushPermissionPromptProps> = {}) {
  const instance = mount(PushPermissionPrompt, {
    target: document.body,
    props: { vapidPublicKey: 'BKey', ...props } as PushPermissionPromptProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const enableButton = () => screen.getByRole('button', { name: 'Enable' });

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

describe('PushPermissionPrompt (component)', () => {
  it('subscribes once when Enable is clicked twice in flight', async () => {
    let release: (() => void) | undefined;
    subscribeToPush.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 'subscribed', subscription });
        })
    );
    const fetcher = vi.fn(async () => jsonResponse(200, {}));
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });

    const button = enableButton();
    await userEvent.click(button);
    await tick();
    await userEvent.click(button);
    await tick();

    // Enabling push is not idempotent on the server side: a second in-flight
    // subscribe races the first POST and can trip the endpoint-conflict path.
    expect(subscribeToPush).toHaveBeenCalledTimes(1);

    release?.();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('lets the user retry after a failed subscribe', async () => {
    subscribeToPush.mockResolvedValue({ status: 'error', error: new Error('no worker') });
    const onSubscribed = vi.fn();
    render({ onSubscribed, fetcher: (async () => jsonResponse(200, {})) as never });

    await userEvent.click(enableButton());
    await settle();
    expect(screen.getByRole('alert')).toBeTruthy();

    // The prompt deliberately stays open on an operational failure, so the busy
    // flag must clear — a second click has to reach `subscribeToPush` again, or
    // the only retry path is a page reload. Asserted through the call, not
    // through an attribute: the guard is the button's `loading`, and a stuck
    // flag shows up as a swallowed click.
    subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
    await userEvent.click(enableButton());
    await settle();

    expect(subscribeToPush).toHaveBeenCalledTimes(2);
    expect(onSubscribed).toHaveBeenCalledTimes(1);
  });

  it('lets the user retry after the server rejects the subscription', async () => {
    subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
    const fetcher = vi.fn(async () => jsonResponse(409, { code: 'push_endpoint_conflict' }));
    render({ fetcher: fetcher as unknown as typeof globalThis.fetch });

    await userEvent.click(enableButton());
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('already registered');

    await userEvent.click(enableButton());
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('closes without an error when the browser cannot do push', async () => {
    subscribeToPush.mockResolvedValue({ status: 'unsupported' });
    const onUnavailable = vi.fn();
    render({ onUnavailable });

    await userEvent.click(enableButton());
    await settle();

    expect(onUnavailable).toHaveBeenCalledWith('unsupported');
    expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull();
  });
});
