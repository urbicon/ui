// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuideController, type GuideStorageAdapter } from '../../utils/guide.svelte';
import GuidePanelPopoverHarness from './__fixtures__/GuidePanelPopoverHarness.svelte';

// Escape layering in GuidePanel. A manual-mode Popover dismisses through a `document`
// listener that honours `defaultPrevented`; Svelte runs an element's `onkeydown` at the mount
// root, before `document`. The panel's own dismissal therefore has to come after `document`,
// or it claims the key before the popover inside it can.

const noopStorage: GuideStorageAdapter = { load: () => [], save: () => {} };

let dispose: (() => void) | undefined;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  warn.mockRestore();
});

type HarnessProps = Omit<ComponentProps<typeof GuidePanelPopoverHarness>, 'controller'>;

function render(props: HarnessProps = {}) {
  const controller = new GuideController({ storage: noopStorage, dev: false });
  const instance = mount(GuidePanelPopoverHarness, {
    target: document.body,
    props: { controller, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
  controller.openPanel('a');
  flushSync();
  return controller;
}

const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const popoverOpen = () => byTestId('pop-inner') !== null;

function pressEscapeOn(id: string) {
  const el = byTestId(id);
  el.focus();
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  );
  flushSync();
}

describe('GuidePanel (Escape layering)', () => {
  it.each(['pop-trigger', 'pop-inner'])(
    'closes an inner manual-mode popover first and stays open (focus on %s)',
    (focused) => {
      const controller = render();
      expect(popoverOpen()).toBe(true);

      pressEscapeOn(focused);

      expect(popoverOpen()).toBe(false);
      expect(controller.panelOpen).toBe(true);
    }
  );

  it.each([
    ['no consumer handler', undefined],
    ['a consumer onkeydown that prevents Escape', (e: KeyboardEvent) => e.preventDefault()]
  ])('stays open when an element inside claims Escape first, with %s', (_, onkeydown) => {
    const controller = render({ popoverOpen: false, panelProps: { onkeydown } });

    pressEscapeOn('claimer');

    expect(controller.panelOpen).toBe(true);
  });

  it('closes on a second Escape once the popover is gone', () => {
    const controller = render();

    pressEscapeOn('pop-inner');
    pressEscapeOn('pop-trigger');

    expect(controller.panelOpen).toBe(false);
  });
});
