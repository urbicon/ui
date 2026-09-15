// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { createRawSnippet, flushSync, mount, type Snippet, tick, unmount } from 'svelte';
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

/** One row per state: 0 highlighted, 1 default, 2 disabled. */
const ROW_STATES: CommandPaletteItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma', disabled: true }
];

/** Class tokens of one rendered option row. */
function rowTokens(index: number): string[] {
  const rows = screen.getAllByRole('option', { hidden: true });
  const row = rows[index];
  if (!row) throw new Error(`no option row at ${index}; the palette rendered ${rows.length}`);
  return (row.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

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
describe('CommandPalette (the class ladder on an item row)', () => {
  it('lets an `item` entry beat the library state class it collides with', async () => {
    render({ items: ROW_STATES, slotClasses: { item: 'bg-white' } });
    await tick();

    expect(rowTokens(0)).toContain('bg-white');
    expect(rowTokens(0)).not.toContain('bg-primary-subtle');
    // A different bucket is untouched — the entry displaces, it does not clear.
    expect(rowTokens(0)).toContain('text-primary-text');
  });

  it('gives the state entry the last word over the `item` entry', async () => {
    render({ items: ROW_STATES, slotClasses: { item: 'bg-white', itemHighlighted: 'bg-black' } });
    await tick();

    expect(rowTokens(0)).toContain('bg-black');
    expect(rowTokens(0)).not.toContain('bg-white');
  });

  it('keeps the two consumer rungs in order under `unstyled`', async () => {
    render({
      items: ROW_STATES,
      unstyled: true,
      slotClasses: { item: 'cursor-pointer text-red-500', itemDisabled: 'cursor-not-allowed' }
    });
    await tick();

    // Both library rungs are empty here, so the fold is consumer against
    // consumer and the state entry still owns the bucket it shares.
    expect(rowTokens(2)).toEqual(['text-red-500', 'cursor-not-allowed']);
  });

  it('resolves the library`s own cursor pair on a disabled row', async () => {
    render({ items: ROW_STATES });
    await tick();

    // `item` asks for `cursor-pointer` and `itemDisabled` for `cursor-not-allowed`.
    // Joined raw both shipped and Tailwind's emit order picked the pointer.
    expect(rowTokens(2)).toContain('cursor-not-allowed');
    expect(rowTokens(2)).not.toContain('cursor-pointer');
  });
});

/**
 * Keyboard navigation over a list with disabled rows. A disabled row cannot be
 * selected (Enter is a no-op on it), so the highlight must never rest there —
 * not by arrow key, not by Home/End, and not after a filter narrows the list.
 * The index math is the shared roving helper (`utils/roving`), which wraps at
 * both ends like Tab, ButtonGroup and SegmentGroup.
 */
const ROVING_ITEMS: CommandPaletteItem[] = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta', disabled: true },
  { id: 'c', label: 'Gamma' },
  { id: 'd', label: 'Delta', disabled: true }
];

function paletteInput(): HTMLInputElement {
  return screen.getByRole('combobox', { hidden: true }) as HTMLInputElement;
}

function press(key: string) {
  paletteInput().dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
  flushSync();
}

function type(value: string) {
  const input = paletteInput();
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

/** Flat index of the highlighted row, -1 when no row is highlighted. */
function highlighted(): number {
  const rows = screen.getAllByRole('option', { hidden: true });
  return rows.findIndex((row) => row.getAttribute('aria-selected') === 'true');
}

describe('CommandPalette (keyboard navigation over disabled rows)', () => {
  it('ArrowDown steps over a disabled row', async () => {
    render({ items: ROVING_ITEMS });
    await tick();

    expect(highlighted()).toBe(0);
    press('ArrowDown');
    expect(highlighted()).toBe(2);
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-2');
  });

  it('ArrowUp steps over a disabled row upwards', async () => {
    render({ items: ROVING_ITEMS });
    await tick();

    press('ArrowDown');
    expect(highlighted()).toBe(2);
    press('ArrowUp');
    expect(highlighted()).toBe(0);
  });

  it('wraps at both ends, skipping the disabled edge rows', async () => {
    render({ items: ROVING_ITEMS });
    await tick();

    press('ArrowUp');
    expect(highlighted()).toBe(2);
    press('ArrowDown');
    expect(highlighted()).toBe(0);
  });

  it('Home and End land on the enabled edges', async () => {
    render({
      items: [
        { id: 'x', label: 'First', disabled: true },
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'y', label: 'Last', disabled: true }
      ]
    });
    await tick();

    press('End');
    expect(highlighted()).toBe(2);
    press('Home');
    expect(highlighted()).toBe(1);
  });

  it('opens on the first enabled row when the first row is disabled', async () => {
    render({
      items: [
        { id: 'x', label: 'First', disabled: true },
        { id: 'a', label: 'Alpha' }
      ]
    });
    await tick();

    expect(highlighted()).toBe(1);
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-1');
  });

  it('resets to the first enabled match when the query changes', async () => {
    render({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b1', label: 'Beta one', disabled: true },
        { id: 'b2', label: 'Beta two' }
      ]
    });
    await tick();

    expect(highlighted()).toBe(0);
    type('beta');
    // `filtered` is now [Beta one (disabled), Beta two].
    expect(highlighted()).toBe(1);
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-1');
  });

  /**
   * The list changes under the highlight without the query moving — remote
   * results arriving, a row's `disabled` flipping, the list shrinking. The
   * highlight is derived from the user's index against the *current* list, so
   * none of these can leave it on a row that cannot be selected.
   */
  function renderLive(items: CommandPaletteItem[], onSelect?: (item: CommandPaletteItem) => void) {
    const props = $state({ open: true, shortcut: false as const, items, onSelect });
    const instance = mount(CommandPalette, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    return props;
  }

  it('highlights the first row when items arrive after opening on an empty list', async () => {
    const selected: CommandPaletteItem[] = [];
    const props = renderLive([], (item) => selected.push(item));
    await tick();
    expect(paletteInput().hasAttribute('aria-activedescendant')).toBe(false);

    props.items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' }
    ];
    flushSync();
    await tick();

    expect(highlighted()).toBe(0);
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-0');
    // Enter works at once — no arrow key needed to "wake" the highlight.
    press('Enter');
    expect(selected.map((item) => item.id)).toEqual(['a']);
  });

  it('leaves a row that becomes disabled under the highlight', async () => {
    const props = renderLive([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' }
    ]);
    await tick();
    press('ArrowDown');
    press('ArrowDown');
    expect(highlighted()).toBe(2);

    props.items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma', disabled: true }
    ];
    flushSync();
    await tick();

    expect(highlighted()).toBe(0);
    expect(
      screen.getAllByRole('option', { hidden: true })[2].getAttribute('aria-disabled'),
      'the row is still disabled'
    ).toBe('true');
  });

  it('falls back to the first enabled row when the list shrinks past the highlight', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, label: `Row ${i}` }));
    const props = renderLive(six);
    await tick();
    press('End');
    expect(highlighted()).toBe(5);

    props.items = six.slice(0, 3);
    flushSync();
    await tick();

    expect(highlighted()).toBe(0);
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-0');
  });

  it('highlights nothing and ignores Enter when every row is disabled', async () => {
    const selected: CommandPaletteItem[] = [];
    render({
      items: [
        { id: 'a', label: 'Alpha', disabled: true },
        { id: 'b', label: 'Beta', disabled: true }
      ],
      onSelect: (item) => selected.push(item)
    });
    await tick();

    expect(highlighted()).toBe(-1);
    expect(paletteInput().hasAttribute('aria-activedescendant')).toBe(false);
    press('ArrowDown');
    expect(highlighted()).toBe(-1);
    press('Enter');
    expect(selected).toEqual([]);
  });
});

