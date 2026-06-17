import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils';
import type { TabVariants } from './tab.variants';

export interface TabContext {
  registerTab: (value: string, element: HTMLElement) => () => void;
  selectTab: (value: string) => void;
  isActive: (value: string) => boolean;
  readonly variant: TabVariants['variant'];
  readonly orientation: TabVariants['orientation'];
  readonly size: TabVariants['size'];
  readonly tier: InteractiveTier;
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
   */
  tier?: InteractiveTier;

  /** Micro-interaction animation applied to each tab trigger (per-item, not the container). @default 'none' */
  mint?: MintProp;

  /** Additional CSS class merged onto the root element. */
  class?: string;

  /** Strip all default tv() styles from the container and children. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing when unstyled) tv() styles. */
  slotClasses?: Partial<Record<'base' | 'list' | 'trigger' | 'panel' | 'indicator', string>>;
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
 * @description Tab container that manages tab switching and content display.
 * Supports horizontal/vertical orientation, visual variants, and keyboard navigation.
 *
 * @tag navigation
 * @related Stepper
 *
 * Tab props are a discriminated union on `orientation`. `fullWidth` is
 * only available on horizontal tabs — combining it with `orientation="vertical"`
 * fails type-check, since vertical triggers are already full-width by design.
 *
 * @example
 * ```svelte
 * <Tab
 *   tabs={[
 *     { value: 'overview', label: 'Overview' },
 *     { value: 'settings', label: 'Settings' },
 *     { value: 'billing', label: 'Billing' }
 *   ]}
 *   bind:value={activeTab}
 * >
 *   {#snippet panels()}
 *     {#if activeTab === 'overview'}<p>Overview content</p>{/if}
 *     {#if activeTab === 'settings'}<p>Settings content</p>{/if}
 *     {#if activeTab === 'billing'}<p>Billing content</p>{/if}
 *   {/snippet}
 * </Tab>
 * ```
 *
 * @example
 * ```svelte
 * <Tab
 *   tabs={[
 *     { value: 'code', label: 'Code' },
 *     { value: 'preview', label: 'Preview' }
 *   ]}
 *   variant="underline"
 *   size="sm"
 *   defaultValue="code"
 * >
 *   {#snippet panels()}
 *     <div>Tab panel content</div>
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

  /** Per-slot class overrides for the trigger. */
  slotClasses?: Partial<Record<'trigger', string>>;
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

  /** Per-slot class overrides for the panel. */
  slotClasses?: Partial<Record<'panel', string>>;
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
