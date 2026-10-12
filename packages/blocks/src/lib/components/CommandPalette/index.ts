import type { Snippet } from 'svelte';
import type { HTMLDialogAttributes } from 'svelte/elements';
import type { IconComponent } from '#lib/icons/index.js';
import type { CommandPaletteSlots, CommandPaletteVariants } from './commandPalette.variants';

/**
 * A single item in the command palette.
 *
 * @example
 * ```ts
 * const item: CommandPaletteItem = {
 *   id: 'new-file',
 *   label: 'New File',
 *   category: 'File',
 *   shortcut: 'Ctrl+N',
 * };
 * ```
 */
export interface CommandPaletteItem {
  /** Unique identifier. Falls back to `label` when omitted. */
  id?: string;
  /** Display text shown in the list. */
  label: string;
  /**
   * Secondary line rendered under the label, truncated to one line: context the
   * label cannot carry, a description or an excerpt around a search match. It is
   * part of a command's accessible name, so a screen reader reads it with the label.
   */
  excerpt?: string;
  /** Group header this item belongs to. Items with the same category are grouped together. */
  category?: string;
  /** Optional keyboard shortcut displayed on the right side. */
  shortcut?: string;
  /**
   * Leading icon component. Pass an icon directly (`import { SearchIcon } from
   * '@urbicon-ui/blocks'`), not an icon *name* — a name would have to be
   * resolved through the registry at runtime, and that dynamic lookup drags all
   * the entire icon set into the consumer bundle (see docs/ICON-DESIGN.md). Rendered at
   * the slot's own size, inheriting `currentColor`.
   */
  icon?: IconComponent;
  /**
   * `'info'` makes the row information, not a command: keyboard and pointer skip it,
   * it cannot be selected, it has no locked look (`itemInfo` styles it), and a screen
   * reader reads it in reading mode only, never while the user types: what must be heard
   * goes in the `excerpt` of an enabled command. `disabled` has no effect. @default 'action'
   */
  kind?: 'action' | 'info';
  /**
   * A command that cannot run right now: dimmed, skipped by the keyboard, not
   * selectable, read as unavailable in reading mode only. @default false
   */
  disabled?: boolean;
  /** Arbitrary payload forwarded to `onSelect`. */
  data?: unknown;
}

/**
 * One key hint in the palette's footer: the key, and what it does there.
 *
 * @example
 * ```ts
 * const hint: CommandPaletteHint = { id: 'complete', keys: 'Tab', label: 'Complete' };
 * ```
 */
export interface CommandPaletteHint {
  /**
   * Which hint this is. The palette's own are `'navigate'`, `'select'` and
   * `'close'`; pick or drop one by its id. Give a hint you add an id the
   * others do not use, so an `{#each}` can key on it.
   */
  id: string;
  /**
   * The key, in the form `Kbd`'s `keys` takes: a string is one keycap, an
   * array is a chord drawn in one keycap (`['Ctrl', 'K']` → Ctrl + K). The
   * palette's own come from its translations (`commandPalette.keys.*`).
   */
  keys: string | string[];
  /** What the key does, already translated. */
  label: string;
}

/**
 * Props for the CommandPalette component.
 *
 * @summary Everything the app can do, one keystroke away.
 * @description Keyboard-driven command palette with search, grouped results,
 * and arrow-key navigation. Composes Dialog + search input into a ready-to-use overlay.
 * Open via bind:open or the built-in Cmd+K shortcut. A row is a command, or with
 * `kind: 'info'` a line of information the keyboard passes over; the footer's key hints are
 * drawn with `Kbd` and can be replaced through the `footer` snippet.
 *
 * @tag action
 * @related Dialog
 * @related Menu
 * @related Combobox
 * @related Kbd
 *
 * @example
 * ```svelte
 * <CommandPalette
 *   items={commands}
 *   bind:open
 *   onSelect={(item) => handleCommand(item)}
 *   placeholder="Type a command..."
 * />
 * ```
 *
 * @example
 * ```svelte
 * <CommandPalette
 *   items={[
 *     { id: 'new', label: 'New File', category: 'File', shortcut: 'Ctrl+N' },
 *     { id: 'open', label: 'Open File', category: 'File', shortcut: 'Ctrl+O' },
 *     { id: 'theme', label: 'Toggle Theme', category: 'Settings' },
 *     { id: 'search', label: 'Search', category: 'Navigation', shortcut: 'Ctrl+F' }
 *   ]}
 *   bind:open={paletteOpen}
 *   onSelect={(item) => runAction(item.id)}
 *   size="md"
 *   showFooter
 * />
 * ```
 */
