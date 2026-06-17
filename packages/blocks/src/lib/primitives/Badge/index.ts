import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { BadgePlacement, BadgeVariants } from './badge.variants';

/**
 * Shared fields that apply to every Badge variant — `dot` and the
 * label-style variants both accept these.
 */
interface BadgeBaseProps
  extends Omit<BadgeVariants, 'variant'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Add a pulsing animation to draw attention (e.g. for live indicators). */
  pulse?: boolean;
  /** Visually disable the badge (reduced opacity, no pointer events). */
  disabled?: boolean;
  /** Add a ring outline in the page background color — useful to visually separate overlapping or positioned badges from their parent. */
  border?: boolean;
  /** Anchor the badge absolutely within a `position: relative` parent. */
  placement?: BadgePlacement;

  /** Click handler. Automatically enables interactive styles. */
  onclick?: (event: MouseEvent) => void;
  /** Called when the hover state changes. */
  onHover?: (hovered: boolean) => void;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv styles. */
  slotClasses?: Partial<Record<'base' | 'content' | 'removeButton' | 'removeIcon', string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Badge: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** ARIA role. Defaults to `"status"`. Use `"alert"` for time-sensitive notifications. */
  role?: 'status' | 'alert' | 'badge';
  /** Micro-interaction preset. Only applies when the badge is interactive. */
  mint?: MintProp;
}

/**
 * Dot-style badge — a pure indicator. Content is `sr-only` (visually
 * hidden), so `children` / `counter` / `removable` / `interactive` /
 * `onRemove` are excluded by the type: an invisible remove-button or
 * hover-scale on a 2.5 × 2.5 px dot is never the intended UI.
 */
interface BadgeDotProps extends BadgeBaseProps {
  /** Visual variant. `dot` renders a pure indicator (content hidden); the label variants accept the full surface. */
  variant: 'dot';
  children?: never;
  counter?: never;
  removable?: never;
  interactive?: never;
  onRemove?: never;
}

/**
 * Label-style badge — accepts content, counter shape, remove button, etc.
 */
interface BadgeStandardProps extends BadgeBaseProps {
  /** Visual variant. `dot` renders a pure indicator (content hidden); the label variants accept the full surface. @default 'filled' */
  variant?: 'filled' | 'outlined' | 'soft';
  /** Badge content (text, icons, numbers). */
  children?: Snippet;
  /** Display as a compact pill for numeric counts. Tightens padding and uses tabular-nums so digits align. */
  counter?: boolean;
  /** Show a remove (×) button. */
  removable?: boolean;
  /** Enable hover/focus styles and keyboard activation. Automatically enabled when `onclick` is provided. */
  interactive?: boolean;
  /** Fired when the remove button is clicked (only when `removable` is true). */
  onRemove?: () => void;
}

/**
 * @description Compact label for status, categories, counters, and notifications.
 *
 * @tag feedback
 * @related Alert
 * @related Toast
 *
 * Badge props are a discriminated union on `variant`: `variant="dot"`
 * forbids `children` / `counter` / `removable` / `interactive` /
 * `onRemove` at the type level, while `filled` / `outlined` / `soft`
 * accept the full surface.
 *
 * @example
 * ```svelte
 * <Badge variant="filled" intent="primary">New Feature</Badge>
 * ```
 *
 * @example
 * ```svelte
 * <div class="relative">
 *   <Button>Notifications</Button>
 *   <Badge intent="danger" counter placement="top-end" border>5</Badge>
 * </div>
 * ```
 */
export type BadgeProps = BadgeDotProps | BadgeStandardProps;

export { default as Badge } from './Badge.svelte';
export {
  type BadgePlacement,
  type BadgeVariants,
  badgeVariants,
  PLACEMENT_VALUES
} from './badge.variants';
