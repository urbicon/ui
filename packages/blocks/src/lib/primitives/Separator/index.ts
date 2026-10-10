import type { HTMLAttributes } from 'svelte/elements';
import type { SeparatorVariants } from './separator.variants';

/**
 * @summary A line marking where one thing ends and the next begins.
 * @description Visual divider for separating content sections. Supports horizontal and
 * vertical orientations with proper ARIA semantics.
 *
 * @tag layout
 *
 * @example
 * ```svelte
 * <Separator />
 * ```
 *
 * @example
 * ```svelte
 * <div class="flex items-center gap-4">
 *   <span>Item A</span>
 *   <Separator orientation="vertical" size="sm" />
 *   <span>Item B</span>
 * </div>
 * ```
 */
export interface SeparatorProps
  extends SeparatorVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** Horizontal renders a full-width line; vertical renders a full-height line (e.g. inside flex rows). */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Stroke thickness: `sm` and `md` draw a 1 px line, `lg` a 2 px one. The separator
   * carries no margin — the space around it comes from the surrounding layout (`gap`,
   * `space-y-*`).
   * @default 'md'
   * @summary Line thickness — 1 px for sm and md, 2 px for lg. Spacing comes from the layout.
   */
  size?: 'sm' | 'md' | 'lg';
  /** When true, the separator is purely visual (role="none"); when false, it uses role="separator" with aria-orientation. */
  decorative?: boolean;
  /** Additional CSS class merged onto the root element. */
  class?: string;
  /** Strip all default styles; combine with slotClasses to rebuild from scratch. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<'base', string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Separator: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Separator } from './Separator.svelte';
export { type SeparatorVariants, separatorVariants } from './separator.variants';
