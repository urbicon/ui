import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { ButtonVariants, MenuVariants } from '$lib/primitives';
import type { AnimationProps } from '$lib/utils';
import type { Placement } from '$lib/utils/floating';
import type { InteractiveTier } from '$lib/utils/tier-context';
import type { MenuSlots } from './menu.variants';

/**
 * Menu-specific props. The catalog JSDoc (`@description`/`@tag`/`@related`)
 * lives on `MenuProps` below — the interface docs-gen actually picks up —
 * so it is not duplicated here.
 *
 * @example Items array with `onSelect` callbacks
 * ```svelte
 * <Menu placeholder="Actions" items={[
 *   { label: 'Edit', onSelect: () => edit() },
 *   { label: 'Duplicate', onSelect: () => duplicate() },
 *   { type: 'section', label: 'Danger' },
 *   { label: 'Delete', onSelect: () => confirmDelete() }
 * ]} />
 * ```
 *
 * @example Declarative children with MenuItem — a section wraps the items it names
 * ```svelte
 * <Menu placeholder="More">
 *   <MenuSection label="Edit">
 *     <MenuItem onSelect={() => rename()}>Rename</MenuItem>
 *     <MenuItem onSelect={() => duplicate()}>Duplicate</MenuItem>
 *   </MenuSection>
 *   <MenuDivider />
 *   <MenuItem onSelect={() => confirmDelete()}>Delete</MenuItem>
 * </Menu>
 * ```
 *
 * @example Selectable settings — `checked` renders `menuitemradio` rows, `detail` shows the current value
 * ```svelte
 * <Menu placeholder="View" items={[
 *   {
 *     label: 'Sort by',
 *     detail: sortBy,
 *     children: [
 *       { label: 'Name', checked: sortBy === 'Name', onSelect: () => (sortBy = 'Name') },
 *       { label: 'Date', checked: sortBy === 'Date', onSelect: () => (sortBy = 'Date') }
 *     ]
 *   },
 *   { label: 'Refresh', onSelect: () => refresh() }
 * ]} />
 * ```
 *
 * @example Icon-only trigger via customTrigger
 * ```svelte
 * <Menu items={actionItems}>
 *   {#snippet customTrigger(toggle, open)}
 *     <Button
 *       variant="ghost"
 *       aria-label="Actions"
 *       aria-haspopup="menu"
 *       aria-expanded={open}
 *       onclick={toggle}
 *     >
 *       <MoreHorizontalIcon />
 *     </Button>
 *   {/snippet}
 * </Menu>
 * ```
 */
export interface MenuSpecificProps<TItem extends MenuItemType = MenuItemType> {
  /** Array of menu items. Each item's `onSelect` runs when activated. */
  items?: TItem[];

  /**
   * Declarative children mode — use `<MenuItem>` / `<MenuDivider>` /
   * `<MenuSection>`. A `<MenuSection>` wraps the items it names, the same way
   * a `{ type: 'section' }` entry owns the items that follow it.
   */
  children?: Snippet;

  /**
   * Remove the default variant classes, the default trigger Button's included.
   * Only user-supplied classes apply.
   * @default false
   */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with the variant styles.
   * Slots: base | trigger | triggerText | chevron | content | header | section |
   * group | divider | items | item | indicator | detail | submenu | footer
   */
  slotClasses?: Partial<Record<MenuSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Menu: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /**
   * Placeholder text shown on the default trigger. Acts as the trigger's
   * accessible name unless `aria-label` is supplied. Typical values: "Actions",
   * "More", "Options". Ignored when `customTrigger` is provided.
   * @summary Text on the default trigger, which doubles as its accessible name.
   */
  placeholder?: string;

