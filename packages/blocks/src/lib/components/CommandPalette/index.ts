import type { Snippet } from 'svelte';
import type { IconComponent } from '$lib/icons';
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
   * Secondary line rendered under the label, truncated to one line. Use it for
   * context the label cannot carry — a description, or an excerpt around a
   * search match.
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
  /** Whether the item is non-selectable. @default false */
  disabled?: boolean;
  /** Arbitrary payload forwarded to `onSelect`. */
  data?: unknown;
}

/**
 * Props for the CommandPalette component.
 *
 * @summary Everything the app can do, one keystroke away.
 * @description Keyboard-driven command palette with search, grouped results,
 * and arrow-key navigation. Composes Dialog + search input into a ready-to-use overlay.
 * Open via bind:open or the built-in Cmd+K shortcut.
 *
 * @tag action
 * @related Dialog
 * @related Menu
 * @related Combobox
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
export interface CommandPaletteProps {
  // ── Content ──────────────────────────────────────────────

  /** Items to display. Grouped automatically by `category`. */
  items: CommandPaletteItem[];

  /** Placeholder text for the search input. @default 'Search...' */
  placeholder?: string;

  /** Message shown when the filter returns no results. @default 'No results found.' */
  emptyText?: string;

  /** Show keyboard-shortcut hints in the footer. @default true */
  showFooter?: boolean;

  // ── Behavior ─────────────────────────────────────────────

  /** Controls visibility. Supports `bind:open`. @default false */
  open?: boolean;

  /**
   * Current search text. Supports `bind:query`. Reset to `''` whenever the
   * palette opens.
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

  // ── Snippets (custom rendering) ──────────────────────────

  /** Custom item renderer. Receives the item, whether it is highlighted, and its flat index. */
  customItem?: Snippet<[item: CommandPaletteItem, highlighted: boolean, index: number]>;

  /** Custom empty-state renderer. Receives the current query string. */
  customEmpty?: Snippet<[query: string]>;

  // ── Variants ─────────────────────────────────────────────

  /** Maximum width of the palette panel. @default 'md' */
  size?: CommandPaletteVariants['size'];

  // ── Styling ──────────────────────────────────────────────

  /** Additional CSS classes on the root wrapper. */
  class?: string;

  /** Strip all default styles, the modal Dialog's included. @default false */
  unstyled?: boolean;

  /**
   * Per-slot class overrides. An option row is built from four sources in
   * order — the library's `item` classes, the library's classes for the row's
   * state (`itemHighlighted` when selected, `itemDisabled` when the item is
   * disabled, `itemDefault` otherwise), then your `item` entry, then your entry
   * for that state slot. Each source displaces the earlier ones per Tailwind
   * bucket, so an `item` entry that collides with a state class *removes* it:
   * `slotClasses={{ item: 'bg-white' }}` also drops the selected row's
   * `bg-primary-subtle`. Write the state slot as well to keep both.
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
