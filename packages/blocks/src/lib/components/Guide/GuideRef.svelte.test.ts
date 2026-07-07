// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuideController, type GuideStorageAdapter } from '../../utils/guide.svelte';
import GuideRefHarness from './__fixtures__/GuideRefHarness.svelte';

// Interaction layer for GuideRef — the help-internal article→article link. Its headline
// contract is a reactive *degrade→upgrade*: it renders plain <span> text until the target
// <GuideArticle> registers with the surrounding <GuidePanel>, then upgrades to a real
// <button> (and back down when the article unregisters). Only the interactive branch carries
// the `data-guide-ref` marker, so span-vs-button is the discriminator. It also degrades
// without a provider, outside a panel, or for an unknown article id. Same stack as the
// Combobox pilot: svelte's own mount/unmount, @testing-library/dom + user-event, native
// vitest matchers. GuideRef reads two contexts (controller + panel registry), so the test
// mounts a real GuideProvider › GuidePanel › GuideArticle composition (GuideRefHarness).

// A no-op storage keeps the controller off localStorage — GuideRef never touches persistence.
const noopStorage: GuideStorageAdapter = { load: () => [], save: () => {} };

let dispose: (() => void) | undefined;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // GuideRef warns (DEV) for a missing provider/panel or an unresolved article. Silence the
  // console by default; the degrade tests assert the warning explicitly.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  warn.mockRestore();
});

function renderHarness(props: Partial<ComponentProps<typeof GuideRefHarness>> = {}) {
  const instance = mount(GuideRefHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

// The link text is identical in both branches; its tag name is the contract.
const link = () => screen.getByText('go to target');
const toggleArticle = () => screen.getByTestId('toggle-article');

describe('GuideRef (component interaction)', () => {
  it('degrades to plain text without a GuideProvider ancestor', () => {
    renderHarness({ withProvider: false });

    expect(link().tagName).toBe('SPAN');
    expect(link().hasAttribute('data-guide-ref')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without a <GuideProvider>'));
  });

  it('degrades to plain text when used outside a GuidePanel', () => {
    renderHarness({ withPanel: false });

    expect(link().tagName).toBe('SPAN');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('outside a <GuidePanel>'));
  });

  it('upgrades to a button once the target article is registered', () => {
    renderHarness();

    expect(link().tagName).toBe('BUTTON');
    expect(link().hasAttribute('data-guide-ref')).toBe(true);
    expect(link().getAttribute('type')).toBe('button');
  });

  it('degrades to plain text for an article id that is not registered', async () => {
    renderHarness({ refArticle: 'ghost' });

    expect(link().tagName).toBe('SPAN');
    // The unresolved-article warning is deferred a tick (so a same-render registration is not a
    // false positive) — let it flush.
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '<GuideRef article="ghost"> points at an article that is not registered'
      )
    );
  });

  it('navigates the panel to the target article on click', async () => {
    const user = userEvent.setup();
    const controller = new GuideController({ storage: noopStorage, dev: false });
    // Open the panel so it is not inert, mirroring the real "click a ref inside an open panel" flow.
    controller.openPanel();
    renderHarness({ controller });

    expect(controller.activeArticle).toBeNull();
    await user.click(screen.getByRole('button', { name: 'go to target' }));

    expect(controller.activeArticle).toBe('target');
  });

  it('activates via the keyboard (native button semantics)', async () => {
    const user = userEvent.setup();
    const controller = new GuideController({ storage: noopStorage, dev: false });
    controller.openPanel();
    renderHarness({ controller });

    screen.getByRole('button', { name: 'go to target' }).focus();
    await user.keyboard('{Enter}');

    expect(controller.activeArticle).toBe('target');
  });

  it('reactively degrades and upgrades as the target article unregisters/registers', async () => {
    const user = userEvent.setup();
    renderHarness();

    // Registered → interactive button.
    expect(link().tagName).toBe('BUTTON');

    // Unmount the article → hasArticle flips false → degrade to span.
    await user.click(toggleArticle());
    flushSync();
    expect(link().tagName).toBe('SPAN');
    expect(link().hasAttribute('data-guide-ref')).toBe(false);

    // Remount the article → reactive upgrade back to a button.
    await user.click(toggleArticle());
    flushSync();
    expect(link().tagName).toBe('BUTTON');
    expect(link().hasAttribute('data-guide-ref')).toBe(true);
  });
});
