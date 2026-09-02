// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, type Snippet, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { sidebarVariants } from '$lib/primitives/Sidebar';
import SidebarLayout from './SidebarLayout.svelte';

/**
 * Every `sidebar`-prefixed `slotClasses` key reaches the Sidebar slot it names.
 *
 * The forwarding used to be five hand-written pairs, and three edits to them
 * compiled while reaching no element: a mistyped source key, a swapped pair,
 * and a deleted line. Both halves now derive from `sidebarVariants`, which
 * makes all three unwritable — but that is a property of today's shape, and a
 * shape is one refactor from changing. This asserts the reach itself, so any
 * later spelling of the mapping has to keep it.
 *
 * The roster is read off the same config the component walks rather than
 * listed here: a slot added to Sidebar joins this test on its own, and a
 * renamed one moves with it, instead of leaving behind a case nobody wrote.
 *
 * Two slots need state before they exist at all — `backdrop` renders only on
 * `open && isMobile`, `header`/`footer` only when given a snippet — so a fixture
 * that skipped them would pass while forwarding nothing (measured: without the
 * snippets and the viewport stub, three of the five report no element).
 *
 * **Which element, not merely some element.** A swapped pair is a permutation:
 * every marker still lands, and on as many distinct elements as before, so
 * existence and distinctness both survive it (measured — the suite stayed green
 * with `header` and `footer` exchanged). The carrier is therefore identified by
 * the classes Sidebar's own config gives that slot, which are pairwise distinct
 * across all five and come from the same source the roster does.
 */
const SLOTS = Object.keys(sidebarVariants.config.slots ?? {});
const marker = (slot: string) => `zzprobe-${slot}`;
/** What Sidebar itself paints on that slot — the only thing that tells its five elements apart. */
const libraryClasses = (slot: string) =>
  (sidebarVariants() as unknown as Record<string, () => string>)
    [slot]()
    .split(/\s+/)
    .filter(Boolean);
const forwardKey = (slot: string) => `sidebar${slot.charAt(0).toUpperCase()}${slot.slice(1)}`;
const text = (label: string): Snippet =>
  createRawSnippet(() => ({ render: () => `<p>${label}</p>` }));

let dispose: (() => void) | undefined;
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  window.matchMedia = originalMatchMedia;
  document.body.replaceChildren();
});

function render() {
  // The vitest-setup stub always reports "no match" = desktop, which leaves the
  // backdrop unrendered; Sidebar probes only the mobile breakpoint.
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;

  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(SidebarLayout, {
    target,
    props: {
      open: true,
      sidebarHeader: text('Header'),
      sidebarFooter: text('Footer'),
      sidebar: text('Nav'),
      slotClasses: Object.fromEntries(SLOTS.map((s) => [forwardKey(s), marker(s)]))
    } as never
  });
  flushSync();
  dispose = () => unmount(app);
  return target;
}

describe('SidebarLayout forwards every sidebar* key to that Sidebar slot', () => {
  it('has a slot roster to check at all', () => {
    expect(SLOTS.length, 'sidebarVariants declares no slots').toBeGreaterThan(0);
  });

  it.each(SLOTS)('forwards %s', (slot) => {
    const target = render();
    expect(
      target.querySelector(`.${marker(slot)}`),
      `slotClasses.${forwardKey(slot)} reached no element — the mapping to Sidebar's ` +
        `"${slot}" slot is missing, misspelt, or aimed at another slot`
    ).not.toBeNull();
  });

  it('sends each marker to a different element', () => {
    const target = render();
    const carriers = SLOTS.map((s) => target.querySelector(`.${marker(s)}`));
    expect(new Set(carriers).size, 'two sidebar* keys landed on the same element').toBe(
      SLOTS.length
    );
  });

  it.each(SLOTS)('sends %s to that slot and not to a sibling', (slot) => {
    const target = render();
    const carrier = target.querySelector(`.${marker(slot)}`);
    const missing = libraryClasses(slot).filter((c) => !carrier?.classList.contains(c));
    expect(
      missing,
      `slotClasses.${forwardKey(slot)} landed on an element that is not Sidebar's "${slot}" ` +
        'slot — the pair is crossed with another slot'
    ).toEqual([]);
  });
});
