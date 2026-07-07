// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuideController, type GuideStorageAdapter } from '../../utils/guide.svelte';
import GuideMentionHarness from './__fixtures__/GuideMentionHarness.svelte';

// Interaction layer for GuideMention — Direction B of the bidirectional link (Guide → UI). An
// interactive <button data-guide-mention> that toggles the target's `data-guide-highlight` ring on
// hover *and* focus (keyboard parity), and on click also scrolls it into view. It degrades to plain
// inline <span> text without a provider or when the resolved direction excludes Guide→UI
// ('to-guide'). Span-vs-button is the discriminator (only the interactive branch carries the
// marker). The highlight ownership teardown must release the ring on unmount, and a mention's
// `clear` is topic-guarded so leaving it never wipes a *different* topic's highlight. Same stack as
// the Combobox pilot: svelte's own mount/unmount, @testing-library/dom + user-event, native
// matchers. The controller lives in the test (via the `controller` prop) so highlightedId is
// observable; targets are real `[data-guide]` elements the controller resolves against.

const noopStorage: GuideStorageAdapter = { load: () => [], save: () => {} };
const makeController = () => new GuideController({ storage: noopStorage, dev: false });

let dispose: (() => void) | undefined;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // GuideMention warns (DEV) for a missing provider or a 'to-guide' topic; silence by default and
  // assert it explicitly in the degrade tests.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  warn.mockRestore();
});

function renderHarness(props: Partial<ComponentProps<typeof GuideMentionHarness>> = {}) {
  const instance = mount(GuideMentionHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const mention = (name: string) => screen.getByText(name);
const target = (id: string) => document.querySelector(`[data-guide="${id}"]`);
const isHighlighted = (id: string) => target(id)?.hasAttribute('data-guide-highlight') ?? false;
const toggleMention = () => screen.getByTestId('toggle-mention');

describe('GuideMention (component interaction)', () => {
  it('degrades to plain text without a GuideProvider ancestor', () => {
    renderHarness({ withProvider: false });

    expect(mention('Save button').tagName).toBe('SPAN');
    expect(mention('Save button').hasAttribute('data-guide-mention')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without a <GuideProvider>'));
  });

  it('is an interactive button by default', () => {
    renderHarness({ controller: makeController() });

    const el = mention('Save button');
    expect(el.tagName).toBe('BUTTON');
    expect(el.hasAttribute('data-guide-mention')).toBe(true);
    expect(el.getAttribute('type')).toBe('button');
  });

  it('degrades to plain text when the direction excludes Guide→UI (to-guide)', () => {
    renderHarness({
      controller: makeController(),
      mentions: [{ for: 'save', text: 'Save button', direction: 'to-guide' }]
    });

    expect(mention('Save button').tagName).toBe('SPAN');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("('to-guide')"));
  });

  it('reads the topic-meta direction when no direction prop is set (to-guide → span)', () => {
    const controller = makeController();
    // Register the topic with a Guide-excluding direction, no `direction` prop on the mention.
    // resolveDirection resolves by id from the registry, so a detached element suffices — this
    // proves the mention consults the topic meta, not just its own prop.
    controller.registerTarget('save', document.createElement('div'), { direction: 'to-guide' });
    renderHarness({ controller, mentions: [{ for: 'save', text: 'Save button' }] });

    expect(mention('Save button').tagName).toBe('SPAN');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("('to-guide')"));
  });

  it('highlights the target on hover and clears it on mouseleave', async () => {
    const user = userEvent.setup();
    const controller = makeController();
    renderHarness({ controller });

    const el = mention('Save button');
    await user.hover(el);
    expect(controller.highlightedId).toBe('save');
    expect(isHighlighted('save')).toBe(true);

    await user.unhover(el);
    expect(controller.highlightedId).toBeNull();
    expect(isHighlighted('save')).toBe(false);
  });

  it('highlights on focus and clears on blur (keyboard parity)', () => {
    const controller = makeController();
    renderHarness({ controller });

    const el = mention('Save button') as HTMLElement;
    el.focus();
    expect(controller.highlightedId).toBe('save');
    expect(isHighlighted('save')).toBe(true);

    el.blur();
    expect(controller.highlightedId).toBeNull();
    expect(isHighlighted('save')).toBe(false);
  });

  it('highlights the target on click (activate)', async () => {
    const user = userEvent.setup();
    const controller = makeController();
    renderHarness({ controller });

    await user.click(mention('Save button'));
    expect(controller.highlightedId).toBe('save');
    expect(isHighlighted('save')).toBe(true);
  });

  it('releases an owned highlight when the mention unmounts', async () => {
    const user = userEvent.setup();
    const controller = makeController();
    renderHarness({ controller });

    // Claim ownership with fireEvent, not user.hover: user-event tracks a single pointer, so if it
    // were on the mention, clicking the toggle would first fire the mention's mouseleave → clear()
    // drops ownership before the unmount and the teardown $effect would never run (the test would
    // pass for the wrong reason — the same caveat the topic-guard test documents). fireEvent leaves
    // user-event's pointer off the mention, so the click below unmounts it while it still owns the
    // ring — only the teardown can clear it.
    fireEvent.mouseEnter(mention('Save button'));
    expect(isHighlighted('save')).toBe(true);

    await user.click(toggleMention());
    flushSync();

    expect(controller.highlightedId).toBeNull();
    expect(isHighlighted('save')).toBe(false);
  });

  it('leaving a mention does not wipe another topic’s highlight (topic-guarded clear)', () => {
    const controller = makeController();
    renderHarness({
      controller,
      mentions: [
        { for: 'save', text: 'Save button' },
        { for: 'other', text: 'Other button' }
      ],
      targets: ['save', 'other']
    });

    const a = mention('Save button');
    const b = mention('Other button');

    // Fire the events directly rather than through user-event's single-pointer model, to reproduce
    // the exact race the guard defends: B's mouseenter lands while A is still "hovered", then A's
    // mouseleave fires late. (user-event would first move its one pointer off B, firing B's own
    // mouseleave — a different sequence that never exercises the guard.)
    fireEvent.mouseEnter(a);
    expect(controller.highlightedId).toBe('save');
    fireEvent.mouseEnter(b);
    expect(controller.highlightedId).toBe('other');

    // A's late mouseleave must not clear B's highlight — clear() is guarded on the topic id.
    fireEvent.mouseLeave(a);
    expect(controller.highlightedId).toBe('other');
    expect(isHighlighted('other')).toBe(true);
    expect(isHighlighted('save')).toBe(false);
  });
});
