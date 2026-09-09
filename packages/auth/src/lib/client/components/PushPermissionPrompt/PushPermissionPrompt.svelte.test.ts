// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetcherAnswering, mounter, settle } from '../__fixtures__/fetcher.js';
import { errorMessage, errorRegion } from '../__fixtures__/live-regions.js';
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
    expect(errorRegion().textContent?.trim()).not.toBe('');

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
    expect(errorRegion().textContent).toContain('already registered');

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
      expect(errorRegion().textContent).toContain('Enabling push notifications failed');
      expect(console.error).not.toHaveBeenCalled();
    }
  );

  it('carries the `error` slot on the Alert, not on the always-present region', async () => {
    subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
    render({ fetcher: fetcherAnswering(500, {}), slotClasses: { error: 'qa-error' } });

    // Same contract as every other component's `error` slot: it styles the
    // message, so it must not exist while there is no message.
    const region = errorRegion();
    expect(region.className).not.toContain('qa-error');
    expect(region.textContent?.trim()).toBe('');
    await userEvent.click(enableButton());
    await settle();

    // The message lands in the region that was already there, not in a new one.
    expect(errorRegion()).toBe(region);
    expect(errorMessage().className).toContain('qa-error');
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

describe('PushPermissionPrompt — focus after the card closes', () => {
  const dismissButton = () => screen.getByRole('button', { name: 'Not now' });

  /** A control the page owns, placed after the card (mounted into `document.body`). */
  function controlAfter(label = 'Next'): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    document.body.append(button);
    return button;
  }

  /** A control before the card — appended before the mount. */
  function controlBefore(label = 'Earlier'): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    document.body.append(button);
    return button;
  }

  it('lands on the next tab stop after the card', async () => {
    render({});
    const next = controlAfter();

    await userEvent.click(dismissButton());
    await settle();

    // The card is gone; without this the focus ring is on <body> and the next
    // Tab starts over at the top of the page.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(next);
  });

  it('falls back to the tab stop before the card when nothing follows it', async () => {
    const earlier = controlBefore();
    render({});

    await userEvent.click(dismissButton());
    await settle();

    expect(document.activeElement).toBe(earlier);
  });

  it('skips a control that is not rendered, and touches no element it does not own', async () => {
    const earlier = controlBefore();
    const heading = document.createElement('h2');
    heading.textContent = 'Notifications';
    document.body.append(heading);
    render({});
    const hidden = controlAfter('Hidden');
    hidden.style.display = 'none';
    const inHiddenBox = document.createElement('div');
    inHiddenBox.style.display = 'none';
    const nested = document.createElement('button');
    inHiddenBox.append(nested);
    document.body.append(inHiddenBox);

    await userEvent.click(dismissButton());
    await settle();

    // Neither hidden control can take the ring, so the one before the card does.
    expect(document.activeElement).toBe(earlier);
    // A heading is not a tab stop and is not made into one: nothing outside the
    // card is mutated, so a page's own markup keeps its focus behaviour.
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('gives focus back to the control that had it when the prompt appeared', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Notification settings';
    document.body.append(opener);
    opener.focus();
    subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
    render({ fetcher: fetcherAnswering(200, {}) });
    controlAfter();

    await userEvent.click(enableButton());
    await settle();

    expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull();
    // The restore target wins over the neighbour: it is where the user was.
    expect(document.activeElement).toBe(opener);
  });

  it('leaves focus where a dismissal callback put it', async () => {
    const consumerTarget = controlBefore('Consumer');
    render({ onDismissed: () => consumerTarget.focus() });
    controlAfter();

    await userEvent.click(dismissButton());
    await settle();

    // The docs send a consumer to `onDismissed` to place focus; the callback
    // runs first and the prompt must not override it a tick later.
    expect(document.activeElement).toBe(consumerTarget);
  });

  it('leaves focus where an unavailable callback put it', async () => {
    const consumerTarget = controlBefore('Consumer');
    subscribeToPush.mockResolvedValue({ status: 'unsupported' });
    render({ onUnavailable: () => consumerTarget.focus() });
    controlAfter();

    await userEvent.click(enableButton());
    await settle();

    expect(document.activeElement).toBe(consumerTarget);
  });

  it('leaves focus where a subscribe callback put it', async () => {
    const consumerTarget = controlBefore('Consumer');
    subscribeToPush.mockResolvedValue({ status: 'subscribed', subscription });
    render({
      fetcher: fetcherAnswering(200, {}),
      onSubscribed: () => consumerTarget.focus()
    });
    controlAfter();

    await userEvent.click(enableButton());
    await settle();

    expect(document.activeElement).toBe(consumerTarget);
  });

  it('leaves focus alone when the user moved it away while enabling', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    let release: (() => void) | undefined;
    subscribeToPush.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ status: 'subscribed', subscription });
        })
    );
    render({ fetcher: fetcherAnswering(200, {}) });

    await userEvent.click(enableButton());
    const elsewhere = document.createElement('input');
    document.body.append(elsewhere);
    elsewhere.focus();
    release?.();
    await settle();

    // A settled request is not a reason to move someone who has moved on.
    expect(document.activeElement).toBe(elsewhere);
  });
});
