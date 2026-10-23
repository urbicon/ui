import type { Component, Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { IconProps } from '#lib/icons/index.js';
import type { EmptyStateSlots } from './emptyState.variants';

/**
 * @summary What to show when there is nothing yet — and what to do about it.
 * @description Centered placeholder block for "no data yet" / "no results"
 * states. Pairs an optional icon with a heading, supporting text, and an
 * optional call-to-action slot.
 *
 * @tag layout
 * @tag feedback
 *
 * @example
 * ```svelte
 * <EmptyState
 *   icon={BuildingIcon}
 *   title="No apartments yet"
 *   description="Get started by adding the first apartment to the system."
 * >
 *   {#snippet cta()}
 *     <Button intent="primary" onclick={openCreate}>Add apartment</Button>
 *   {/snippet}
 * </EmptyState>
 * ```
 */
export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  /**
   * Icon component rendered above the title. Pass any icon from
   * `@urbicon-ui/blocks` (or a compatible stroke icon). Its round container is
   * filled `bg-surface-subtle text-text-tertiary` — an empty state is not the
   * call to action, `cta` is. That fill reads as a faint wash on the page
   * ground and as nothing at all inside an elevated container (Card, Popover),
   * where `surface-subtle` and `surface-elevated` resolve to the same colour.
   * For a fill that always reads, or for the accent back, pass
   * `slotClasses={{ iconWrapper: 'bg-primary-subtle text-primary-text' }}`.
   */
  icon?: Component<IconProps>;

  /** Heading line. */
  title: string;

  /**
   * Heading level of the title, clamped to 1..6. `h3` fits an empty state
   * inside a titled section or card; pass the rank that continues the
   * embedding page's outline — `2` directly under the page's `h1`. The title
   * is styled by class, not by tag, so the level changes none of the component's own styling.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;

  /** Supporting paragraph below the title. */
  description?: string;

  /** Action buttons rendered below the description. */
  cta?: Snippet;

  /** Optional richer content rendered below the description. */
  children?: Snippet;

  /**
   * Visual density. `compact` is suitable for inline empty rows in tables
   * or cards; `default` for full-page empty states.
   * @default 'default'
   */
  density?: 'compact' | 'default';

  /** Extra classes merged onto the wrapper. */
  class?: string;

  /** Remove all default tv classes. */
  unstyled?: boolean;

  /** Per-slot class overrides. Slots: base | iconWrapper | title | description | children | cta */
  slotClasses?: Partial<Record<EmptyStateSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ EmptyState: {...} }}>`.
   * Prefer this over `class` overrides when the same look should be reused
   * across the project.
   */
  preset?: string;
}

export { default as EmptyState } from './EmptyState.svelte';
export { type EmptyStateVariants, emptyStateVariants } from './emptyState.variants';