/**
 * `customItem` draws a row's visible content; the option container stays with
 * the component. The input's `aria-activedescendant` and the scroll-into-view
 * query (`[data-command-palette-selected="true"]`) both read that container, so
 * a snippet that had to draw it would carry the whole ARIA contract — and the
 * hover highlight, which lives on the container's `onmouseenter`.
 */
type CustomItemArgs = [CommandPaletteItem, boolean, number, () => void];

/**
 * A `customItem` that draws content only. `record` receives each row's
 * positional args, so a test can invoke that row's own `select`.
 */
function customRow(record?: (args: CustomItemArgs) => void): Snippet<CustomItemArgs> {
  return createRawSnippet<CustomItemArgs>((item, isHighlighted, index, select) => {
    record?.([item(), isHighlighted(), index(), select()]);
    const label = item().label;
    return { render: () => `<span data-custom-row="${label}">${label}</span>` };
  });
}

/** The shape the contract forbids: a focusable control inside the row. */
function forbiddenControlRow(): Snippet<CustomItemArgs> {
  return createRawSnippet<CustomItemArgs>((item, _highlighted, _index, select) => {
    const label = item().label;
    return {
      render: () => `<button type="button" data-inner-control="${label}">${label}</button>`,
      setup: (element) => {
        element.addEventListener('click', () => select()());
      }
    };
  });
}

