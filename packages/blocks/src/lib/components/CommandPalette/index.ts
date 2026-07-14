import type { Snippet } from 'svelte';
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
  /** Group header this item belongs to. Items with the same category are grouped together. */
  category?: string;
  /** Optional keyboard shortcut displayed on the right side. */
  shortcut?: string;
  /** SVG path data for a leading icon (24x24 viewBox). */
  icon?: string;
  /** Whether the item is non-selectable. @default false */
  disabled?: boolean;
  /** Arbitrary payload forwarded to `onSelect`. */
  data?: unknown;
}

/**
 * Props for the CommandPalette component.
 *
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
   * Register a global keyboard shortcut that toggles the palette.
   * Set to `false` to disable. @default 'mod+k' (Cmd+K / Ctrl+K)
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

  /** Strip all default styles. @default false */
  unstyled?: boolean;

  /** Per-slot class overrides. */
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
