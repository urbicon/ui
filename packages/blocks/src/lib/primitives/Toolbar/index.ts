import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { InteractiveTier } from '$lib/utils';
import type { ToolbarSlots, ToolbarVariants } from './toolbar.variants';

/**
 * Props interface for Toolbar component
 *
 * @summary A bar of controls that belong together.
 * @description Container for grouping related controls in a horizontal or vertical bar.
 * Renders with role="toolbar" and auto-sets aria-orientation.
 *
 * @tag action
 * @related Button
 * @related ButtonGroup
 *
 * @example
 * ```svelte
 * <Toolbar aria-label="Text formatting">
 *   <Button variant="ghost" size="sm">B</Button>
 *   <Button variant="ghost" size="sm">I</Button>
 *   <Separator orientation="vertical" size="sm" />
 *   <Button variant="ghost" size="sm">Left</Button>
 *   <Button variant="ghost" size="sm">Center</Button>
 * </Toolbar>
 * ```
 *
 * @example
 * ```svelte
 * <Toolbar aria-label="Actions" orientation="horizontal">
 *   <ButtonGroup connected size="sm" variant="ghost">
 *     <Button value="undo">Undo</Button>
 *     <Button value="redo">Redo</Button>
 *   </ButtonGroup>
 *   <Separator orientation="vertical" />
 *   <Button variant="ghost" size="sm" intent="danger">Delete</Button>
 * </Toolbar>
 * ```
 */
export interface ToolbarProps
  extends ToolbarVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Toolbar content — typically Buttons, Toggles, Separators, or ButtonGroups. */
  children: Snippet;

  /** Accessible label describing the toolbar's purpose (e.g. "Formatting toolbar"). Required. */
  'aria-label': string;

  /**
   * Semantic radius tier propagated to tier-aware children (Buttons,
   * Badges, Inputs, …). The Toolbar's own surface stays `r-structure`
   * regardless of this prop.
   *
   * Default `modify` — toolbars typically hold compact, icon-only actions
   * where pill-shaped buttons read as tags. Set to `commit` for marketing
   * or hero toolbars with full CTAs.
   *
   * @default 'modify'
   * @summary Corner-radius tier, passed on to tier-aware children.
   */
  tier?: InteractiveTier;

  /** Remove all default tv() classes. Combine with `slotClasses` to restyle from scratch. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing when `unstyled`) the default classes.
   *  Slots: base */
  slotClasses?: Partial<Record<ToolbarSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Toolbar: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Additional CSS class applied to the root element. */
  class?: string;
}

export { default as Toolbar } from './Toolbar.svelte';
export { type ToolbarVariants, toolbarVariants } from './toolbar.variants';
