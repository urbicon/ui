import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const progressVariants = tv({
  slots: {
    wrapper: ['flex flex-col gap-1.5 w-full'],
    header: ['flex items-center justify-between'],
    label: ['text-sm font-medium text-text-secondary'],
    valueText: ['text-sm tabular-nums text-text-tertiary'],
    // tier: commit — progress bar reads as a continuous status pill.
    track: [
      'relative w-full overflow-hidden rounded-commit bg-surface-subtle',
      'transition-[background-color] duration-[var(--blocks-duration-fast)] ease-out'
    ],
    fill: [
      // Height comes from the size axis (track and fill share it).
      'rounded-commit',
      'transition-[width,background-color] duration-[var(--blocks-duration-normal)] ease-out'
    ],
    circularWrapper: ['relative inline-flex items-center justify-center'],
    circularTrack: ['stroke-current text-surface-subtle'],
    circularFill: [
      'stroke-current transition-[stroke-dashoffset] duration-[var(--blocks-duration-normal)] ease-out'
    ],
    circularLabel: ['absolute text-text-primary font-medium']
  },
  variants: {
    intent: {
      primary: { fill: 'bg-primary', circularFill: 'text-primary' },
      secondary: { fill: 'bg-secondary', circularFill: 'text-secondary' },
      success: { fill: 'bg-success', circularFill: 'text-success' },
      warning: { fill: 'bg-warning', circularFill: 'text-warning-emphasis' },
      danger: { fill: 'bg-danger', circularFill: 'text-danger' },
      neutral: { fill: 'bg-neutral', circularFill: 'text-neutral' }
    },
    size: {
      xs: {
        track: 'h-1',
        fill: 'h-1',
        circularLabel: 'text-3xs'
      },
      sm: {
        track: 'h-1.5',
        fill: 'h-1.5',
        circularLabel: 'text-xs'
      },
      md: {
        track: 'h-2.5',
        fill: 'h-2.5',
        circularLabel: 'text-sm'
      },
      lg: {
        track: 'h-4',
        fill: 'h-4',
        circularLabel: 'text-base'
      }
    },
    indeterminate: {
      true: {
        fill: 'animate-progress-indeterminate w-1/3'
      }
    },
    striped: {
      true: {
        fill: 'bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)]'
      }
    },
    animated: {
      true: {}
    }
  },
  compoundVariants: [
    {
      striped: true,
      animated: true,
      class: { fill: 'animate-progress-striped' }
    }
  ],
  defaultVariants: {
    intent: 'primary',
    size: 'md',
    indeterminate: false,
    striped: false,
    animated: false
  }
});

export type ProgressVariants = VariantProps<typeof progressVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type ProgressSlots = SlotNames<typeof progressVariants>;
