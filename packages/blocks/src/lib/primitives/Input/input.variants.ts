import {
  FIELD_DISABLED_FRAME,
  FIELD_LABEL,
  FIELD_LABEL_DISABLED,
  FIELD_MESSAGE_TONES,
  FIELD_NATIVE_DISABLED,
  FIELD_NATIVE_READONLY,
  FIELD_REQUIRED_LABEL,
  FIELD_SURFACE,
  FIELD_TRANSITION,
  fieldErrorFrame,
  fieldFocusRing,
  fieldIntentFrames,
  fieldSurfaceVariants
} from '$lib/internal/field-chrome';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// Input and PinInput light the focusable element itself; TimeInput its container.
const focus = 'focus-visible';
const surface = fieldSurfaceVariants(focus);
const intents = fieldIntentFrames(focus);

export const inputVariants = tv({
  slots: {
    wrapper: ['flex flex-col w-full gap-1.5'],
    container: ['relative flex items-center'],
    base: [
      `w-full box-border ${FIELD_TRANSITION}`,
      // Radius driven by `tier` axis below.
      'focus-visible:outline-none',
      `${FIELD_SURFACE} placeholder:text-text-quaternary`,
      `hover:border-border-default ${fieldFocusRing(focus)}`,
      FIELD_NATIVE_DISABLED,
      FIELD_NATIVE_READONLY
    ],
    label: [FIELD_LABEL],
    message: ['text-xs mt-1.5'],
    iconContainer: [
      'absolute top-0 bottom-0 flex items-center justify-center z-10 pointer-events-none'
    ],
    iconButton: [
      'pointer-events-auto inline-flex items-center justify-center rounded-modify cursor-pointer',
      'text-text-tertiary hover:text-text-primary hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'
    ],
    iconDecoration: [
      'pointer-events-none inline-flex items-center justify-center text-text-tertiary'
    ]
  },
  variants: {
    // 3-tier semantic radius. Default `modify` (soft) — inputs read as
    // tap areas / fields, not CTAs. Opt-in `commit` (pill) for search
    // bars, marketing newsletter inputs, or OS-style command bars.
    // Usually inherited from a wrapping <Toolbar tier="commit"> via
    // TierContext when appropriate.
    tier: {
      modify: { base: 'rounded-modify' },
      commit: { base: 'rounded-commit' }
    },
    variant: {
      outlined: {
        base: surface.outlined
      },
      filled: {
        base: surface.filled
      },
      ghost: {
        base: surface.ghost
      },
      underline: {
        base: 'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0'
      }
    },
    size: {
      xs: {
        // `pointer-coarse:text-base` floors the font to 16px on touch-primary
        // devices (iPhone/iPad) — below 16px iOS Safari auto-zooms the field on
        // focus and never restores the zoom. Desktop keeps the designed 12px.
        base: 'h-7 px-2 text-xs pointer-coarse:text-base',
        iconContainer: 'w-7',
        iconButton: 'p-0.5 [&_svg]:w-3 [&_svg]:h-3',
        iconDecoration: '[&_svg]:w-3 [&_svg]:h-3'
      },
      sm: {
        // See `xs` — floor to 16px on touch to avoid iOS Safari focus-zoom.
        base: 'h-8 px-3 text-sm pointer-coarse:text-base',
        iconContainer: 'w-8',
        iconButton: 'p-0.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        iconDecoration: '[&_svg]:w-3.5 [&_svg]:h-3.5'
      },
      md: {
        base: 'h-10 px-4 text-base',
        iconContainer: 'w-10',
        iconButton: 'p-1 [&_svg]:w-4 [&_svg]:h-4',
        iconDecoration: '[&_svg]:w-4 [&_svg]:h-4'
      },
      lg: {
        base: 'h-12 px-6 text-lg',
        iconContainer: 'w-12',
        iconButton: 'p-1 [&_svg]:w-5 [&_svg]:h-5',
        iconDecoration: '[&_svg]:w-5 [&_svg]:h-5'
      },
      xl: {
        base: 'h-14 px-8 text-xl',
        iconContainer: 'w-14',
        iconButton: 'p-1.5 [&_svg]:w-6 [&_svg]:h-6',
        iconDecoration: '[&_svg]:w-6 [&_svg]:h-6'
      }
    },
    // Message colour is owned by messageType/error (declared below) — an
    // intent-level message tone could never win the fold and shipped
    // inconsistently under the old stylesheet-order tie-break.
    intent: {
      default: {},
      success: {
        base: intents.success
      },
      warning: {
        base: intents.warning
      },
      danger: {
        base: intents.danger
      }
    },
    disabled: {
      true: {
        base: FIELD_DISABLED_FRAME,
        label: FIELD_LABEL_DISABLED
      }
    },
    readonly: {
      true: {
        base: 'bg-surface-subtle cursor-default'
      }
    },
    // Declared BEFORE `error` so the error tone wins the message-color
    // bucket in every call shape — `{ error: true }` alone must read red.
    messageType: {
      error: { message: FIELD_MESSAGE_TONES.error },
      helper: { message: FIELD_MESSAGE_TONES.helper }
    },
    // The error FRAME is not declared here — it lives in the compound stage
    // below, where it beats `intent` by construction. See the precedence note
    // on the first compound entry.
    error: {
      true: {
        message: FIELD_MESSAGE_TONES.error
      }
    },
    required: {
      true: {
        label: FIELD_REQUIRED_LABEL
      }
    },
    hasLeftIcon: { true: {} },
    hasRightIcon: { true: {} },
    iconPosition: {
      left: { iconContainer: 'left-0' },
      right: { iconContainer: 'right-0' }
    }
  },
  compoundVariants: [
    // ── Validation precedence: `error` beats `intent`, explicitly ────────────
    // Both axes paint the SAME three buckets (border-color plus the focused
    // border/ring tint), so exactly one of them can win. Emitting the error
    // frame here rather than on the `error` axis makes that rule structural:
    // compounds always fold after every axis, so `error: true` overrides
    // whatever `intent` painted regardless of how the axes are ordered above.
    // Previously the winner was decided purely by `error` happening to be
    // DECLARED after `intent` — reordering the axes (or slipping a new one
    // between them) would have silently turned validation feedback back into a
    // green/amber frame. `intent` keeps its tonal job for the non-error states.
    {
      error: true,
      class: { base: fieldErrorFrame(focus) }
    },
    // Ghost keeps a transparent border in its resting state — even when an
    // intent would otherwise colour it. The error state intentionally drops
    // this override so validation feedback (`border-danger`) stays visible.
    {
      variant: 'ghost',
      error: false,
      class: { base: 'border-transparent' }
    },
    { hasLeftIcon: true, size: 'xs', class: { base: 'pl-7' } },
    { hasLeftIcon: true, size: 'sm', class: { base: 'pl-8' } },
    { hasLeftIcon: true, size: 'md', class: { base: 'pl-10' } },
    { hasLeftIcon: true, size: 'lg', class: { base: 'pl-12' } },
    { hasLeftIcon: true, size: 'xl', class: { base: 'pl-14' } },
    { hasRightIcon: true, size: 'xs', class: { base: 'pr-7' } },
    { hasRightIcon: true, size: 'sm', class: { base: 'pr-8' } },
    { hasRightIcon: true, size: 'md', class: { base: 'pr-10' } },
    { hasRightIcon: true, size: 'lg', class: { base: 'pr-12' } },
    { hasRightIcon: true, size: 'xl', class: { base: 'pr-14' } }
  ],
  defaultVariants: {
    tier: 'modify',
    variant: 'outlined',
    size: 'md',
    intent: 'default',
    disabled: false,
    readonly: false,
    error: false,
    required: false,
    hasLeftIcon: false,
    hasRightIcon: false,
    messageType: 'helper',
    iconPosition: 'left'
  }
});

export type InputVariants = VariantProps<typeof inputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type InputSlots = SlotNames<typeof inputVariants>;