  /** Optional mapping functions for custom item shapes. */
  getItemLabel?: (item: TItem) => string;
  getItemId?: (item: TItem) => string;
  getItemDisabled?: (item: TItem) => boolean;
  getItemChildren?: (item: TItem) => TItem[] | undefined;
  /** Optional icon resolver for items in array mode. */
  getItemIcon?: (item: TItem) => unknown;
  /** Optional per-item class resolver for items in array mode. */
  getItemClass?: (item: TItem) => string | undefined;
  /** Optional checked-state resolver for items in array mode (`undefined` = plain action item). */
  getItemChecked?: (item: TItem) => boolean | undefined;
  /** Optional right-aligned detail-text resolver for items in array mode. */
  getItemDetail?: (item: TItem) => string | undefined;
  /** Section detection override. Applies to full union, not just TItem. */
  isSection?: (item: MenuItemType) => boolean;
  /**
   * Divider detection override, symmetric to `isSection`. Supply it when your
   * own item shape carries a `type: 'divider'` field of its own meaning — the
   * built-in check is structural, and without this mapper such a row would
   * render as a rule and lose its `onSelect`.
   *
   * This mapper and `isSection` *replace* the built-in check rather than
   * narrowing it, so the escape is all-or-nothing: `isDivider={() => false}`
   * also switches off genuine `{ type: 'divider' }` entries, which render as
   * plain rows again — express those in your own shape instead.
   * @summary Divider detection override, for item shapes with their own `type` field.
   */
  isDivider?: (item: MenuItemType) => boolean;
  /** Section label override. Accepts concrete section header type. */
  getSectionLabel?: (item: MenuSectionHeader) => string;

  /**
   * Where the menu panel appears relative to the trigger. Uses floating-ui
   * placement. @default 'bottom-start'
   */
  placement?: Placement;

  /**
   * Syncs the width of the menu panel with the trigger element.
   * @default true
   */
  syncWidth?: boolean;

  /**
   * Render menu content in a portal for better positioning.
   * Prevents menu from being clipped by overflow containers.
   * @default true
   */
  usePortal?: boolean;

  /**
   * Controls the open state of the menu. Supports `bind:open`.
   * @default false
   */
  open?: boolean;

  /**
   * Fires when the menu opens or closes from user interaction (trigger
   * click, item activation, Escape, Tab-out, outside click). Receives the
   * new open state. Not called when the consumer writes `bind:open` directly.
   */
  onOpenChange?: (open: boolean) => void;

  /**
   * Button variant applied to the default trigger button.
   * @default 'outlined'
   */
  variant?: ButtonVariants['variant'];

  /**
   * Button size applied to the default trigger button.
   * @default 'md'
   */
  size?: ButtonVariants['size'];

  /**
   * Size of the menu list items, independent from the trigger size.
   * When not set, item size is derived from the trigger `size` prop.
   * @default undefined
   */
  itemSize?: 'sm' | 'md' | 'lg';

  /**
   * Button intent applied to the default trigger button.
   * @default 'neutral'
   */
  intent?: ButtonVariants['intent'];

  /**
   * Semantic radius tier applied to the default trigger button. Menu is an
   * Action surface, so the default is `commit` (pill) to match the Action
   * family — consistent with `<Button>`. Set to `'modify'` when the trigger
   * lives inside a Toolbar/ButtonGroup that propagates a different tier.
   * @default 'commit'
   */
  tier?: InteractiveTier;

  /**
   * Whether the default trigger button is in loading state.
   * @default false
   */
  loading?: boolean;

  /**
   * Whether the menu is disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * Micro-interaction preset forwarded to the inner default trigger Button
   * and applied to each menu item row (per-item via context). Only applies
   * while not disabled.
   * @default 'none'
   * @summary Decorative feedback effect on the trigger and every item row.
   */
  mint?: MintProp;
}

