import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const skeletonVariants = tv({
  slots: {
    base: ['bg-surface-interactive'],
    // `gap-2` lives here, not as the default of the `gap` prop: a prop default
    // is library-authored, and as a call-site source it would have outranked the
    // consumer's `slotClasses.wrapper`. In the slot base it is the first source,
    // which every rung of the ladder can strip.
    wrapper: ['flex flex-col gap-2']
  },
  variants: {
    // Skeleton is a placeholder — the variant IS the shape statement
    // (similar to Avatar). `text`/`rectangular` align with the tier
    // tokens so a brand-tuned `--radius-modify`/`--radius-contain`
    // cascades through; `circular` and `rounded` stay explicit.
    variant: {
      text: { base: 'rounded-modify' },
      circular: { base: 'rounded-full aspect-square' },
      rectangular: { base: 'rounded-contain' },
      rounded: { base: 'rounded-xl' }
    },
    size: {
      xs: {},
      sm: {},
      md: {},
      lg: {},
      xl: {}
    },
    animation: {
      pulse: {
        base: 'animate-pulse motion-reduce:animate-none'
      },
      wave: {
        // `via-surface-hover` would resolve to the same tone as the base
        // `surface-interactive`, leaving the shimmer invisible. The
        // `skeleton-shimmer` token is a translucent-white glint that stays
        // mode-aware via light-dark() (lower alpha in dark) — no `dark:` needed.
        base: [
          'animate-[blocks-shimmer_1.5s_ease-in-out_infinite]',
          'bg-linear-to-r from-surface-interactive via-skeleton-shimmer to-surface-interactive',
          'bg-size-[200%_100%]',
          'motion-reduce:animate-none'
        ]
      },
      none: {}
    }
  },
  compoundVariants: [
    { variant: 'text', size: 'xs', class: { base: 'h-3 w-20' } },
    { variant: 'text', size: 'sm', class: { base: 'h-3.5 w-32' } },
    { variant: 'text', size: 'md', class: { base: 'h-4 w-48' } },
    { variant: 'text', size: 'lg', class: { base: 'h-5 w-64' } },
    { variant: 'text', size: 'xl', class: { base: 'h-6 w-80' } },

    { variant: 'circular', size: 'xs', class: { base: 'w-6 h-6' } },
    { variant: 'circular', size: 'sm', class: { base: 'w-8 h-8' } },
    { variant: 'circular', size: 'md', class: { base: 'w-10 h-10' } },
    { variant: 'circular', size: 'lg', class: { base: 'w-12 h-12' } },
    { variant: 'circular', size: 'xl', class: { base: 'w-16 h-16' } },

    { variant: 'rectangular', size: 'xs', class: { base: 'h-16 w-full' } },
    { variant: 'rectangular', size: 'sm', class: { base: 'h-24 w-full' } },
    { variant: 'rectangular', size: 'md', class: { base: 'h-32 w-full' } },
    { variant: 'rectangular', size: 'lg', class: { base: 'h-48 w-full' } },
    { variant: 'rectangular', size: 'xl', class: { base: 'h-64 w-full' } },

    { variant: 'rounded', size: 'xs', class: { base: 'h-16 w-full' } },
    { variant: 'rounded', size: 'sm', class: { base: 'h-24 w-full' } },
    { variant: 'rounded', size: 'md', class: { base: 'h-32 w-full' } },
    { variant: 'rounded', size: 'lg', class: { base: 'h-48 w-full' } },
    { variant: 'rounded', size: 'xl', class: { base: 'h-64 w-full' } }
  ],
  defaultVariants: {
    variant: 'text',
    size: 'md',
    animation: 'pulse'
  }
});

export type SkeletonVariants = VariantProps<typeof skeletonVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type SkeletonSlots = SlotNames<typeof skeletonVariants>;
