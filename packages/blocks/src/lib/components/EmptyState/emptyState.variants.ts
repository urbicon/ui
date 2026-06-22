import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const emptyStateVariants = tv({
  slots: {
    base: 'flex flex-col items-center justify-center text-center',
    // tier: commit — icon container is an identity circle.
    iconWrapper:
      'bg-primary-subtle text-primary mb-4 flex items-center justify-center rounded-commit',
    title: 'text-text-primary font-semibold',
    description: 'text-text-secondary mt-1.5 max-w-md text-sm leading-relaxed',
    children: 'mt-3',
    cta: 'mt-5 flex flex-wrap items-center justify-center gap-2'
  },
  variants: {
    density: {
      compact: {
        base: 'py-8 px-4',
        iconWrapper: 'h-12 w-12',
        title: 'text-base'
      },
      default: {
        base: 'py-16 px-6 sm:py-20',
        iconWrapper: 'h-16 w-16',
        title: 'text-lg sm:text-xl',
        description: 'sm:text-base'
      }
    }
  },
  defaultVariants: {
    density: 'default'
  }
});

export type EmptyStateVariants = VariantProps<typeof emptyStateVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type EmptyStateSlots = SlotNames<typeof emptyStateVariants>;
