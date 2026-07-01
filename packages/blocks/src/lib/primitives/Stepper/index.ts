import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { InteractiveTier } from '$lib/utils';
import type { StepperSlots, StepperVariants } from './stepper.variants';

/** Context for Stepper ↔ StepperStep communication */
export interface StepperContext {
  readonly activeStep: number;
  readonly orientation: 'horizontal' | 'vertical';
  readonly variant: 'default' | 'outlined' | 'minimal';
  readonly size: 'sm' | 'md' | 'lg';
  readonly tier: InteractiveTier;
  readonly linear: boolean;
  readonly clickable: boolean;
  readonly disabled: boolean;
  registerStep: () => number;
  goToStep: (index: number) => void;
}

/**
 * @description Multi-step progress indicator with horizontal/vertical layout,
 * clickable navigation, and per-step state overrides (error, warning).
 *
 * @tag navigation
 * @related Tab
 * @related JourneyTimeline
 *
 * @example
 * ```svelte
 * <Stepper activeStep={1}>
 *   <StepperStep label="Account" description="Create your account" />
 *   <StepperStep label="Profile" description="Set up your profile" />
 *   <StepperStep label="Review" description="Review and submit" />
 * </Stepper>
 * ```
 *
 * @example
 * ```svelte
 * <Stepper activeStep={0} orientation="vertical" clickable>
 *   <StepperStep label="Details" description="Enter your information">
 *     <p>Form content here...</p>
 *   </StepperStep>
 *   <StepperStep label="Confirm" description="Verify and submit" />
 * </Stepper>
 * ```
 */
export interface StepperProps
  extends Omit<StepperVariants, 'stepState' | 'clickable' | 'stepDisabled' | 'separatorComplete'>,
    Omit<HTMLAttributes<HTMLOListElement>, 'children'> {
  /** Current active step index (0-based). Supports bind:activeStep. @default 0 */
  activeStep?: number;
  /** Stack direction. @default 'horizontal' */
  orientation?: 'horizontal' | 'vertical';
  /** Visual style of step indicators. @default 'default' */
  variant?: 'default' | 'outlined' | 'minimal';
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Restrict navigation to sequential order — only completed steps and the next step are clickable. @default false */
  linear?: boolean;
  /** Allow clicking step indicators to navigate between steps. @default false */
  clickable?: boolean;
  /** Disable all steps and prevent navigation. @default false */
  disabled?: boolean;
  /**
   * Semantic radius tier propagated to every StepperStep. Default `commit`
   * — step indicators read as identity circles. Set to `modify` (or
   * inherit via TierContext from a wrapping `<Toolbar tier="modify">`) to
   * render a compact soft-rectangle stepper for inline wizards.
   *
   * @default 'commit'
   */
  tier?: InteractiveTier;
  /**
   * Container-responsive mode: when the Stepper's container is narrower than
   * `breakpoint`, automatically switch to `orientation="vertical"` and
   * `variant="minimal"` so the steps stay readable.
   *
   * - `false` (default): never auto-switch.
   * - `true`: switch below 640 px container width.
   * - `{ breakpoint: 480 }`: switch below 480 px.
   *
   * Uses `ResizeObserver` on the root element — works inside Drawers, Cards,
   * or split layouts where viewport-based media queries miss the actual
   * available width.
   *
   * @default false
   */
  responsive?: boolean | { breakpoint?: number };
  /** Fires when a step is activated via click. Passes the new step index. */
  onStepChange?: (step: number) => void;
  /** StepperStep children. */
  children: Snippet;
  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv() classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | stepItem | step | indicatorColumn | indicator | labelGroup | label | description | separator | content */
  slotClasses?: Partial<Record<StepperSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Stepper: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

/**
 * Single step within a Stepper. Renders an indicator, label, and optional content (vertical only).
 *
 * @example
 * ```svelte
 * <StepperStep label="Payment" description="Add a payment method" />
 * ```
 *
 * @example
 * ```svelte
 * <StepperStep label="Review" state="error">
 *   <p>Please fix the errors above before continuing.</p>
 * </StepperStep>
 * ```
 */
export interface StepperStepProps extends Omit<HTMLAttributes<HTMLLIElement>, 'children'> {
  /** Step title displayed next to the indicator. */
  label: string;
  /** Secondary text below the label. */
  description?: string;
  /** Custom icon snippet replacing the default step number or status icon. */
  icon?: Snippet;
  /**
   * Override the auto-derived step state. By default, steps before activeStep
   * are 'complete', the active step is 'active', and later steps are 'inactive'.
   */
  state?: 'complete' | 'error' | 'warning';
  /** Mark this step as optional — displays "Optional" below the description. @default false */
  optional?: boolean;
  /** Disable this individual step. @default false */
  disabled?: boolean;
  /** Step content displayed below the label in vertical orientation. */
  children?: Snippet;
  /** Extra classes merged onto the root li element. */
  class?: string;
  /** Remove all default tv() classes. */
  unstyled?: boolean;
  /** Per-slot class overrides (subset of Stepper's, minus the root `base`). */
  slotClasses?: Partial<Record<Exclude<StepperSlots, 'base'>, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ StepperStep: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Stepper } from './Stepper.svelte';
export { default as StepperStep } from './StepperStep.svelte';
export { type StepperVariants, stepperVariants } from './stepper.variants';
