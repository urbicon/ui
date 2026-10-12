// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, type Snippet, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerBlocksLocale } from '#lib/i18n/index.js';
import SearchIcon from '#lib/icons/SearchIcon.svelte';
import deTranslations from '#lib/translations/de.js';
import { manualAnimations } from '../../internal/__fixtures__/manual-animations';
import PaletteHarness from './__fixtures__/PaletteHarness.svelte';
import CommandPalette from './CommandPalette.svelte';
import type { CommandPaletteHint, CommandPaletteItem, CommandPaletteProps } from './index';

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

/** The results container, reached the way assistive tech reaches it: the input's `aria-controls`. */
function paletteList(input: HTMLElement = paletteInput()): HTMLElement {
  const id = input.getAttribute('aria-controls');
  const list = id === null ? null : document.getElementById(id);
  if (!list) throw new Error(`aria-controls names no element: ${id}`);
  return list;
}

/** The flat index the input's aria-activedescendant names, -1 for none. */
function activeIndex(): number {
  const id = paletteInput().getAttribute('aria-activedescendant');
  return id === null ? -1 : Number(id.slice(id.lastIndexOf('-') + 1));
}

function press(key: string, input: HTMLElement = paletteInput()) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
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
    expect(activeIndex()).toBe(2);
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
    expect(activeIndex()).toBe(1);
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
    expect(activeIndex()).toBe(1);
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
    expect(activeIndex()).toBe(0);
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
    expect(activeIndex()).toBe(0);
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
    expect(activeIndex()).toBe(1);

    const active = document.getElementById(
      paletteInput().getAttribute('aria-activedescendant') ?? ''
    );
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
    expect(activeIndex()).toBe(1);
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

