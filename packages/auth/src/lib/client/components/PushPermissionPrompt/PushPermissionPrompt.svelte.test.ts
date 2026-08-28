// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetcherAnswering, mounter, settle } from '../__fixtures__/fetcher.js';
import type { PushPermissionPromptProps } from './index.js';
import PushPermissionPrompt from './PushPermissionPrompt.svelte';

// `subscribeToPush` reaches the platform (service worker + PushManager), which
// jsdom has neither of, so it is the seam this suite drives from.
const subscribeToPush = vi.hoisted(() => vi.fn());
vi.mock('../../utils/service-worker.js', () => ({ subscribeToPush }));

const subscription = {
  toJSON: () => ({ endpoint: 'https://push.example/1' })
} as unknown as PushSubscription;

beforeEach(() => {
  subscribeToPush.mockReset();
  // The component logs the developer-facing cause of an operational failure;
  // the assertions describe the user-facing state, so keep the run readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mountInBody = mounter();
const render = (props: Partial<PushPermissionPromptProps> = {}) =>
  mountInBody(PushPermissionPrompt, {
    vapidPublicKey: 'BKey',
    ...props
  } as PushPermissionPromptProps);

const enableButton = () => screen.getByRole('button', { name: 'Enable' });

describe('PushPermissionPrompt (component)', () => {
  it('subscribes once when Enable is clicked twice in flight', async () => {
    let release: (() => void) | undefined;
    subscribeToPush.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 'subscribed', subscription });
        })
    );
    const fetcher = fetcherAnswering(200, {});
    render({ fetcher });

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
    render({ onSubscribed, fetcher: fetcherAnswering(200, {}) });

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
    const fetcher = fetcherAnswering(409, { code: 'push_endpoint_conflict' });
    render({ fetcher });

    await userEvent.click(enableButton());
    await settle();
    expect(screen.getByRole('alert').textContent).toContain('already registered');

    await userEvent.click(enableButton());
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['null', null],
    ['an array', []]
  ])(
    'treats a refusal whose JSON body is %s as a refusal, not as a failed request',
    async (_, body) => {
      subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
      render({ fetcher: fetcherAnswering(500, body) });

      await userEvent.click(enableButton());
      await settle();

      // Same user-facing text either way — what separates the two paths is
      // that a request which *reached* the server is not a request failure,
      // so nothing may be logged as one.
      expect(screen.getByRole('alert').textContent).toContain('Enabling push notifications failed');
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it('carries the `error` slot on the Alert, not on the always-present region', async () => {
    subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
    render({ fetcher: fetcherAnswering(500, {}), slotClasses: { error: 'qa-error' } });

    // Same contract as every other component's `error` slot: it styles the
    // message, so it must not exist while there is no message.
    const region = document.body.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(region.className).not.toContain('qa-error');
    await userEvent.click(enableButton());
    await settle();

    expect(screen.getByRole('alert').className).toContain('qa-error');
    expect(region.className).not.toContain('qa-error');
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