/**
 * @summary A list of things you can do, hung off a button.
 * @description Action menu (`role="menu"`) triggered by a button, with nested
 * submenus, sections, icons, and separators. Items are verbs the user can
 * invoke — Edit, Delete, Share, Export — and dispatch an `onSelect` callback
 * when activated. An item given `checked` additionally *shows* a setting:
 * it renders as `role="menuitemradio"` with the supplied state announced and
 * marked. Menu still owns no selection state — the consumer computes `checked`
 * and updates it from `onSelect`. For committing a value to a form use
 * `Select` (or `Combobox` for searchable). Menu and Select stay deliberately
 * disjoint: Menu's `role="menu"`/`menuitem` semantics with arrow-key roving
 * and Action-family chrome versus Select's `role="listbox"` value commitment
 * with Form-family chrome.
 *
 * @tag action
 * @related Select
 * @related Combobox
 * @related Popover
 */
export interface MenuProps<TItem extends MenuItemType = MenuItemType>
  extends MenuVariants,
    Omit<MenuSpecificProps<TItem>, keyof MenuVariants>,
    MenuCustomSlots<TItem>,
    AnimationProps,
    // `placeholder` is omitted from HTMLAttributes — it's redefined by
    // MenuSpecificProps as the trigger's placeholder text, which is the
    // Menu-meaningful semantic. The HTMLAttributes one is the global HTML
    // attribute (rarely used on a div) and would clash type-wise.
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'placeholder'> {
  class?: string;
  id?: string;
}

// Item types

/**
 * Shorthand item form: the string is the label and serves as the item's
 * stable id (for sub-menu bookkeeping). Use `MenuObjectOption` to attach
 * an `onSelect` callback or other rich item state.
 */
export type MenuOption = string;

/**
 * Section header item for grouping related menu options. Renders the header
 * plus a `role="group"` around the items that follow it, up to the next header.
 */
export interface MenuSectionHeader {
  type: 'section';
  label: string;
  disabled?: true;
}

/**
 * Rule between two runs of items — the `items`-array equivalent of
 * `<MenuDivider />`, which the array shape previously had no way to express
 * (a `{ type: 'divider' }` entry rendered as a nameless `role="menuitem"`).
 * Renders where it is written, inside the section it falls in.
 */
export interface MenuDividerItem {
  type: 'divider';
}

/**
 * Menu item with explicit label, action callback, and optional nested
 * children. Menu items are *verbs* — the `id` is only an internal stable
 * identifier for sub-menu bookkeeping and DOM `id` derivation, not a
 * selectable value. An item given `checked` additionally *shows* a setting
 * (`role="menuitemradio"`), but the state stays consumer-owned: Menu displays
 * it and never stores a selection. (For committing a value to a form use
 * `Select`.)
 */
export interface MenuObjectOption {
  /** Display text for the action. */
  label: string;

  /**
   * Stable identifier for sub-menu nesting and DOM id derivation. Optional:
   * when omitted, the rendered position is used as a fallback key. Provide
   * a stable id when items can reorder or when you need to address an item
   * from tests / e2e selectors.
   */
  id?: string;

  /**
   * Whether the action is disabled.
   * @default false
   */
  disabled?: boolean;

  /** Optional leading icon component. */
  icon?: unknown;

  /**
   * Extra classes merged onto this item's row, after `slotClasses.item`.
   * For per-item state looks — an active-filter tint, a destructive red —
   * that `slotClasses.item`, which styles every row alike, cannot express.
   */
  class?: string;

  /**
   * Marks the item as a selectable setting. `true` / `false` renders the row
   * as `role="menuitemradio"` with `aria-checked` and a checkmark indicator
   * (an empty gutter when unchecked, so rows stay aligned); leave `undefined`
   * for a plain action item (`role="menuitem"`, exactly as before). Menu only
   * displays this state — compute it from your own source of truth and update
   * that source in `onSelect`. Put a radio set inside a `type: 'section'`
   * group or a submenu: the section wraps its items in `role="group"` labelled
   * by the header, and a submenu panel is its own `role="menu"` — either gives
   * assistive tech the set boundary ARIA expects for `menuitemradio`. Ignored
   * on items with `children` (the parent row is a disclosure, not a radio) —
   * use `detail` to show the submenu's current value there.
   */
  checked?: boolean;

