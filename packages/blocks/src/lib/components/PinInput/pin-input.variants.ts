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

// Each cell is directly focusable, so the ring lives on the cell itself.
const focus = 'focus-visible';
const surface = fieldSurfaceVariants(focus);
const intents = fieldIntentFrames(focus);

export const pinInputVariants = tv({
  slots: {
    root: ['flex flex-col gap-1.5'],
    label: [FIELD_LABEL],
    group: ['flex items-center'],
    cell: [
      'box-border text-center font-medium tabular-nums caret-primary',
      FIELD_SURFACE,
      FIELD_TRANSITION,
      // `focus-visible:z-10` lifts the focused cell's ring above its neighbours.
      `focus-visible:outline-none ${fieldFocusRing(focus)} focus-visible:z-10`,
      'hover:border-border-default',
      FIELD_NATIVE_DISABLED,
      FIELD_NATIVE_READONLY
    ],
    separator: ['text-text-tertiary select-none'],
    message: ['text-xs']
  },
  variants: {
    // 3-tier semantic radius. Default `modify` (soft) — pin cells read as fields.
    // Inherited from a wrapping <Toolbar tier="commit"> via TierContext.
    tier: {
      modify: { cell: 'rounded-modify' },
      commit: { cell: 'rounded-commit' }
    },
    variant: {
      outlined: { cell: surface.outlined },
      filled: { cell: surface.filled },
      ghost: { cell: surface.ghost }
    },
    size: {
      sm: {
        // `pointer-coarse:text-base` floors the font to 16px on touch-primary
        // devices — below 16px iOS Safari auto-zooms the field on focus.
        cell: 'h-9 w-9 text-sm pointer-coarse:text-base',
        group: 'gap-1.5',
        separator: 'mx-0.5 text-sm'
      },
      md: {
        cell: 'h-11 w-11 text-lg',
        group: 'gap-2',
        separator: 'mx-1 text-lg'
      },
      lg: {
        cell: 'h-14 w-14 text-2xl',
        group: 'gap-2.5',
        separator: 'mx-1.5 text-2xl'
      }
    },
    intent: {
      default: {},
      success: { cell: intents.success },
      warning: { cell: intents.warning },
      danger: { cell: intents.danger }
    },
    disabled: {
      true: {
        cell: FIELD_DISABLED_FRAME,
        label: FIELD_LABEL_DISABLED
      }
    },
    readonly: {
      true: { cell: 'bg-surface-subtle cursor-default' }
    },
    // Declared BEFORE `error` so the error tone wins the message-color bucket
    // in every call shape — `{ error: true }` alone must read red.
    messageType: {
      error: { message: FIELD_MESSAGE_TONES.error },
      helper: { message: FIELD_MESSAGE_TONES.helper }
    },
    error: {
      true: {
        cell: fieldErrorFrame(focus),
        message: FIELD_MESSAGE_TONES.error
      }
    },
    required: {
      true: { label: FIELD_REQUIRED_LABEL }
    }
  },
  compoundVariants: [
    // Ghost keeps a transparent border at rest — even under an intent. The error
    // state drops this so validation feedback (border-danger) stays visible.
    {
      variant: 'ghost',
      error: false,
      class: { cell: 'border-transparent' }
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
    messageType: 'helper'
  }
});

export type PinInputVariants = VariantProps<typeof pinInputVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type PinInputSlots = SlotNames<typeof pinInputVariants>;