// COMPONENT-API-CONVENTIONS § Common props. The palette has no single root: the
// rest travels through the inner Dialog to its `<dialog>`, the element with the
// dialog role (ConfirmDialog takes the same route), while `class` keeps styling
// the palette content inside it.
describe('CommandPalette (restProps)', () => {
  const ITEMS: CommandPaletteItem[] = [{ id: 'a', label: 'Alpha' }];
  const dialog = () => document.querySelector('dialog') as HTMLDialogElement;
  const search = () => screen.getByRole('combobox', { hidden: true });

  it('passes an unmodelled attribute through to the dialog', async () => {
    render({ items: ITEMS, 'data-testid': 'palette', 'aria-label': 'Command palette' });
    await tick();

    expect(dialog().getAttribute('data-testid')).toBe('palette');
    // The palette has no title, so this is the only accessible name its dialog gets.
    expect(dialog().getAttribute('aria-label')).toBe('Command palette');
  });

  it('keeps its own dialog state against a contradicting consumer', async () => {
    render({ items: ITEMS, 'aria-modal': 'false', 'data-state': 'closed' });
    await tick();

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(dialog().getAttribute('data-state')).toBe('open');
  });

  it('keeps `class` on the palette content, not on the dialog', async () => {
    render({ items: ITEMS, class: 'palette-x' });
    await tick();

    expect(dialog().classList.contains('palette-x')).toBe(false);
    expect(dialog().querySelector('.palette-x')?.contains(search())).toBe(true);
  });

  it('runs a consumer onkeydown and still closes on Escape', async () => {
    const onkeydown = vi.fn();
    const onOpenChange = vi.fn();
    render({ items: ITEMS, onkeydown, onOpenChange });
    await tick();

    search().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    flushSync();

    expect(onkeydown).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// `onClosed` is the inner Dialog's, relayed: it fires once the exit animation
// has ended and focus is back where it was, an animation after
// `onOpenChange(false)`.
describe('CommandPalette (onClosed)', () => {
  const ITEMS: CommandPaletteItem[] = [{ id: 'a', label: 'Alpha' }];

  async function openPalette(props: Partial<CommandPaletteProps>) {
    const animations = manualAnimations();
    const opener = document.createElement('button');
    opener.textContent = 'Opener';
    document.body.appendChild(opener);
    opener.focus();
    render({ items: ITEMS, ...props });
    await animations.finish();
    await tick();
    await tick();
    return { animations, opener };
  }

  it('fires once after the close has finished, an animation after onOpenChange(false)', async () => {
    const order: string[] = [];
    const { animations, opener } = await openPalette({
      onOpenChange: (open) => order.push(`onOpenChange(${open})`),
      onClosed: () => order.push(`onClosed, focus back: ${document.activeElement === opener}`)
    });
    try {
      await userEvent.setup().keyboard('{Escape}');
      expect(order).toEqual(['onOpenChange(false)']);

      await animations.finish();

      expect(order).toEqual(['onOpenChange(false)', 'onClosed, focus back: true']);
    } finally {
      animations.restore();
    }
  });

  it('fires after a selection closes the palette', async () => {
    const onSelect = vi.fn();
    const onClosed = vi.fn();
    const { animations } = await openPalette({ onSelect, onClosed });
    try {
      screen.getByRole('combobox', { hidden: true }).focus();
      await userEvent.setup().keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledOnce();
      expect(onClosed).not.toHaveBeenCalled();

      await animations.finish();

      expect(onClosed).toHaveBeenCalledOnce();
    } finally {
      animations.restore();
    }
  });
});

/**
 * The query and the highlight reset where the close has finished — at outro
 * end, the moment `onClosed` fires — not where the next open starts. Driven
 * through `PaletteHarness`, whose `bind:query` records every write the
 * palette makes, so "one write" is counted rather than inferred.
 */
describe('CommandPalette (reset when the close finishes)', () => {
  const ITEMS: CommandPaletteItem[] = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'g', label: 'Gamma' }
  ];

  type HarnessProps = {
    items?: CommandPaletteItem[];
    initialOpen?: boolean;
    initialQuery?: string;
    vetoClose?: boolean;
    transitionDuration?: number;
    onClosed?: () => void;
    onSelect?: (item: CommandPaletteItem) => void;
  };
  type Harness = {
    setOpen(value: boolean): void;
    getOpen(): boolean;
    setQuery(value: string): void;
    getQuery(): string;
    getQueryWrites(): string[];
  };

  let animations: ReturnType<typeof manualAnimations> | undefined;

  afterEach(() => {
    animations?.restore();
    animations = undefined;
  });

  async function renderHarness(props: HarnessProps = {}): Promise<Harness> {
    const instance = mount(PaletteHarness, {
      target: document.body,
      props: { items: ITEMS, ...props }
    });
    dispose = () => unmount(instance);
    flushSync();
    await animations?.finish();
    await tick();
    await tick();
    return instance as unknown as Harness;
  }

  const dialogOpen = () => document.querySelector('dialog')?.open ?? false;

  /** Finish the exit: the manual animations when installed, a flush otherwise. */
  async function finishOutro() {
    flushSync();
    await animations?.finish();
    await tick();
  }

  for (const duration of ['default', 0] as const) {
    const timing =
      duration === 'default' ? 'with the default exit animation' : 'with transitionDuration 0';
    const setup = (): HarnessProps => {
      if (duration === 'default') animations = manualAnimations();
      return duration === 'default' ? {} : { transitionDuration: 0 };
    };

    it(`keeps the query while closing and resets it once at the end, ${timing}`, async () => {
      const seenInOnClosed: string[] = [];
      const harness: { current?: Harness } = {};
      harness.current = await renderHarness({
        ...setup(),
        onClosed: () => seenInOnClosed.push(harness.current?.getQuery() ?? '<none>')
      });
      type('beta');
      expect(harness.current.getQueryWrites()).toEqual(['beta']);

      press('Escape');
      expect(harness.current.getOpen()).toBe(false);
      if (duration === 'default') {
        // Mid-exit: the palette still shows what was typed.
        expect(paletteInput().value).toBe('beta');
        expect(harness.current.getQuery()).toBe('beta');
      }

      await finishOutro();

      expect(harness.current.getQueryWrites()).toEqual(['beta', '']);
      expect(seenInOnClosed).toEqual(['']);
    });

    it(`resets nothing for a close vetoed in onOpenChange, ${timing}`, async () => {
      const onClosed = vi.fn();
      const harness = await renderHarness({ ...setup(), vetoClose: true, onClosed });
      type('beta');

      press('Escape');
      await finishOutro();

      expect(harness.getOpen()).toBe(true);
      expect(dialogOpen()).toBe(true);
      expect(onClosed).not.toHaveBeenCalled();
      expect(harness.getQueryWrites()).toEqual(['beta']);
      expect(paletteInput().value).toBe('beta');
    });

    it(`keeps the query through a selection until the close finishes, ${timing}`, async () => {
      const seenInOnSelect: string[] = [];
      const harness: { current?: Harness } = {};
      harness.current = await renderHarness({
        ...setup(),
        onSelect: (item) => seenInOnSelect.push(`${item.id}:${harness.current?.getQuery()}`)
      });
      type('gam');

      press('Enter');
      expect(seenInOnSelect).toEqual(['g:gam']);
      if (duration === 'default') expect(harness.current.getQuery()).toBe('gam');

      await finishOutro();

      expect(harness.current.getQueryWrites()).toEqual(['gam', '']);
    });
  }

  it('resets nothing for a close that a reopen interrupts, then once for the close that finishes', async () => {
    animations = manualAnimations();
    const onClosed = vi.fn();
    const harness = await renderHarness({ onClosed });
    type('beta');

    press('Escape');
    harness.setOpen(true);
    await finishOutro();

    expect(onClosed).not.toHaveBeenCalled();
    expect(harness.getQueryWrites()).toEqual(['beta']);
    expect(paletteInput().value).toBe('beta');

    harness.setOpen(false);
    await finishOutro();

    expect(onClosed).toHaveBeenCalledOnce();
    expect(harness.getQueryWrites()).toEqual(['beta', '']);
  });

  it('resets nothing when destroyed during its exit', async () => {
    animations = manualAnimations();
    const harness = await renderHarness();
    type('beta');

    press('Escape');
    dispose?.();
    dispose = undefined;
    await animations.finish();

    expect(harness.getQueryWrites()).toEqual(['beta']);
  });

  it('resets nothing when destroyed while open', async () => {
    const harness = await renderHarness({ transitionDuration: 0 });
    type('beta');

    dispose?.();
    dispose = undefined;
    flushSync();
    await tick();

    expect(harness.getQueryWrites()).toEqual(['beta']);
  });

  it('writes nothing when the query is already empty', async () => {
    const onClosed = vi.fn();
    const harness = await renderHarness({ transitionDuration: 0, onClosed });

    press('Escape');
    await finishOutro();

    expect(onClosed).toHaveBeenCalledOnce();
    expect(harness.getQueryWrites()).toEqual([]);
  });

  it('opens with a query set while closed, and the first open after mount starts empty', async () => {
    const harness = await renderHarness({ initialOpen: false, transitionDuration: 0 });

    harness.setOpen(true);
    flushSync();
    await tick();
    expect(paletteInput().value).toBe('');

    press('Escape');
    await finishOutro();
    expect(dialogOpen()).toBe(false);

    // Set while closed: what a consumer restoring a failed command's text
    // writes, with no tick between the open and the query.
    harness.setQuery('restored');
    harness.setOpen(true);
    flushSync();
    await tick();

    expect(paletteInput().value).toBe('restored');
    expect(harness.getQueryWrites()).toEqual([]);
  });

  it('keeps a query written inside onClosed', async () => {
    const harness: { current?: Harness } = {};
    harness.current = await renderHarness({
      transitionDuration: 0,
      onClosed: () => harness.current?.setQuery('next')
    });
    type('beta');

    press('Escape');
    await finishOutro();
    expect(harness.current.getQuery()).toBe('next');

    harness.current.setOpen(true);
    flushSync();
    await tick();
    expect(paletteInput().value).toBe('next');
  });

  it('resets the highlight with the query', async () => {
    const harness = await renderHarness({ transitionDuration: 0 });
    press('End');
    expect(highlighted()).toBe(2);

    press('Escape');
    await finishOutro();
    harness.setOpen(true);
    flushSync();
    await tick();

    expect(highlighted()).toBe(0);
  });

  it('resets once per close for an open passed without bind:, closed from either side', async () => {
    const onClosed = vi.fn();
    const props = $state({
      open: true,
      shortcut: false as const,
      items: ITEMS,
      onClosed,
      ...({ transitionDuration: 0 } as object)
    });
    const instance = mount(CommandPalette, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    await tick();

    // Closed by the consumer.
    type('beta');
    props.open = false;
    flushSync();
    await tick();
    expect(onClosed).toHaveBeenCalledOnce();
    props.open = true;
    flushSync();
    await tick();
    expect(paletteInput().value).toBe('');

    // Closed by the palette, which can write only its own copy of `open`.
    type('gam');
    press('Escape');
    flushSync();
    await tick();
    expect(onClosed).toHaveBeenCalledTimes(2);
    instance.show();
    flushSync();
    await tick();
    expect(paletteInput().value).toBe('');
  });
});

/**
 * An info row is a line of information among the commands. It is never a stop
 * for the highlight, never selectable, carries no locked look, and is text in
 * the list rather than an option.
 */
const WITH_INFO: CommandPaletteItem[] = [
  { id: 'i0', label: 'Type #project or a date word', kind: 'info' },
  { id: 'a', label: 'Alpha' },
  { id: 'i1', label: 'Two letters start a search', kind: 'info' },
  { id: 'b', label: 'Beta' },
  { id: 'i2', label: 'Nothing else', kind: 'info' }
];

/** The rendered info rows, in order — the presentational rows that are no group label. */
function infoRows(): HTMLElement[] {
  return [...paletteList().querySelectorAll<HTMLElement>(':scope > [role="presentation"]')].filter(
    (row) => !row.classList.contains('uppercase')
  );
}

describe('CommandPalette (info rows)', () => {
  it('steps over info rows with the arrow keys, Home and End', async () => {
    render({ items: WITH_INFO });
    await tick();

    // Row 0 is info, so the open highlight starts on row 1.
    expect(activeIndex()).toBe(1);
    press('ArrowDown');
    expect(activeIndex()).toBe(3);
    press('ArrowDown');
    expect(activeIndex(), 'wraps past the info rows at the end').toBe(1);
    press('ArrowUp');
    expect(activeIndex(), 'wraps past the info rows at the start').toBe(3);
    press('Home');
    expect(activeIndex()).toBe(1);
    press('End');
    expect(activeIndex()).toBe(3);
  });

  it('renders an info row as text in the listbox, not as an option', async () => {
    render({ items: WITH_INFO });
    await tick();

    const options = screen.getAllByRole('option', { hidden: true });
    expect(options.map((o) => o.textContent?.trim())).toEqual(['Alpha', 'Beta']);
    expect(paletteList().getAttribute('role')).toBe('listbox');
    expect(paletteInput().getAttribute('aria-expanded')).toBe('true');

    const rows = infoRows();
    expect(rows.map((row) => row.textContent?.trim())).toEqual([
      'Type #project or a date word',
      'Two letters start a search',
      'Nothing else'
    ]);
    for (const row of rows) {
      expect(row.hasAttribute('id')).toBe(false);
      expect(row.hasAttribute('aria-selected')).toBe(false);
      expect(row.hasAttribute('aria-disabled')).toBe(false);
      expect(row.hasAttribute('data-command-palette-selected')).toBe(false);
    }
  });

  it('gives an info row its own state slot and no locked look', async () => {
    render({
      items: [
        { id: 'i', label: 'A hint', kind: 'info' },
        { id: 'd', label: 'Locked', disabled: true },
        { id: 'a', label: 'Alpha' }
      ],
      slotClasses: { itemInfo: 'italic' }
    });
    await tick();

    const tokens = (infoRows()[0].getAttribute('class') ?? '').split(/\s+/);
    expect(tokens).toContain('text-text-tertiary');
    expect(tokens).toContain('cursor-default');
    expect(tokens).toContain('italic');
    for (const locked of ['opacity-50', 'cursor-not-allowed', 'cursor-pointer']) {
      expect(tokens).not.toContain(locked);
    }
    // The disabled row keeps the locked look the info row does without.
    expect(rowTokens(0)).toContain('opacity-50');
  });

  it('ignores a click and a hover on an info row', async () => {
    const onSelect = vi.fn();
    render({ items: WITH_INFO, onSelect });
    await tick();
    press('ArrowDown');
    expect(activeIndex()).toBe(3);

    const info = infoRows()[1];
    info.dispatchEvent(new MouseEvent('mouseenter'));
    info.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    flushSync();

    expect(activeIndex()).toBe(3);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('treats an info row marked disabled as info', async () => {
    render({ items: [{ id: 'i', label: 'Both', kind: 'info', disabled: true }, ...ROW_STATES] });
    await tick();

    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(3);
    expect(infoRows()[0].hasAttribute('aria-disabled')).toBe(false);
    expect(infoRows()[0].classList.contains('opacity-50')).toBe(false);
  });

  it('has no listbox, no highlight and no Enter when every row is info', async () => {
    const onSelect = vi.fn();
    render({
      items: [
        { id: 'i0', label: 'Nothing to do yet', kind: 'info' },
        { id: 'i1', label: 'Type to capture', kind: 'info' }
      ],
      onSelect
    });
    await tick();

    expect(paletteList().hasAttribute('role')).toBe(false);
    expect(paletteInput().getAttribute('aria-expanded')).toBe('false');
    expect(paletteInput().hasAttribute('aria-activedescendant')).toBe(false);
    press('ArrowDown');
    press('End');
    press('Enter');
    expect(paletteInput().hasAttribute('aria-activedescendant')).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    expect(infoRows()).toHaveLength(2);
  });

  it('has no listbox in the empty state either', async () => {
    render({ items: [], emptyText: 'Nothing here' });
    await tick();

    const list = paletteList();
    expect(list.textContent).toContain('Nothing here');
    expect(list.hasAttribute('role')).toBe(false);
    expect(paletteInput().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves the highlight off a row that becomes info', async () => {
    const props = $state({
      open: true,
      shortcut: false as const,
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' }
      ] as CommandPaletteItem[]
    });
    const instance = mount(CommandPalette, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    await tick();
    press('End');
    expect(activeIndex()).toBe(2);

    props.items = [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma', kind: 'info' }
    ];
    flushSync();
    await tick();

    expect(activeIndex()).toBe(0);
    expect(highlighted()).toBe(0);
  });

  it('starts on the first action when a query puts an info row first', async () => {
    render({
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'tip', label: 'Beta tip', kind: 'info' },
        { id: 'b', label: 'Beta' }
      ]
    });
    await tick();

    type('beta');
    expect(activeIndex()).toBe(1);
    expect(screen.getAllByRole('option', { hidden: true })[0].textContent?.trim()).toBe('Beta');
  });

  it('draws an info row through customItem, never highlighted, with a select that does nothing', async () => {
    const args: CustomItemArgs[] = [];
    const onSelect = vi.fn();
    render({ items: WITH_INFO, customItem: customRow((row) => args.push(row)), onSelect });
    await tick();

    const infoArgs = args.filter(([item]) => item.kind === 'info');
    expect(infoArgs.map(([item, isHighlighted, index]) => [item.id, isHighlighted, index])).toEqual(
      [
        ['i0', false, 0],
        ['i1', false, 2],
        ['i2', false, 4]
      ]
    );
    for (const [, , , select] of infoArgs) select();
    flushSync();
    expect(onSelect).not.toHaveBeenCalled();

    // The snippet's content sits in the presentational row, not in an option.
    const drawn = document.querySelector('[data-custom-row="Two letters start a search"]');
    expect(drawn?.parentElement?.getAttribute('role')).toBe('presentation');
  });

  it('names an option by its label and its excerpt, where an explanation is heard', async () => {
    render({ items: [{ id: 'u', label: 'Undo', excerpt: 'Nothing to undo yet' }] });
    await tick();

    // The option the input's aria-activedescendant names carries the excerpt
    // in its accessible name; an info row is never that option.
    const option = screen.getByRole('option', {
      name: /^Undo\s*Nothing to undo yet$/,
      hidden: true
    });
    expect(option.id).toBe(paletteInput().getAttribute('aria-activedescendant'));
  });
});

/** An info row above and below more commands than the list shows at once. */
const EDGE_ROWS: CommandPaletteItem[] = [
  { id: 'hint-top', label: 'Type #project or a date word', kind: 'info' },
  ...Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, label: `Command ${i + 1}` })),
  { id: 'hint-bottom', label: 'Two letters start a search', kind: 'info' }
];

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * The highlight scrolls into view a frame after it moves. At the first and the
 * last command the list first scrolls to its own edge, so the info rows, group
 * label or disabled rows beyond that command come into view as well: the
 * keyboard stays in the input and has no other way to reach them. jsdom lays
 * nothing out, so the list gets a `scrollHeight` to tell its end from its
 * start; which rows really show, the command among them, is
 * `e2e/command-palette.spec.ts`.
 */
describe('CommandPalette (scrolling the highlight into view)', () => {
  it('scrolls to the list`s start at the first command and to its end at the last', async () => {
    render({ items: EDGE_ROWS });
    await tick();
    const list = paletteList();
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });

    press('End');
    await nextFrame();
    expect(list.scrollTop, 'End').toBe(1000);

    press('Home');
    await nextFrame();
    expect(list.scrollTop, 'Home').toBe(0);

    press('ArrowUp');
    await nextFrame();
    expect(list.scrollTop, 'ArrowUp, wrapping to the last command').toBe(1000);

    press('ArrowDown');
    await nextFrame();
    expect(list.scrollTop, 'ArrowDown, wrapping to the first command').toBe(0);
  });

  it('brings the new highlight into view when a query moves it', async () => {
    render({ items: EDGE_ROWS });
    await tick();
    const list = paletteList();
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 1000 });

    press('End');
    await nextFrame();
    expect(list.scrollTop, 'End').toBe(1000);

    // Typing highlights the first match, which no key moved there.
    type('Command 1');
    await nextFrame();
    expect(list.scrollTop, 'first match after a query').toBe(0);
  });

  it('scrolls a command between the edges only as far as its row', async () => {
    const scrolls = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      render({ items: EDGE_ROWS });
      await tick();
      // The opening scrolls its own highlight in; this test is about the key.
      await nextFrame();
      scrolls.mockClear();
      paletteList().scrollTop = 300;

      press('ArrowDown');
      await nextFrame();

      expect(scrolls).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
      expect(scrolls.mock.contexts[0]).toBe(paletteList().querySelector('[aria-selected="true"]'));
      expect(paletteList().scrollTop).toBe(300);
    } finally {
      scrolls.mockRestore();
    }
  });
});

