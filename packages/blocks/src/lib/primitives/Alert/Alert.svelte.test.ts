// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Alert from './Alert.svelte';
import type { AlertProps } from './index';

// Interaction layer for Alert — the dismiss affordance. Alert is declarative
// (no context children), so content snippets come from `createRawSnippet`.
// Dismissal is consumer-controlled: the component fires `onDismiss` and stays
// mounted; the consumer unmounts it. Same stack as the other DOM tests:
// Svelte's own mount/unmount, @testing-library/dom + user-event, native
// vitest matchers.

const body = (text = 'Alert body') => createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderAlert(props: Partial<AlertProps> = {}) {
  const instance = mount(Alert, {
    target: document.body,
    props: { children: body(), ...props } as AlertProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Alert — dismiss interaction', () => {
  it('renders a live region without a dismiss button by default', () => {
    renderAlert({ title: 'Heads up' });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Heads up')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('dismissible shows a localized dismiss button that fires onDismiss once', async () => {
    const onDismiss = vi.fn();
    renderAlert({ dismissible: true, onDismiss });

    const btn = screen.getByRole('button', { name: 'Dismiss' });
    await userEvent.click(btn);

    expect(onDismiss).toHaveBeenCalledOnce();
    // Dismissal is consumer-controlled — the alert itself stays in the DOM
    // until the consumer conditionally unmounts it.
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('clicking dismiss without an onDismiss handler is a safe no-op', async () => {
    renderAlert({ dismissible: true });

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders the actions snippet as live interactive content', async () => {
    const onRetry = vi.fn();
    const actions = createRawSnippet(() => ({
      render: () => '<button type="button">Retry</button>',
      setup: (node) => {
        node.addEventListener('click', onRetry);
        return () => node.removeEventListener('click', onRetry);
      }
    }));
    renderAlert({ intent: 'danger', actions });

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Alert — the announced role follows the intent', () => {
  // ARIA has two live-region urgencies and `intent` is what picks between them:
  // `role="alert"` is implicitly `aria-live="assertive"` and cuts into whatever
  // is being read, `role="status"` is polite and waits for a pause.
  const root = () => document.body.firstElementChild as HTMLElement;

  it.each(['success', 'info', 'primary', 'neutral'] as const)(
    'announces intent="%s" politely, as role="status"',
    (intent) => {
      renderAlert({ intent });

      expect(root().getAttribute('role')).toBe('status');
    }
  );

  it.each(['danger', 'warning'] as const)(
    'announces intent="%s" assertively, as role="alert"',
    (intent) => {
      renderAlert({ intent });

      expect(root().getAttribute('role')).toBe('alert');
    }
  );

  it('lets an explicit role="alert" restore the interruption on a success intent', () => {
    renderAlert({ intent: 'success', role: 'alert' });

    expect(root().getAttribute('role')).toBe('alert');
  });

  it('lets an explicit role="note" turn a danger callout into a silent one', () => {
    renderAlert({ intent: 'danger', role: 'note' });

    expect(root().getAttribute('role')).toBe('note');
  });

  it('renders no role attribute at all when role={undefined} is passed explicitly', () => {
    // Pins the pass-through auth's FormErrorAlert rides on: passing `role`
    // explicitly as `undefined` is not the same as omitting it.
    renderAlert({ intent: 'success', role: undefined });

    expect(root().hasAttribute('role')).toBe(false);
  });

  it('re-derives the role when the intent changes under a live mount', () => {
    const props = $state<Partial<AlertProps>>({ intent: 'success', children: body() });
    const instance = mount(Alert, { target: document.body, props: props as AlertProps });
    dispose = () => unmount(instance);
    flushSync();

    expect(root().getAttribute('role')).toBe('status');

    props.intent = 'danger';
    flushSync();

    expect(root().getAttribute('role')).toBe('alert');
  });
});
