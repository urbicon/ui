import {
  FIELD_DISABLED_FRAME,
  FIELD_LABEL,
  FIELD_LABEL_DISABLED,
  FIELD_MESSAGE_TONES,
  FIELD_REQUIRED_LABEL,
  FIELD_SURFACE,
  FIELD_TRANSITION,
  fieldErrorFrame,
  fieldFocusRing,
  fieldIntentFrames,
  fieldSurfaceVariants
} from '$lib/internal/field-chrome';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

// Borderless segments live inside a bordered container, so the ring lights the
// whole field via focus-within rather than focus-visible on one element.
const focus = 'focus-within';
const surface = fieldSurfaceVariants(focus);
const intents = fieldIntentFrames(focus);

export const timeInputVariants = tv({
  slots: {
    wrapper: ['flex flex-col gap-1.5 w-full'],
    label: [FIELD_LABEL],
    // The bordered container reads as a single field; the segment inputs inside
    // are borderless. The focus ring lives here via focus-within so tabbing
    // between segments keeps the whole field lit.
    field: [
      'inline-flex items-center box-border w-fit',
      FIELD_SURFACE,
      FIELD_TRANSITION,
      'hover:border-border-default',
      fieldFocusRing(focus)
    ],
    icon: ['pointer-events-none inline-flex items-center justify-center text-text-tertiary'],
    segment: [
      'bg-transparent text-center tabular-nums text-text-primary caret-transparent',
      'border-0 outline-none p-0 rounded-sm',
      'focus-visible:bg-primary-subtle',
      'placeholder:text-text-quaternary',
      'disabled:cursor-not-allowed'
    ],
    separator: ['text-text-tertiary select-none'],
    meridiem: [
      'ml-1 font-medium text-text-secondary rounded-sm cursor-pointer select-none',
      'hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-primary-subtle',
      // The segment is a span-hosted spinbutton — no native :disabled state.
      'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
    ],
    message: ['text-xs']
  },
  variants: {
    // 3-tier semantic radius, default `modify` (soft field). Inherited from a
    // wrapping <Toolbar tier="commit"> via TierContext.
    tier: {
      modify: { field: 'rounded-modify' },
      commit: { field: 'rounded-commit' }
    },
    variant: {
      outlined: { field: surface.outlined },
      filled: { field: surface.filled },
      ghost: { field: surface.ghost }
    },
    size: {
      sm: {
        // `pointer-coarse:text-base` floors to 16px on touch to avoid iOS zoom.
        field: 'h-8 px-2 gap-0.5 text-sm pointer-coarse:text-base',
        segment: 'w-[2ch] text-sm pointer-coarse:text-base',
        icon: 'mr-1.5 [&_svg]:w-3.5 [&_svg]:h-3.5',
        meridiem: 'px-1 text-sm pointer-coarse:text-base'
      },
      md: {
        field: 'h-10 px-3 gap-0.5 text-base',
        segment: 'w-[2ch] text-base',
        icon: 'mr-2 [&_svg]:w-4 [&_svg]:h-4',
        meridiem: 'px-1 text-base'
      },
      lg: {
        field: 'h-12 px-4 gap-1 text-lg',
        segment: 'w-[2ch] text-lg',
        icon: 'mr-2.5 [&_svg]:w-5 [&_svg]:h-5',
        meridiem: 'px-1.5 text-lg'
      }
    },
    intent: {
      default: {},
      success: { field: intents.success },
      warning: { field: intents.warning },
      danger: { field: intents.danger }
    },
    disabled: {
      true: {
        field: FIELD_DISABLED_FRAME,
        label: FIELD_LABEL_DISABLED
      }
    },
    readonly: {
      // No `cursor-default` here — the container's segments carry their own cursor.
      true: { field: 'bg-surface-subtle' }
    },
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
      true: { label: FIELD_REQUIRED_LABEL }
    },
    fullWidth: {
      true: { field: 'w-full justify-start' }
    }
  },
  compoundVariants: [
    // ── Validation precedence: `error` beats `intent`, explicitly ────────────
    // Both axes paint the SAME three buckets (border-color plus the focused
    // border/ring tint), so exactly one of them can win. Emitting the error
    // frame here rather than on the `error` axis makes that rule structural:
    // compounds always fold after every axis, so `error: true` overrides
    // whatever `intent` painted regardless of how the axes are ordered above
    // (it used to hinge purely on `error` being DECLARED after `intent`).
    // Folding after `fullWidth` too is harmless: that axis only paints layout
    // buckets (`w`, `justify-content`), which never collide with the frame.
    {
      error: true,
      class: { field: fieldErrorFrame(focus) }
    },
    {
      variant: 'ghost',
      error: false,
      class: { field: 'border-transparent' }
    }
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
    fullWidth: false,
    messageType: 'helper'
  }
});

export type TimeInputVariants = VariantProps<typeof timeInputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TimeInputSlots = SlotNames<typeof timeInputVariants>;
