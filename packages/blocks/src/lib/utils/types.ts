import type { MintProp } from '$lib/mint';

// === CORE DESIGN SYSTEM TYPES ===

/**
 * Canonical list of intent semantics in the design system.
 * Use this constant when you need a runtime value (e.g. for iteration,
 * tabs, status mappings); use {@link Intent} / {@link ComponentIntent}
 * for the matching type.
 */
export const INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;

/**
 * Canonical list of variant treatments. Most styled primitives accept
 * a subset of these.
 */
export const VARIANTS = ['filled', 'outlined', 'ghost', 'text'] as const;

/**
 * Standard size scale, sorted from smallest to largest. Individual
 * components may opt into a subset (see {@link ComponentSize}).
 */
export const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

/**
 * Standard size scale for components.
 *
 * Most components support a subset of this scale:
 * - **Compact** (3 sizes): `sm | md | lg` – Menu, Pagination, Popover, Tab, Tooltip
 * - **Standard** (5 sizes): `xs | sm | md | lg | xl` – Input, Spinner, ButtonGroup
 * - **Extended** (4 sizes): `xs | sm | md | lg` – Badge, Checkbox, Toggle
 *
 * Button and Avatar extend this scale with `2xs` / `2xl` respectively.
 */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ComponentIntent = (typeof INTENTS)[number];
export type ComponentVariant = (typeof VARIANTS)[number];

/**
 * Short alias for {@link ComponentIntent}. Useful when defining
 * status maps in consumer code, e.g.
 * `const statusIntent: Record<Status, Intent> = { ... }`.
 */
export type Intent = ComponentIntent;

/**
 * Short alias for {@link ComponentVariant}.
 */
export type Variant = ComponentVariant;

/**
 * Full size scale across the system, including the extended sizes
 * `2xs` and `2xl` used by {@link ButtonProps} and {@link AvatarProps}.
 * Components that only accept the standard scale should keep using
 * {@link ComponentSize}.
 */
export type Size = (typeof SIZES)[number];

// === BASE COMPONENT INTERFACES ===

export interface BaseComponentProps {
  size?: ComponentSize;
  intent?: ComponentIntent;
  variant?: ComponentVariant;
  disabled?: boolean;
  loading?: boolean;
  mint?: MintProp;
  tokens?: Record<string, string>;
}

// === ANIMATION & EFFECTS ===

export interface AnimationProps {
  rippleEffect?: boolean;
  chevronAnimation?: 'rotate' | 'translate' | 'fade' | 'none';
}
