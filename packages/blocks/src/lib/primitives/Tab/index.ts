import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils';
import type { TabSlots, TabVariants } from './tab.variants';

export interface TabContext {
  registerTab: (value: string, element: HTMLElement) => () => void;
  /**
   * Called by TabPanel while its element is actually in the DOM (rendering may
   * be deferred by `lazy`). TabItem emits `aria-controls` only for a value a
   * panel has claimed — consumers may render panel content themselves outside
   * `panels`, and an `aria-controls` pointing at a missing id is an axe
   * `aria-valid-attr-value` violation. Returns an unregister function.
   */
  registerPanel: (value: string) => () => void;
  hasPanel: (value: string) => boolean;
  selectTab: (value: string) => void;
  isActive: (value: string) => boolean;
  readonly variant: TabVariants['variant'];
  readonly orientation: TabVariants['orientation'];
  readonly size: TabVariants['size'];
  readonly tier: InteractiveTier;
  /**
   * Every axis TabItem styles itself with must travel through here — the
   * trigger is where `fullWidth` becomes `flex-1`, and a variants test on
   * `tabVariants({fullWidth:true})` stays green while the prop is missing
   * from the context (the gap this field closes).
   */
  readonly fullWidth: boolean;
  readonly disabled: boolean;
  readonly mint: MintProp;
}

/**
 * Shared fields that apply to every Tab orientation.
 */
interface TabBaseProps
  extends Omit<TabVariants, 'orientation' | 'fullWidth'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Snippet containing TabItem components for the tab strip. */
  tabs?: Snippet;

  /** Snippet containing TabPanel components for the content area. */
  panels?: Snippet;

  /**
   * Controlled active tab value. Use with `bind:value` for two-way binding.
   * When set, the component is controlled — you must handle `onValueChange` to update it.
   */
  value?: string;

  /**
   * Default active tab for uncontrolled mode.
   * Ignored when `value` is set.
   */
  defaultValue?: string;

  /** Fires when the active tab changes. Receives the new tab value string. */
  onValueChange?: (value: string) => void;

  /**
   * Accessible name for the tab strip, applied to the inner `role="tablist"`
   * element — not the root wrapper, whose role-less `<div>` forbids
   * `aria-label`. Recommended whenever a page holds more than one tab strip;
   * screen readers announce tablists only by this name.
   * @summary Names the tab strip for screen readers — set it when a page has several.
   */
  'aria-label'?: string;

  /**
   * Id of a visible element that labels the tab strip. Like `aria-label`, it is
   * retargeted onto the inner `role="tablist"` element. Prefer this over
   * `aria-label` when a visible heading already names the strip.
   * @summary Points at a visible heading that names the tab strip.
   */
  'aria-labelledby'?: string;

  /** Disables all tabs, preventing interaction and dimming the UI. @default false */
  disabled?: boolean;

  /**
   * Semantic radius tier propagated to every TabItem. Default `modify` —
   * tabs read as navigation tap surfaces. Set to `commit` (or inherit via
   * TierContext from a wrapping `<Toolbar tier="commit">`) for full-pill
   * tab strips in marketing/product-overview contexts. Only the `pills`,
   * `solid`, and `enclosed` variants render a visible corner; `line` is
   * radius-agnostic.
   *
   * @default 'modify'
   * @summary Corner-radius tier, passed on to every TabItem.
   */
  tier?: InteractiveTier;

  /**
   * Micro-interaction preset applied to each tab trigger (per-item via
   * context). Only applies while the item is not disabled.
   * @default 'none'
   * @summary Decorative feedback effect on each tab trigger, not the container.
   */
  mint?: MintProp;

  /** Additional CSS class merged onto the root element. */
  class?: string;

  /** Strip all default tv() styles from the container and children. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing when unstyled) tv() styles. Slots: base | list | trigger | icon | label | badge | panel | indicator */
  slotClasses?: Partial<Record<TabSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Tab: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

/**
 * Horizontal tabs (the default). `fullWidth` stretches triggers to fill
 * the available width.
 */
interface TabPropsHorizontal extends TabBaseProps {
  /** Tab strip axis. Determines whether triggers stack horizontally or vertically. @default 'horizontal' */
  orientation?: 'horizontal';
  /** Stretch triggers to fill the available width. Only meaningful on horizontal tabs. @default false */
  fullWidth?: boolean;
}