describe('CommandPalette (customItem draws content, not the container)', () => {
  it('points aria-activedescendant at a container the snippet did not create', async () => {
    render({ items: ROW_STATES, customItem: customRow() });
    await tick();

    press('ArrowDown');
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-1');

    const active = document.getElementById('command-palette-item-1');
    expect(active).not.toBeNull();
    expect(active?.getAttribute('role')).toBe('option');
    expect(active?.getAttribute('aria-selected')).toBe('true');
    expect(active?.getAttribute('data-command-palette-selected')).toBe('true');

    // The snippet's own root sits inside that container, and brought no second
    // `role="option"` with it.
    const drawn = active?.querySelector('[data-custom-row="Beta"]');
    expect(drawn).not.toBeNull();
    expect(drawn?.parentElement).toBe(active);
    expect(active?.querySelector('[role="option"]')).toBeNull();
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3);
  });

  it('moves the highlight when a custom row is hovered', async () => {
    render({ items: ROW_STATES, customItem: customRow() });
    await tick();
    expect(highlighted()).toBe(0);

    screen.getAllByRole('option', { hidden: true })[1].dispatchEvent(new MouseEvent('mouseenter'));
    flushSync();

    expect(highlighted()).toBe(1);
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('command-palette-item-1');
  });

  it('hovering a disabled custom row leaves the highlight where it is', async () => {
    render({ items: ROW_STATES, customItem: customRow() });
    await tick();

    screen.getAllByRole('option', { hidden: true })[2].dispatchEvent(new MouseEvent('mouseenter'));
    flushSync();

    expect(highlighted()).toBe(0);
  });

  it('selects through the `select` the snippet is handed, disabled rows aside', async () => {
    const args: CustomItemArgs[] = [];
    const selected: CommandPaletteItem[] = [];
    render({
      items: ROW_STATES,
      customItem: customRow((row) => args.push(row)),
      onSelect: (item) => selected.push(item)
    });
    await tick();

    expect(args.map(([item]) => item.id)).toEqual(['a', 'b', 'c']);
    expect(args.map(([, isHighlighted]) => isHighlighted)).toEqual([true, false, false]);
    expect(args.map(([, , index]) => index)).toEqual([0, 1, 2]);

    args[2][3]();
    flushSync();
    expect(selected, 'a disabled row cannot select itself').toEqual([]);

    args[1][3]();
    flushSync();
    expect(selected.map((item) => item.id)).toEqual(['b']);
  });

  it('selects once when the snippet`s own content is clicked', async () => {
    const selected: CommandPaletteItem[] = [];
    render({
      items: ROW_STATES,
      customItem: customRow(),
      onSelect: (item) => selected.push(item)
    });
    await tick();

    // The container carries the click for the whole row — a snippet that draws
    // content needs no click handler of its own.
    const drawn = document.querySelector('[data-custom-row="Beta"]');
    drawn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(selected.map((item) => item.id)).toEqual(['b']);
  });

  it('measures the cost of a control inside the row: it selects twice', async () => {
    const selected: CommandPaletteItem[] = [];
    render({
      items: ROW_STATES,
      customItem: forbiddenControlRow(),
      onSelect: (item) => selected.push(item)
    });
    await tick();

    document
      .querySelector('[data-inner-control="Beta"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(selected.map((item) => item.id)).toEqual(['b', 'b']);
  });

  it('folds slotClasses onto the container of a custom row', async () => {
    render({
      items: ROW_STATES,
      customItem: customRow(),
      slotClasses: { item: 'bg-white', itemHighlighted: 'bg-black' }
    });
    await tick();

    // The same four-source fold as the default branch: the state entry owns the
    // bucket it shares with the `item` entry, which owns the library's.
    expect(rowTokens(0)).toContain('bg-black');
    expect(rowTokens(0)).not.toContain('bg-white');
    expect(rowTokens(0)).not.toContain('bg-primary-subtle');
    expect(rowTokens(1)).toContain('bg-white');
    expect(rowTokens(1)).not.toContain('bg-black');
  });
});