  /**
   * Right-aligned secondary text on the row. Typical use: the current value
   * of the sub-menu this item opens ("Average"), or a shortcut hint.
   */
  detail?: string;

  /**
   * Action invoked when the user activates this item (click or Enter / Space).
   * The Menu closes after `onSelect` runs unless `keepOpen` is set.
   */
  onSelect?: () => void;

  /**
   * Keep the menu open after this item is activated. Useful for repeated
   * actions (e.g. "Add tag") where the user typically picks several in a row.
   * @default false
   */
  keepOpen?: boolean;

  /** Nested child options for hierarchical menus. */
  children?: MenuItemType[];
}

/**
 * Union of all supported menu item shapes.
 *
 * - string: simple item label (value equals label)
 * - MenuObjectOption: rich item with label/onSelect and optional children
 * - MenuSectionHeader: non-selectable header grouping the following items
 * - MenuDividerItem: a rule between two runs of items
 */
export type MenuItemType = MenuOption | MenuObjectOption | MenuSectionHeader | MenuDividerItem;

export interface MenuCustomSlots<TItem extends MenuItemType = MenuItemType> {
  /**
   * Replace the default trigger button (chevron + label) with a custom element.
   * Positional args: `(toggle, open, dismiss)`.
   *
   * - `toggle`: flips the open state — wire this to your custom trigger's
   *   click handler so the menu can be opened from the consumer's element.
   * - `open`: current open state — useful for `aria-expanded`.
   * - `dismiss`: closes the menu without changing toggle history; rarely
   *   needed but provided for symmetry.
   *
   * The consumer's element should bind its `onclick` to `toggle` and set
   * `aria-expanded={open}` + `aria-haspopup="menu"` for ARIA correctness.
   */
  customTrigger?: Snippet<[() => void, boolean, () => void]>;

  /**
   * Turn the menu into a **context menu**: instead of a trigger button, the
   * snippet you pass becomes a right-click target. A `contextmenu` (right-click
   * or long-press) on it opens the menu at the cursor position — the native
   * browser context menu is suppressed. Keyboard navigation, dismissal and
   * item selection behave exactly as in the dropdown menu; on dismiss, focus
   * returns to wherever it was. Mutually exclusive with `customTrigger`/the
   * default trigger button (when set, no trigger button renders).
   *
   * @example
   * ```svelte
   * <Menu {items} contextTrigger>
   *   {#snippet contextTrigger()}
   *     <div class="rounded-modify border border-border-subtle p-8">Right-click me</div>
   *   {/snippet}
   * </Menu>
   * ```
   */
  contextTrigger?: Snippet;

  /**
   * Custom per-item content. **Render visible content only** — the outer
   * `role="menuitem"` button is provided by Menu and handles the click /
   * keyboard activation. Putting an interactive element (`<button>`, `<a>`)
   * inside the snippet creates nested-interactive HTML and triggers the
   * item's action twice via event bubbling.
   *
   * Positional arg: `(item)`. To dispatch from outside the normal click
   * (e.g. a "Recent" entry that needs to activate from a parent shortcut),
   * call the item's own `onSelect` directly.
   */
  customItem?: Snippet<[TItem]>;

  /**
   * Optional custom header rendered above the items list.
   */
  customHeader?: Snippet;

  /**
   * Optional custom footer rendered below the items list.
   */
  customFooter?: Snippet;
}

export { default as Menu } from './Menu.svelte';
export { default as MenuDivider } from './MenuDivider.svelte';
export { default as MenuItem } from './MenuItem.svelte';
export { default as MenuSection } from './MenuSection.svelte';
export { default as MenuSubmenu } from './MenuSubmenu.svelte';
// Re-export context types for advanced usage
export type { MenuContext, MenuRegistryItem } from './menu.context';
export {
  type MenuIconVariants,
  type MenuVariants,
  menuIconVariants,
  menuVariants
} from './menu.variants';
