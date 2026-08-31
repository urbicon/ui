// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SearchIcon from '$lib/icons/SearchIcon.svelte';
import CommandPalette from './CommandPalette.svelte';
import type { CommandPaletteItem, CommandPaletteProps } from './index';

// Item rendering for CommandPalette, which until now had only a variants test.
// The `icon` field used to be SVG *path data* that the component inlined into
// its own `<svg>` — foreign geometry in a library with a full icon set of its own and
// a written geometry contract (hero-review point 25b / S6). It is a component
// now, and this is the DOM guard for that: a variants test cannot tell whether
// the item's icon reaches an element.
//
// The palette renders inside a native popover/dialog, which jsdom has no top
// layer for — queries pass `{ hidden: true }` and assert structure, not
// visibility (that is Playwright's job).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<CommandPaletteProps> = {}) {
  const instance = mount(CommandPalette, {
    target: document.body,
    props: { open: true, shortcut: false, ...props } as CommandPaletteProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const withIcon: CommandPaletteItem[] = [
  { label: 'Search files', category: 'Edit', icon: SearchIcon },
  { label: 'No icon here', category: 'Edit' }
];

describe('CommandPalette (item icons)', () => {
  it('renders an item icon as a component', async () => {
    render({ items: withIcon });
    await tick();

    const option = screen.getByRole('option', { name: /Search files/, hidden: true });
    const svg = option.querySelector('svg');
    expect(svg).not.toBeNull();
    // The slot's own sizing reaches the component through its `class` prop —
    // the icon is not left at its intrinsic 24px.
    expect(svg?.getAttribute('class')).toContain('h-4');
  });

  it('renders no icon element for an item without one', async () => {
    render({ items: withIcon });
    await tick();

    // Negative half: without it, a rule that always renders an icon would pass
    // the assertion above and still be wrong.
    const option = screen.getByRole('option', { name: /No icon here/, hidden: true });
    expect(option.querySelector('svg')).toBeNull();
  });
});

/**
 * An option row is built from four sources — the library's `item` classes, the
 * library's classes for the row's state, then the consumer's entry for each.
 * They are folded against each other rather than joined, so the last source
 * that writes a Tailwind bucket owns it and the stylesheet never arbitrates.
 *
 * The order puts both consumer rungs last on purpose: measured on the two-fold
 * form this replaced, 24 of 24 colliding pairs across `text-color`, `bg-color`,
 * `cursor`, `opacity` and `hover:bg-color` went to the library, so
 * `slotClasses={{ item: 'bg-white' }}` silently kept the highlight background.
 * The price is deliberate — an `item` entry that collides now *removes* the
 * state class, and a consumer who wants both writes both.
 */
const LADDER_ITEMS: CommandPaletteItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma', disabled: true }
];

/** Class tokens of one option row: 0 highlighted, 1 default, 2 disabled. */
function rowTokens(index: number): string[] {
  const rows = screen.getAllByRole('option', { hidden: true });
  const row = rows[index];
  if (!row) throw new Error(`no option row at ${index}; the palette rendered ${rows.length}`);
  return (row.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

describe('CommandPalette (the class ladder on an item row)', () => {
  it('lets an `item` entry beat the library state class it collides with', async () => {
    render({ items: LADDER_ITEMS, slotClasses: { item: 'bg-white' } });
    await tick();

    expect(rowTokens(0)).toContain('bg-white');
    expect(rowTokens(0)).not.toContain('bg-primary-subtle');
    // A different bucket is untouched — the entry displaces, it does not clear.
    expect(rowTokens(0)).toContain('text-primary-text');
  });

  it('gives the state entry the last word over the `item` entry', async () => {
    render({ items: LADDER_ITEMS, slotClasses: { item: 'bg-white', itemHighlighted: 'bg-black' } });
    await tick();

    expect(rowTokens(0)).toContain('bg-black');
    expect(rowTokens(0)).not.toContain('bg-white');
  });

  it('keeps the two consumer rungs in order under `unstyled`', async () => {
    render({
      items: LADDER_ITEMS,
      unstyled: true,
      slotClasses: { item: 'cursor-pointer text-red-500', itemDisabled: 'cursor-not-allowed' }
    });
    await tick();

    // Both library rungs are empty here, so the fold is consumer against
    // consumer and the state entry still owns the bucket it shares.
    expect(rowTokens(2)).toEqual(['text-red-500', 'cursor-not-allowed']);
  });

  it('resolves the library`s own cursor pair on a disabled row', async () => {
    render({ items: LADDER_ITEMS });
    await tick();

    // `item` asks for `cursor-pointer` and `itemDisabled` for `cursor-not-allowed`.
    // Joined raw both shipped and Tailwind's emit order picked the pointer.
    expect(rowTokens(2)).toContain('cursor-not-allowed');
    expect(rowTokens(2)).not.toContain('cursor-pointer');
  });
});
