import type { HTMLAttributes } from 'svelte/elements';
import type { SkeletonSlots, SkeletonVariants } from './skeleton.variants';

/**
 * @summary The shape of what is loading, so nothing jumps when it arrives.
 * @description Placeholder loading animation that mimics content layout.
 * Use to reduce perceived loading time and prevent layout shift.
 *
 * @tag feedback
 * @related Spinner
 * @related Progress
 *
 * @example
 * ```svelte
 * <Skeleton variant="text" size="lg" />
 * <Skeleton variant="circular" size="md" />
 * <Skeleton variant="rectangular" width="100%" height="200px" />
 * ```
 *
 * @example
 * ```svelte
 * <div class="flex items-center gap-3">
 *   <Skeleton variant="circular" size="md" />
 *   <div class="flex flex-col gap-2 flex-1">
 *     <Skeleton variant="text" size="sm" />
 *     <Skeleton variant="text" size="xs" class="w-2/3" />
 *   </div>
 * </div>
 * ```
 */
export interface SkeletonProps extends SkeletonVariants, HTMLAttributes<HTMLDivElement> {
  /** Shape preset. `text` is a slim bar, `circular` for avatars/icons,
   *  `rectangular` for images/cards, `rounded` like rectangular with softer corners.
   *  @summary Shape of the placeholder: a text bar, a circle, a rectangle or a rounded one. */
  variant?: SkeletonVariants['variant'];

  /** Physical dimensions following the Standard size scale (xs–xl).
   *  Dimensions vary per variant — text heights range from h-3 (xs) to h-6 (xl),
   *  circular from 24 px to 64 px.
   *  @summary Size step of the placeholder; what it measures depends on the shape. */
  size?: SkeletonVariants['size'];

  /** Animation style. `pulse` fades opacity, `wave` sweeps a shimmer gradient,
   *  `none` renders a static placeholder. All animations respect `prefers-reduced-motion`.
   *  @summary How the placeholder animates while waiting — a fade, a shimmer, or not at all. */
  animation?: SkeletonVariants['animation'];

  /** Custom width (CSS value, e.g. `"200px"` or `"100%"`). Overrides the size preset width. */
  width?: string;

  /** Custom height (CSS value, e.g. `"48px"`). Overrides the size preset height. */
  height?: string;

  /** Number of skeleton lines to render. Wraps items in a flex-column container when > 1. */
  count?: number;

  /** Tailwind gap class between repeated lines (e.g. `"gap-2"`, `"gap-4"`). Only applies when `count > 1`. */
  gap?: string;

  /** Extra classes merged onto the root element (or wrapper when `count > 1`). */
  class?: string;

  /** Strip all default tv() classes. Combine with `slotClasses` for full control. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing, when `unstyled`) tv() output. Slots: base | wrapper */
  slotClasses?: Partial<Record<SkeletonSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Skeleton: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Skeleton } from './Skeleton.svelte';
export { type SkeletonVariants, skeletonVariants } from './skeleton.variants';