/**
 * Two palettes on one page, a site's global search beside a page's own. Each
 * one's ARIA references and its scrolling stay inside it.
 */
describe('CommandPalette (two on one page)', () => {
  function renderTwo(items: CommandPaletteItem[]): HTMLInputElement[] {
    const instances = [0, 1].map(() =>
      mount(CommandPalette, {
        target: document.body,
        props: { open: true, shortcut: false, items }
      })
    );
    dispose = () => {
      for (const instance of instances) unmount(instance);
    };
    flushSync();
    return screen.getAllByRole('combobox', { hidden: true }) as HTMLInputElement[];
  }

  it('gives each palette its own list and row ids', async () => {
    const inputs = renderTwo(ROW_STATES);
    await tick();
    expect(inputs).toHaveLength(2);

    const listIds = inputs.map((input) => input.getAttribute('aria-controls'));
    expect(new Set(listIds).size).toBe(2);
    for (const input of inputs) {
      const list = paletteList(input);
      const active = document.getElementById(input.getAttribute('aria-activedescendant') ?? '');
      expect(input.closest('dialog')?.contains(list)).toBe(true);
      expect(list.contains(active)).toBe(true);
      expect(active?.getAttribute('aria-selected')).toBe('true');
    }
  });

  it('scrolls the highlighted row of its own list', async () => {
    const scrolls = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const [, second] = renderTwo(EDGE_ROWS);
      await tick();
      await nextFrame();
      scrolls.mockClear();

      press('ArrowDown', second);
      await nextFrame();

      const ownRow = paletteList(second).querySelector('[aria-selected="true"]');
      expect(ownRow?.textContent?.trim()).toBe('Command 2');
      expect(scrolls).toHaveBeenCalledOnce();
      expect(scrolls.mock.contexts[0]).toBe(ownRow);
    } finally {
      scrolls.mockRestore();
    }
  });

  it('derives the list and row ids from an id you pass, which stays on the dialog', async () => {
    render({ items: ROW_STATES, id: 'commands' });
    await tick();

    expect(document.querySelector('dialog')?.id).toBe('commands');
    expect(paletteInput().getAttribute('aria-controls')).toBe('commands-list');
    expect(paletteInput().getAttribute('aria-activedescendant')).toBe('commands-item-0');
  });
});