export interface CommandPaletteProps
  // The rest of a dialog's attributes travel through the inner Dialog to its
  // `<dialog>` element, the one that carries the dialog role and so the one an
  // `aria-label` names; `class` styles the panel content inside it instead.
  // `title` and `draggable` are Dialog props that mean something other than the
  // HTML attribute, so the type leaves them out.
  extends Omit<HTMLDialogAttributes, 'children' | 'open' | 'title' | 'draggable'> {
  // ── Content ──────────────────────────────────────────────

  /** Items to display. Grouped automatically by `category`. */
  items: CommandPaletteItem[];

  /** Placeholder text for the search input. @default 'Search...' */
  placeholder?: string;

  /** Message shown when the filter returns no results. @default 'No results found.' */
  emptyText?: string;

  /**
   * Show the footer with the keyboard hints. `false` hides the footer bar,
   * a `footer` snippet included.
   * @default true
   */
  showFooter?: boolean;

  // ── Behavior ─────────────────────────────────────────────

  /** Controls visibility. Supports `bind:open`. @default false */
  open?: boolean;

  /**
   * Current search text. Supports `bind:query`. Reset to `''` when the palette
   * has finished closing, just before `onClosed` fires, so it does not empty
   * while it animates out. A query you set once it has closed — in `onClosed`
   * or later, before or after `open = true` — is what it opens with; one you
   * write between `open = false` and `onClosed` is reset. A close that does
   * not finish resets nothing: one vetoed by writing `open = true` back in
   * `onOpenChange`, one interrupted by reopening (from `onSelect` too, so a
   * drill-down that swaps `items` there sets `query = ''` itself), or the
   * palette destroyed before it ends, as an `{#if}` that unmounts it on close
   * does: clear your bound query where you unmount it. Selecting an item
   * leaves the query as it was until then.
   *
   * For async or remote search, watch the bound `query`, fetch your own
   * results, and pass them back via `items` with `filter={() => true}` so the
   * built-in label match does not filter them a second time.
   *
   * @default ''
   */
  query?: string;

  /**
   * Register a global keyboard shortcut that toggles the palette. `mod` is
   * Cmd on macOS and Ctrl elsewhere. Set to `false` to disable.
   * @default 'mod+k'
   */
  shortcut?: string | false;

  /**
   * Custom filter function. Receives each item and the current query.
   * Return `true` to keep the item. When omitted, a case-insensitive
   * label + category substring match is used.
   */
  filter?: (item: CommandPaletteItem, query: string) => boolean;

  // ── Callbacks ────────────────────────────────────────────

  /** Fired when an item is selected via click or Enter. */
  onSelect?: (item: CommandPaletteItem) => void;

  /** Fired when the open state changes (close via Escape, backdrop, or selection). */
  onOpenChange?: (open: boolean) => void;

  /**
   * Fires once the palette has finished closing — the exit animation has
   * ended and focus is back on the element that had it before the palette
   * opened, unless that element is gone or still inert: when stacked surfaces
   * close together, focus can end on the page body. Fires once for every close that finishes:
   * Escape, a backdrop click, a selection, or `open = false` from you. Not
   * for a close interrupted by reopening before the animation ends, nor when
   * the palette is destroyed while open or mid-close. `onOpenChange(false)`
   * fires an animation earlier, while focus is still in the palette; this is
   * the place to move focus elsewhere or open a follow-up surface. The query
   * and the highlight have been reset by then.
   */
  onClosed?: () => void;

  // ── Snippets (custom rendering) ──────────────────────────

  /**
   * Replace the default per-row rendering. Receives the item, whether its row
   * is highlighted, the item's flat index into the filtered list, and a
   * `select` callback (call it to run the same selection the row's click runs;
   * it is a no-op on a disabled item and on an `info` row). It draws `info`
   * rows too: `highlighted` is always `false` for them.
   *
   * **Render visible content only — nothing focusable, nothing interactive.**
   * A `<button>` or `<a>` inside the row is nested-interactive HTML on the
   * `role="option"` container, a tab stop inside the Dialog's focus trap that
   * the input's keyboard handling never reaches, and a click that bubbles into
   * the row's own, so `onSelect` fires twice. `select` is for a snippet that
   * dispatches from its own non-interactive logic — a pointer gesture on the
   * content, say — and for parity with Select's `toggle`.
   *
   * The outer `<div role="option">` container is still owned by CommandPalette:
   * its id is what the input's `aria-activedescendant` points at, its
   * `data-command-palette-selected` attribute is what the scroll-into-view
   * query finds, and it carries the row's click and hover-highlight. An `info`
   * row's container is a plain `<div role="presentation">` with neither.
   *
   * Styling the row is `slotClasses.item` plus the state slot
   * (`itemHighlighted`, `itemDisabled`, `itemInfo` or `itemDefault`), which
   * reach the container here as well; the `itemIcon`, `itemText`, `itemLabel`,
   * `itemExcerpt` and `itemShortcut` slots style the default contents and go
   * unused under `customItem`.
   *
   * Positional args: `(item, highlighted, index, select)`.
   */
  customItem?: Snippet<
    [item: CommandPaletteItem, highlighted: boolean, index: number, select: () => void]
  >;

  /** Custom empty-state renderer. Receives the current query string. */
  customEmpty?: Snippet<[query: string]>;

  /**
   * Replace the footer's contents. Receives `{ hints }`, the palette's own key
   * hints in their default order — `navigate` (↑↓), `select` (↵) and `close`
   * (esc), keys and labels already translated — to render all, some, or
   * none of, next to hints of your own. Render a key through `Kbd`:
   * `<Kbd keys={hint.keys} size="sm" />` draws it the way the default footer
   * does. The footer bar itself stays the palette's, styled by the `footer`
   * slot, and `showFooter={false}` hides it with the snippet in it.
   *
   * Positional args: `({ hints })`.
   */
  footer?: Snippet<[footer: { hints: CommandPaletteHint[] }]>;

  // ── Variants ─────────────────────────────────────────────

  /** Maximum width of the palette panel. @default 'md' */
  size?: CommandPaletteVariants['size'];

  // ── Styling ──────────────────────────────────────────────

  /** Additional CSS classes on the root wrapper. */
  class?: string;

  /** Strip all default styles, the modal Dialog's included. @default false */
  unstyled?: boolean;

  /**
   * Per-slot class overrides. A row is built from four sources in order — the
   * library's `item` classes, the library's classes for the row's state
   * (`itemInfo` for an `info` row, `itemDisabled` when the item is disabled,
   * `itemHighlighted` when selected, `itemDefault` otherwise), then your
   * `item` entry, then your entry for that state slot. Each source displaces
   * the earlier ones per Tailwind bucket, so an `item` entry that collides
   * with a state class *removes* it: `slotClasses={{ item: 'bg-white' }}` also
   * drops the selected row's `bg-primary-subtle`. Write the state slot as well
   * to keep both. `kbd` reaches the `Kbd` each default footer hint renders,
   * after its own classes.
   */
  slotClasses?: Partial<Record<CommandPaletteSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ CommandPalette: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as CommandPalette } from './CommandPalette.svelte';
export { type CommandPaletteVariants, commandPaletteVariants } from './commandPalette.variants';
