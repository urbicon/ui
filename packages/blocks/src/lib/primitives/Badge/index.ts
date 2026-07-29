import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { BadgePlacement, BadgeSlots, BadgeVariants } from './badge.variants';

/**
 * Shared fields that apply to every Badge arm. `variant`, `purpose`, and the
 * label-only props (`children` / `counter` / `removable` / `interactive` /
 * `onRemove`) are declared per-arm instead — that split is what lets *both*
 * dot spellings (`variant="dot"` and the canonical `purpose="dot"`) forbid the
 * label-only props at the type level.
 */
interface BadgeBaseProps
  extends Omit<BadgeVariants, 'variant' | 'counter' | 'removable' | 'interactive'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Add a pulsing animation to draw attention (e.g. for live indicators). */
  pulse?: boolean;
  /** Visually disable the badge (reduced opacity, no pointer events). */
  disabled?: boolean;
  /** Add a ring outline in the page background color — useful to visually separate overlapping or positioned badges from their parent. */
  border?: boolean;
  /** Anchor the badge absolutely within a `position: relative` parent. */
  placement?: BadgePlacement;

  /** Click handler. Automatically enables interactive styles (and `role="button"`). */
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

  /**
   * ARIA role. A static badge is announced as `"status"`; an interactive badge
   * (`onclick` or `purpose="chip"`, when not `disabled`) defaults to `"button"`
   * so assistive tech announces its activation semantics. Set explicitly to
   * override — e.g. `"alert"` for time-sensitive notifications. An explicit
   * value always wins over the derived default.
   */
  role?: 'status' | 'alert' | 'badge' | 'button';
  /** Micro-interaction preset. Only applies when the badge is interactive. */
  mint?: MintProp;
}

/**
 * The label-only props a pure-indicator dot forbids. An invisible remove
 * button, counter shape, or hover-scale on a 2.5 × 2.5 px dot is never the
 * intended UI, so every dot arm excludes them at the type level.
 */
interface BadgeDotForbiddenProps {
  children?: never;
  counter?: never;
  removable?: never;
  interactive?: never;
  onRemove?: never;
}

/**
 * Dot badge selected by the canonical `purpose="dot"` — a pure indicator whose
 * content is hidden. `variant` is inert here (the dot look always wins), and
 * the label-only props are excluded by {@link BadgeDotForbiddenProps}.
 */
interface BadgeDotByPurposeProps extends BadgeBaseProps, BadgeDotForbiddenProps {
  /**
   * The canonical dot spelling — forces the pure-indicator look regardless of
   * `variant`. For the label roles use `status` / `tag` / `counter` / `chip`
   * (their own arm).
   */
  purpose: 'dot';
  /** Inert under `purpose="dot"`; accepted only so a leftover `variant` compiles. */
  variant?: 'filled' | 'outlined' | 'soft' | 'dot';
}

/**
 * Dot badge selected by the deprecated `variant="dot"`. Prefer `purpose="dot"`.
 * Same exclusions as {@link BadgeDotByPurposeProps}.
 */
interface BadgeDotProps extends BadgeBaseProps, BadgeDotForbiddenProps {
  /** Visual variant. `dot` renders a pure indicator (content hidden); the label variants accept the full surface. */
  variant: 'dot';
  /** Only the dot purpose is non-contradictory with `variant="dot"`. */
  purpose?: 'dot';
}

/**
 * Label-style badge — accepts content, counter shape, remove button, etc.
 */
interface BadgeStandardProps extends BadgeBaseProps {
  /**
   * The badge's semantic purpose — the canonical axis that resolves what the
   * badge *is*, since a bare Badge served overlapping roles. Orchestrates the
   * low-level visual props so you rarely set them directly:
   * - `status` — a state marker (Active, Failed); pairs with `intent`.
   * - `tag` — a neutral inline label (category, version).
   * - `counter` — a compact numeric pill (replaces the `counter` boolean).
   * - `chip` — a removable, interactive filter chip; pair with `removable`.
   *
   * For a pure indicator use `purpose="dot"` (its own arm — it forbids
   * content / counter / remove). Leave unset to drive the badge purely by the
   * low-level props (back-compat); when set, `purpose` wins over the `counter`
   * boolean.
   */
  purpose?: 'status' | 'tag' | 'counter' | 'chip';
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
 * @summary A small label for a status, a category or a count.
 * @description Compact label for status, categories, counters, and notifications.
 *
 * @tag feedback
 * @related Alert
 * @related Toast
 *
 * Badge props are a discriminated union. The pure-indicator dot — spelled
 * canonically as `purpose="dot"` or via the deprecated `variant="dot"` —
 * forbids `children` / `counter` / `removable` / `interactive` / `onRemove`
 * at the type level, while the label arms (`filled` / `outlined` / `soft`;
 * `purpose` `status` / `tag` / `counter` / `chip`) accept the full surface.
 * An interactive badge (`onclick` or `purpose="chip"`) is announced as a
 * `button`, a static one as `status` (override via `role`).
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
export type BadgeProps = BadgeDotByPurposeProps | BadgeDotProps | BadgeStandardProps;

export { default as Badge } from './Badge.svelte';
export {
  type BadgePlacement,
  type BadgeVariants,
  badgeVariants,
  PLACEMENT_VALUES
} from './badge.variants';
