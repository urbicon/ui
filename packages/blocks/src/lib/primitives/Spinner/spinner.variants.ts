import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const spinnerVariants = tv({
  slots: {
    base: [
      'inline-flex items-center justify-center',
      'transition-opacity duration-[var(--blocks-duration-fast)]'
    ],
    svg: [
      'w-full h-full animate-spin',
      '[animation-duration:var(--spinner-speed)]',
      'motion-reduce:animate-none'
    ],
    svgCircle: ['opacity-25'],
    svgPath: ['fill-current'],
    dots: ['flex items-center gap-1'],
    dot: [
      'bg-current rounded-full animate-bounce',
      '[animation-duration:var(--spinner-speed)]',
      'motion-reduce:animate-none'
    ],
    pulse: ['relative w-full h-full flex items-center justify-center'],
    pulseCenter: ['rounded-full bg-current'],
    pulseRing: [
      'absolute inset-0 m-auto rounded-full bg-current',
      '[animation-name:spinner-pulse]',
      '[animation-duration:var(--spinner-speed)]',
      '[animation-timing-function:ease-out]',
      '[animation-iteration-count:infinite]',
      'motion-reduce:animate-none'
    ],
    ring: ['relative w-full h-full'],
    ringElement: [
      'absolute inset-0 m-auto box-border block border-solid border-current',
      'border-t-transparent border-r-transparent border-b-transparent',
      'rounded-full animate-spin',
      '[animation-duration:var(--spinner-speed)]',
      '[animation-timing-function:var(--blocks-ease-smooth)]',
      'motion-reduce:animate-none'
    ],
    bars: ['flex items-center gap-0.5'],
    bar: [
      'bg-current rounded-sm',
      '[animation-name:spinner-bars]',
      '[animation-duration:var(--spinner-speed)]',
      '[animation-timing-function:ease-in-out]',
      '[animation-iteration-count:infinite]',
      'motion-reduce:animate-none'
    ],
    content: ['font-medium'],
    srOnly: ['sr-only']
  },
  variants: {
    variant: {
      default: {},
      dots: {},
      pulse: {},
      ring: {},
      bars: {}
    },
    size: {
      xs: {
        base: 'w-4 h-4 gap-1',
        dot: 'w-[3px] h-[3px]',
        pulseCenter: 'w-1.5 h-1.5',
        pulseRing: 'w-1.5 h-1.5',
        ringElement: 'w-3 h-3 border',
        bar: 'w-[2px] h-2.5',
        content: 'text-xs'
      },
      sm: {
        base: 'w-5 h-5 gap-1.5',
        dot: 'w-1 h-1',
        pulseCenter: 'w-2 h-2',
        pulseRing: 'w-2 h-2',
        ringElement: 'w-4 h-4 border',
        bar: 'w-[3px] h-3.5',
        content: 'text-sm'
      },
      md: {
        base: 'w-6 h-6 gap-2',
        dot: 'w-1.5 h-1.5',
        pulseCenter: 'w-3 h-3',
        pulseRing: 'w-3 h-3',
        ringElement: 'w-5 h-5 border-2',
        bar: 'w-1 h-4',
        content: 'text-base'
      },
      lg: {
        base: 'w-8 h-8 gap-2.5',
        dot: 'w-2 h-2',
        pulseCenter: 'w-3.5 h-3.5',
        pulseRing: 'w-3.5 h-3.5',
        ringElement: 'w-6 h-6 border-2',
        bar: 'w-1.5 h-6',
        content: 'text-lg'
      },
      xl: {
        base: 'w-10 h-10 gap-3',
        dot: 'w-2.5 h-2.5',
        pulseCenter: 'w-5 h-5',
        pulseRing: 'w-5 h-5',
        ringElement: 'w-8 h-8 border-2',
        bar: 'w-2 h-8',
        content: 'text-xl'
      }
    },
    intent: {
      primary: { base: 'text-primary' },
      secondary: { base: 'text-secondary' },
      success: { base: 'text-success' },
      warning: { base: 'text-warning-emphasis' },
      danger: { base: 'text-danger' },
      neutral: { base: 'text-text-secondary' },
      // `current` inherits the parent text-color via `currentColor`. Use
      // this when the spinner sits inside a coloured surface (filled
      // Button, ConfirmDialog primary action, Toast action) and should
      // pick up the foreground color of that surface instead of the
      // intent palette.
      current: { base: 'text-current' }
    },
    speed: {
      slow: { base: '[--spinner-speed:2s]' },
      normal: { base: '[--spinner-speed:1s]' },
      fast: { base: '[--spinner-speed:0.5s]' }
    }
  },
  compoundVariants: [
    {
      variant: 'ring',
      class: {
        ringElement:
          '[&:nth-child(1)]:delay-[-0.45s] [&:nth-child(2)]:delay-[-0.3s] [&:nth-child(3)]:delay-[-0.15s]'
      }
    },
    {
      variant: 'dots',
      class: {
        dot: '[&:nth-child(1)]:delay-[-0.32s] [&:nth-child(2)]:delay-[-0.16s]'
      }
    },
    {
      variant: 'bars',
      class: {
        bar: '[&:nth-child(1)]:delay-[-0.36s] [&:nth-child(2)]:delay-[-0.24s] [&:nth-child(3)]:delay-[-0.12s]'
      }
    }
  ],
  defaultVariants: {
    variant: 'default',
    size: 'md',
    intent: 'primary',
    speed: 'normal'
  }
});

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type SpinnerSlots = SlotNames<typeof spinnerVariants>;