/**
 * The footer's key hints: data the palette translates and hands to a `footer`
 * snippet, drawn through `Kbd` when there is none.
 */
describe('CommandPalette (footer)', () => {
  function footerBar(): HTMLElement {
    const bar = paletteList().nextElementSibling;
    if (!(bar instanceof HTMLElement)) throw new Error('no footer bar after the list');
    return bar;
  }

  /** Each hint's text, keycap and label. */
  const hintTexts = () =>
    [...footerBar().children].map((hint) => hint.textContent?.replace(/\s+/g, ' ').trim());

  it('draws each default hint as a Kbd keycap with its label', async () => {
    render({ items: ROW_STATES });
    await tick();

    const caps = [...footerBar().querySelectorAll('kbd')];
    expect(caps.map((cap) => cap.textContent?.trim())).toEqual(['↑↓', '↵', 'esc']);
    expect(hintTexts()).toEqual(['↑↓ Navigate', '↵ Select', 'esc Close']);
    // Kbd's own keycap, at its sm size.
    for (const cap of caps) {
      expect(cap.classList.contains('bg-surface-elevated')).toBe(true);
      expect(cap.classList.contains('h-4')).toBe(true);
    }
  });

  it('reaches the keycaps through slotClasses.kbd', async () => {
    render({ items: ROW_STATES, slotClasses: { kbd: 'bg-black' } });
    await tick();

    const cap = footerBar().querySelector('kbd');
    expect(cap?.classList.contains('bg-black')).toBe(true);
    expect(cap?.classList.contains('bg-surface-elevated')).toBe(false);
  });

  it('strips the keycaps` own look under unstyled', async () => {
    render({ items: ROW_STATES, unstyled: true, slotClasses: { kbd: 'cap' } });
    await tick();

    expect(footerBar().querySelector('kbd')?.getAttribute('class')).toBe('cap');
  });

  it('hands the hints to a footer snippet, inside the footer bar', async () => {
    const received: CommandPaletteHint[][] = [];
    const footer = createRawSnippet<[{ hints: CommandPaletteHint[] }]>((args) => {
      const { hints } = args();
      received.push(hints);
      const kept = hints.filter((hint) => hint.id !== 'navigate');
      return {
        render: () =>
          `<span data-own-footer>${kept.map((hint) => `${hint.keys} ${hint.label}`).join(' / ')}</span>`
      };
    });
    render({ items: ROW_STATES, footer, slotClasses: { footer: 'own-bar' } });
    await tick();

    expect(received.at(-1)).toEqual([
      { id: 'navigate', keys: '↑↓', label: 'Navigate' },
      { id: 'select', keys: '↵', label: 'Select' },
      { id: 'close', keys: 'esc', label: 'Close' }
    ]);
    const bar = footerBar();
    expect(bar.classList.contains('own-bar')).toBe(true);
    expect(bar.querySelector('[data-own-footer]')?.textContent).toBe('↵ Select / esc Close');
    expect(bar.querySelector('kbd')).toBeNull();
  });

  it('hides the footer bar under showFooter={false}, a footer snippet included', async () => {
    const footer = createRawSnippet<[{ hints: CommandPaletteHint[] }]>(() => ({
      render: () => '<span data-own-footer>mine</span>'
    }));
    render({ items: ROW_STATES, footer, showFooter: false });
    await tick();

    expect(paletteList().nextElementSibling).toBeNull();
    expect(document.querySelector('[data-own-footer]')).toBeNull();
  });

  it('translates the keys with the labels', async () => {
    registerBlocksLocale('de', deTranslations);
    const instance = mount(PaletteHarness, {
      target: document.body,
      props: { items: ROW_STATES, locale: 'de' }
    });
    dispose = () => unmount(instance);
    flushSync();
    await tick();

    expect(hintTexts()).toEqual(['↑↓ Navigieren', '↵ Auswählen', 'Esc Schließen']);
  });
});
