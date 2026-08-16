// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccordionHarness from './__fixtures__/AccordionHarness.svelte';
import type { AccordionProps } from './index';

// Interaction layer for Accordion — the single/multiple open model and the
// collapsible guard, which is pure state logic a variant test can't reach. Each
// AccordionItem renders a native <button aria-expanded>; AccordionItem registers
// through context, so the test mounts a real composition (AccordionHarness).
// Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers.

type Item = { value: string; title: string; disabled?: boolean };

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderAccordion(props: Partial<AccordionProps> & { items?: Item[] } = {}) {
  const instance = mount(AccordionHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const header = (name: string) => screen.getByRole('button', { name: new RegExp(name) });
const expanded = (name: string) => header(name).getAttribute('aria-expanded');

describe('Accordion (component interaction)', () => {
  it('expands the defaultValue item and collapses the rest', () => {
    renderAccordion({ defaultValue: 'shipping' });

    expect(expanded('Shipping')).toBe('true');
    expect(expanded('Returns')).toBe('false');
    expect(expanded('Warranty')).toBe('false');
  });

  it('single mode: opening an item closes the previously open one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderAccordion({ type: 'single', defaultValue: 'shipping', onValueChange });

    await user.click(header('Returns'));

    expect(expanded('Returns')).toBe('true');
    expect(expanded('Shipping')).toBe('false');
    expect(onValueChange).toHaveBeenLastCalledWith('returns');
  });

  it('multiple mode: opening items accumulates them', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderAccordion({ type: 'multiple', onValueChange });

    await user.click(header('Shipping'));
    await user.click(header('Returns'));

    expect(expanded('Shipping')).toBe('true');
    expect(expanded('Returns')).toBe('true');
    expect(onValueChange).toHaveBeenLastCalledWith(['shipping', 'returns']);
  });

  it('single mode: an open item closes on a second click (collapsible default)', async () => {
    const user = userEvent.setup();
    renderAccordion({ type: 'single', defaultValue: 'shipping' });

    await user.click(header('Shipping'));

    expect(expanded('Shipping')).toBe('false');
  });

  it('collapsible=false: the last open item cannot be closed', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderAccordion({
      type: 'single',
      collapsible: false,
      defaultValue: 'shipping',
      onValueChange
    });

    await user.click(header('Shipping'));

    // The only open item stays open — the toggle short-circuits before update.
    expect(expanded('Shipping')).toBe('true');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('does not toggle a disabled item', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    renderAccordion({
      onValueChange,
      items: [
        { value: 'shipping', title: 'Shipping' },
        { value: 'returns', title: 'Returns', disabled: true }
      ]
    });

    const disabledHeader = header('Returns');
    expect(disabledHeader.hasAttribute('disabled')).toBe(true);
    await user.click(disabledHeader);

    expect(expanded('Returns')).toBe('false');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('accordion-level slotClasses reach the item slots', () => {
    // The Accordion prop type always declared the item slots, but until the
    // context handed them down, slotClasses={{ trigger }} on the Accordion was
    // a type-checked no-op and only base ever reached the DOM (found live:
    // the settings recipe padded its fold rows through exactly this prop).
    renderAccordion({ slotClasses: { trigger: 'px-4' } });

    for (const name of ['Shipping', 'Returns', 'Warranty']) {
      expect(header(name).classList.contains('px-4')).toBe(true);
    }
  });
});
