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
  it('renders a role="alert" region without a dismiss button by default', () => {
    renderAlert({ title: 'Heads up' });

    expect(screen.getByRole('alert')).toBeTruthy();
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
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('clicking dismiss without an onDismiss handler is a safe no-op', async () => {
    renderAlert({ dismissible: true });

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('alert')).toBeTruthy();
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
