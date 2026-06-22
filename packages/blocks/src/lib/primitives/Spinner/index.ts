import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SpinnerSlots, SpinnerVariants } from './spinner.variants';

/**
 * @description Animated loading indicator with multiple animation styles and semantic intents.
 *
 * @tag feedback
 * @related Progress
 * @related Skeleton
 *
 * @example
 * ```svelte
 * <Spinner size="md" intent="primary" />
 * ```
 *
 * @example
 * ```svelte
 * <Spinner variant="bars" speed="fast" intent="success" />
 * ```
 */
export interface SpinnerProps
  extends SpinnerVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Optional content rendered beside the spinner (e.g. loading text). */
  children?: Snippet;

  /** Accessible label announced by screen readers. Defaults to "Loading...". */
  label?: string;

  /** Animation style. `default` is an SVG arc, `dots` bounces three dots,
   *  `pulse` radiates a sonar ping, `ring` spins cascading borders,
   *  `bars` animates vertical equalizer bars. */
  variant?: SpinnerVariants['variant'];

  /** Semantic color applied via `text-*` token. */
  intent?: SpinnerVariants['intent'];

  /** Physical dimensions from `xs` (16 px) to `xl` (40 px). */
  size?: SpinnerVariants['size'];

  /** Animation speed — controls `--spinner-speed` custom property. */
  speed?: SpinnerVariants['speed'];

  /** When false the spinner is removed from the DOM. */
  visible?: boolean;

  /** Extra classes merged onto the root element. */
  class?: string;

  /** Strip all default tv() classes. Combine with `slotClasses` for full control. */
  unstyled?: boolean;

  /** Per-slot class overrides merged with (or replacing, when `unstyled`) tv() output.
   *  Slots: base | svg | svgCircle | svgPath | dots | dot | pulse | pulseCenter |
   *  pulseRing | ring | ringElement | bars | bar | content | srOnly */
  slotClasses?: Partial<Record<SpinnerSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Spinner: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Spinner } from './Spinner.svelte';
export { type SpinnerVariants, spinnerVariants } from './spinner.variants';
