// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Drawer from './Drawer.svelte';
import type { DrawerProps } from './index';

// Interaction layer for what only Drawer has: a consumer `onclick` rides the
// plain spread, and its own labelling wiring. The modal lifecycle and dismiss
// policy it shares with Dialog is asserted once for both in
// `internal/modal-surface.svelte.test.ts`; visual behaviour (slide-in, top
// layer) is Playwright's job.

const body = (text = 'Drawer body'): Snippet =>
  createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderDrawer(props: Partial<DrawerProps> = {}) {
  const instance = mount(Drawer, {
    target: document.body,
    props: { children: body(), ...props } as DrawerProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const drawer = () => screen.getByRole('dialog', { hidden: true });

// restProps contract on the <dialog> (see docs/COMPONENT-API-CONVENTIONS.md).
// The keydown, close and cancel compositions are pinned in the contract suite.
// Drawer composes no onclick — its <dialog> has no internal one (the backdrop
// is a child div), so a consumer onclick rides the plain spread.
describe('Drawer (restProps composition)', () => {
  it('delivers a consumer onclick through the spread', async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    renderDrawer({ open: true, onclick });
    await tick();

    await user.click(drawer());

    expect(onclick).toHaveBeenCalledOnce();
  });

  it('lets internal aria-modal and data-state win over restProps', async () => {
    renderDrawer({ open: true, 'aria-modal': 'false', 'data-state': 'closed' });
    await tick();

    expect(drawer().getAttribute('aria-modal')).toBe('true');
    expect(drawer().getAttribute('data-state')).toBe('open');
  });

  it('falls back to a consumer aria-labelledby when no title is rendered', async () => {
    renderDrawer({ open: true, 'aria-labelledby': 'external-heading' });
    await tick();

    expect(drawer().getAttribute('aria-labelledby')).toBe('external-heading');
  });

  it('merges a consumer aria-describedby after the internal body id', async () => {
    renderDrawer({ open: true, 'aria-describedby': 'external-hint' });
    await tick();

    const ids = (drawer().getAttribute('aria-describedby') as string).split(' ');
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0])?.textContent).toContain('Drawer body');
    expect(ids[1]).toBe('external-hint');
  });
});
