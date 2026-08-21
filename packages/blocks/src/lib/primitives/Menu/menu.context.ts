import { createContext } from 'svelte';
import { createOptionalContext } from '$lib/utils/optional-context';
import type { ButtonVariants } from '../Button/button.variants';
import type { MenuSlots, MenuVariants } from './menu.variants';

/**
 * Registration entry for a declarative MenuItem.
 * Used internally to support sub-menu nesting bookkeeping.
 */
export type MenuRegistryItem = {
  id: string;
  label?: string;
  disabled?: boolean;
  parentId?: string | null;
};

export type MenuContext = {
  /** Stable root id used to derive per-item DOM ids. */
  rootId: string;
  size: MenuVariants['itemSize'];
  intent: ButtonVariants['intent'];
  mint: import('$lib/mint').MintProp | undefined;
  disabled: boolean;
  unstyled?: boolean;
  // Keyed by the tv() config's own slot names so a new slot (e.g. `detail`)
  // cannot silently miss the context — the hand-copied union this replaced
  // could drift from menu.variants.ts without any error.
  slotClasses?: Partial<Record<MenuSlots, string>>;
  styles: ReturnType<typeof import('./menu.variants').menuVariants>;

  /**
   * Called by an item after its `onSelect` callback has fired. Closes the
   * menu and restores focus to the trigger unless `keepOpen` is true.
   *
   * The item's own `onSelect` callback is invoked by the item itself —
   * the context does not re-dispatch it. This avoids the double-dispatch
   * trap that an items-lookup pattern is prone to.
   */
  onItemActivated: (keepOpen?: boolean) => void;

  /** Move focus to the next / previous focusable menu item (roving tabindex). */
  focusNextItem: (current: HTMLElement) => void;
  focusPrevItem: (current: HTMLElement) => void;
  focusFirstItem: () => void;
  focusLastItem: () => void;

  isSubMenuOpen: (id: string) => boolean;
  toggleSubMenu: (id: string) => void;

  registerItem: (item: MenuRegistryItem) => void;
  unregisterItem: (id: string) => void;
  itemSizeForDepth: (depth: number) => 'sm' | 'md' | 'lg';
};

const [getMenuContext, setMenuContext] = createContext<MenuContext>();

export { getMenuContext, setMenuContext };

// MenuParentId is *optional* — only MenuSubmenu sets it. Top-level
// MenuItems read it to determine nesting depth and parent for the
// registry. Using `createContext` (which throws `missing_context` when no
// provider is found) would crash every top-level MenuItem; use the
// optional variant so the getter returns `undefined` instead.
const [getMenuParentId, setMenuParentId] = createOptionalContext<string | null>();

export { getMenuParentId, setMenuParentId };