/**
 * Vertical tabs. Triggers are always `w-full` by design — `fullWidth` is
 * forbidden at the type level because the orientation already implies it.
 */
interface TabPropsVertical extends TabBaseProps {
  /** Tab strip axis. Determines whether triggers stack horizontally or vertically. */
  orientation: 'vertical';
  fullWidth?: never;
}

/**
 * @summary Several views, one at a time, switched by their labels.
 * @description Tab container that manages tab switching and content display.
 * Supports horizontal/vertical orientation, visual variants, and keyboard navigation.
 *
 * Tab props are a discriminated union on `orientation`. `fullWidth` is
 * only available on horizontal tabs — combining it with `orientation="vertical"`
 * fails type-check, since vertical triggers are already full-width by design.
 *
 * @tag navigation
 * @related Stepper
 *
 * @example
 * ```svelte
 * <Tab bind:value={activeTab}>
 *   {#snippet tabs()}
 *     <TabItem value="overview">Overview</TabItem>
 *     <TabItem value="settings">Settings</TabItem>
 *     <TabItem value="billing">Billing</TabItem>
 *   {/snippet}
 *   {#snippet panels()}
 *     <TabPanel value="overview">Overview content</TabPanel>
 *     <TabPanel value="settings">Settings content</TabPanel>
 *     <TabPanel value="billing">Billing content</TabPanel>
 *   {/snippet}
 * </Tab>
 * ```
 *
 * @example
 * ```svelte
 * <Tab variant="line" size="sm" defaultValue="code">
 *   {#snippet tabs()}
 *     <TabItem value="code">Code</TabItem>
 *     <TabItem value="preview">Preview</TabItem>
 *   {/snippet}
 *   {#snippet panels()}
 *     <TabPanel value="code">Tab panel content</TabPanel>
 *     <TabPanel value="preview">Rendered output</TabPanel>
 *   {/snippet}
 * </Tab>
 * ```
 */
export type TabProps = TabPropsHorizontal | TabPropsVertical;

/**
 * @description Individual tab trigger button inside a Tab component.
 * Supports leading icons, trailing badges, and per-item disabled state.
 *
 * @tag navigation
 * @related Tab
 * @related TabPanel
 */
export interface TabItemProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Unique identifier that links this trigger to its TabPanel. */
  value: string;

  /** Label content rendered inside the tab button. */
  children: Snippet;

  /** Disable only this tab while others remain interactive. @default false */
  disabled?: boolean;

  /** Leading icon snippet rendered before the label. */
  icon?: Snippet;

  /** Trailing badge snippet rendered after the label. */
  badge?: Snippet;

  /** Additional CSS class merged onto the button element. */
  class?: string;

  /** Strip default tv() styles from this trigger. */
  unstyled?: boolean;

  /** Per-slot class overrides for the trigger. Slots (subset of Tab's): trigger | icon | label | badge */
  slotClasses?: Partial<Record<Extract<TabSlots, 'trigger' | 'icon' | 'label' | 'badge'>, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ TabItem: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

/**
 * @description Content panel displayed when its matching TabItem is active.
 * Supports lazy rendering, keep-mounted behaviour, and fade transitions.
 *
 * @tag layout
 * @related Tab
 * @related TabItem
 */
export interface TabPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Value that links this panel to its TabItem. Must match a TabItem's `value`. */
  value: string;

  /** Panel content rendered when the tab is active. */
  children: Snippet;

  /** Only render content after the tab is activated for the first time. @default false */
  lazy?: boolean;

  /** Keep DOM mounted when inactive. Preserves internal state across tab switches. @default false */
  keepMounted?: boolean;

  /** Animate panel entrance with a fade transition. @default true */
  transition?: boolean;

  /** Additional CSS class merged onto the panel element. */
  class?: string;

  /** Strip default tv() styles from this panel. */
  unstyled?: boolean;

  /** Per-slot class overrides for the panel. Slot (subset of Tab's): panel */
  slotClasses?: Partial<Record<Extract<TabSlots, 'panel'>, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ TabPanel: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Tab } from './Tab.svelte';
export { default as TabItem } from './TabItem.svelte';
export { default as TabPanel } from './TabPanel.svelte';
export { type TabVariants, tabVariants } from './tab.variants';
