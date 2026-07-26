import { fieldErrorFrame } from '$lib/internal/field-chrome';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const textareaVariants = tv({
  slots: {
    wrapper: ['flex flex-col w-full gap-1.5'],
    base: [
      'w-full box-border resize-vertical',
      'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out',
      // Radius driven by `tier` axis below.
      'focus-visible:outline-none',
      'border text-text-primary bg-surface-base placeholder:text-text-quaternary',
      'hover:border-border-default focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:resize-none',
      'read-only:bg-surface-subtle read-only:cursor-default read-only:resize-none'
    ],
    label: ['block font-medium text-text-secondary text-sm'],
    footer: ['flex items-center justify-between gap-2'],
    message: ['text-xs'],
    counter: ['text-xs text-text-tertiary tabular-nums ml-auto shrink-0']
  },
  variants: {
    // 3-tier semantic radius. Default `modify` (soft). Opt-in `commit`
    // (pill) is exotic for textareas but kept consistent with Input.
    tier: {
      modify: { base: 'rounded-modify' },
      commit: { base: 'rounded-commit' }
    },
    variant: {
      outlined: {
        base: 'border-border-subtle'
      },
      filled: {
        base: 'bg-surface-interactive border-transparent hover:bg-surface-interactive-hover focus-visible:bg-surface-base'
      },
      ghost: {
        base: 'bg-transparent border-transparent hover:bg-surface-subtle focus-visible:bg-surface-base focus-visible:border-border-subtle'
      },
      underline: {
        base: 'bg-transparent border-0 border-b-2 border-border-subtle rounded-none focus-visible:ring-0'
      }
    },
    size: {
      // Full xs–xl scale (form-family symmetry with Input's ladder).
      // `pointer-coarse:text-base` floors the font to 16px on touch so iOS
      // Safari doesn't auto-zoom the field on focus. Desktop keeps 12/14px.
      xs: { base: 'px-2 py-1.5 text-xs pointer-coarse:text-base min-h-[4rem]' },
      sm: { base: 'px-3 py-2 text-sm pointer-coarse:text-base min-h-[5rem]' },
      md: { base: 'px-4 py-3 text-base min-h-[7rem]' },
      lg: { base: 'px-6 py-4 text-lg min-h-[9rem]' },
      xl: { base: 'px-8 py-5 text-xl min-h-[11rem]' }
    },
    // Message colour is owned by messageType/error (declared below) — an
    // intent-level message tone could never win the fold and shipped
    // inconsistently under the old stylesheet-order tie-break.
    intent: {
      default: {},
      success: {
        base: 'border-success focus-visible:border-success focus-visible:ring-success/20'
      },
      warning: {
        base: 'border-warning focus-visible:border-warning focus-visible:ring-warning/20'
      },
      danger: {
        base: 'border-danger focus-visible:border-danger focus-visible:ring-danger/20'
      }
    },
    autoResize: {
      true: { base: 'resize-none overflow-hidden' }
    },
    disabled: {
      true: {
        base: 'opacity-50 cursor-not-allowed bg-surface-disabled pointer-events-none',
        label: 'text-text-disabled'
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
      error: { message: 'text-danger' },
      helper: { message: 'text-text-tertiary' }
    },
    // The error FRAME is not declared here — it lives in the compound stage
    // below, where it beats `intent` by construction. See the precedence note
    // on the first compound entry.
    error: {
      true: {
        message: 'text-danger'
      }
    },
    required: {
      true: {
        label: "after:content-['*'] after:ml-1 after:text-danger"
      }
    },
    counterState: {
      normal: {},
      warning: { counter: 'text-warning-emphasis' },
      over: { counter: 'text-danger font-medium' }
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
    {
      error: true,
      class: { base: fieldErrorFrame('focus-visible') }
    },
    {
      variant: 'ghost',
      intent: ['success', 'warning', 'danger'],
      error: false,
      class: { base: 'border-transparent' }
    }
  ],
  defaultVariants: {
    tier: 'modify',
    variant: 'outlined',
    size: 'md',
    intent: 'default',
    autoResize: false,
    disabled: false,
    readonly: false,
    error: false,
    required: false,
    messageType: 'helper',
    counterState: 'normal'
  }
});

export type TextareaVariants = VariantProps<typeof textareaVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TextareaSlots = SlotNames<typeof textareaVariants>;
