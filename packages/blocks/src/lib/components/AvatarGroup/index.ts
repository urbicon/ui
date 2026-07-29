import type { HTMLAttributes } from 'svelte/elements';
import type { AvatarProps } from '$lib/primitives/Avatar';
import type { AvatarGroupSlots, AvatarGroupVariants } from './avatar-group.variants';

/**
 * @summary An overlapping row of avatars with a +N chip — who is on this, at a glance.
 * @description Stacks avatars into an overlapping row with an optional "+N" overflow chip —
 * the canonical way to show a set of collaborators, assignees or participants compactly.
 * Data-driven: pass an `items` array of Avatar props; the group propagates a shared `size`
 * and a cut-out ring so the stack reads cleanly on any surface.
 *
 * @tag display
 * @related Avatar
 * @stability beta
 *
 * @example
 * ```svelte
 * <AvatarGroup items={[{ name: 'Ada Lovelace' }, { name: 'Alan Turing' }]} />
 * ```
 *
 * @example
 * ```svelte
 * <AvatarGroup items={team} max={4} size="lg" />
 * ```
 */
export interface AvatarGroupProps
  extends AvatarGroupVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** The avatars to stack. Each entry is a full set of Avatar props (src, name, status, …). */
  items: AvatarProps[];
  /** Shared size applied to every avatar and the overflow chip — xs, sm, md (default), lg, xl, 2xl. */
  size?: AvatarProps['size'];
  /**
   * Maximum avatars to render. When `items` exceeds it, `max - 1` avatars are shown plus a
   * single "+N" overflow chip — where N is the count of hidden avatars — so the total rendered
   * count is exactly `max`. Unset (or `0`/negative) shows every avatar with no chip; use `≥ 2`
   * so the chip sits alongside at least one visible face.
   * @summary How many avatars to show before the rest become a +N chip.
   */
  max?: number;
  /** Overlap amount between avatars — tight, normal (default), loose. */
  spacing?: 'tight' | 'normal' | 'loose';
  /**
   * Ring colour drawn around each avatar so the overlap reads as a cut-out. Any CSS colour;
   * defaults to the base surface so the stack looks punched out of the page.
   * @default 'var(--color-surface-base)'
   */
  borderColor?: string;
  /** Additional CSS class merged onto the root row. */
  class?: string;
  /** Strip all default styles; combine with slotClasses to rebuild from scratch. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | overflow */
  slotClasses?: Partial<Record<AvatarGroupSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ AvatarGroup: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the semantic palette.
   */
  preset?: string;
}

export { default as AvatarGroup } from './AvatarGroup.svelte';
export { type AvatarGroupVariants, avatarGroupVariants } from './avatar-group.variants';
