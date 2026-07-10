import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { BadgePlacement, BadgeSlots, BadgeVariants } from './badge.variants';

/**
 * Shared fields that apply to every Badge variant — `dot` and the
 * label-style variants both accept these.
 */
interface BadgeBaseProps
  extends Omit<BadgeVariants, 'variant' | 'counter'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The badge's semantic purpose — the canonical axis that resolves what the
   * badge *is*, since a bare Badge served five overlapping roles. Orchestrates
   * the low-level visual props so you rarely set them directly:
   * - `status` — a state marker (Active, Failed); pairs with `intent`.
   * - `tag` — a neutral inline label (category, version).
   * - `counter` — a compact numeric pill (replaces the `counter` boolean).
   * - `dot` — a pure indicator, content hidden (replaces `variant="dot"`).
   * - `chip` — a removable, interactive filter chip; pair with `removable`.
   *
   * Leave unset to drive the badge purely by the low-level props (back-compat).
   * When set, `purpose` wins over `variant="dot"` / the `counter` boolean.
   */
  purpose?: 'status' | 'tag' | 'counter' | 'dot' | 'chip';

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
  slotClasses?: Partial<Record<BadgeSlots, string>>;

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
  /**
   * Display as a compact pill for numeric counts (tightens padding, tabular-nums).
   * @deprecated Prefer `purpose="counter"` — the canonical semantic axis. Kept for back-compat.
   */
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
 * @example Purpose-driven (canonical) — the intent reads from `purpose`
 * ```svelte
 * <Badge purpose="status" intent="success">Active</Badge>
 * <Badge purpose="counter" intent="danger">5</Badge>
 * <Badge purpose="chip" removable onRemove={() => …}>React</Badge>
 * <Badge purpose="dot" intent="warning" />
 * ```
 *
 * @example Notification counter anchored to a trigger
 * ```svelte
 * <div class="relative">
 *   <Button>Notifications</Button>
 *   <Badge purpose="counter" intent="danger" placement="top-end" border>5</Badge>
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
