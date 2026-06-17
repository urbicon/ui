import { tv, type VariantProps } from '$lib/utils/variants';

export const alertVariants = tv({
  slots: {
    base: [
      // Structure radius — alerts are inline status surfaces, not human/CTA.
      'relative flex w-full rounded-contain',
      'transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--blocks-duration-fast)]'
    ],
    icon: 'shrink-0 mt-0.5',
    content: 'flex-1 min-w-0',
    title: 'font-semibold leading-tight',
    description: 'text-sm mt-1',
    actions: 'mt-3 flex items-center gap-2',
    // tier: modify — small dismiss control on a contain surface.
    dismissButton: [
      'absolute top-3 right-3 shrink-0 rounded-modify p-1',
      'opacity-70 hover:opacity-100 transition-opacity',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50'
    ]
  },
  // Variant contract (see docs/MIGRATION-v5.md §2):
  //   soft   → bg-{intent}-subtle, no border — quiet default, reading-flow
  //   inline → border-l-2 only, transparent bg — memo-style, leisest
  //   filled → bg-{intent}, white text — strong emphasis
  variants: {
    intent: {
      primary: {},
      info: {},
      success: {},
      warning: {},
      danger: {},
      neutral: {}
    },
    variant: {
      soft: { base: 'p-4' },
      inline: { base: 'border-l-2 py-2 pl-3 pr-4 rounded-none' },
      filled: { base: 'p-4 border border-transparent' }
    },
    size: {
      sm: {
        base: 'text-sm gap-2',
        icon: 'w-4 h-4',
        title: 'text-sm',
        description: 'text-xs'
      },
      md: {
        base: 'text-sm gap-3',
        icon: 'w-5 h-5',
        title: 'text-sm',
        description: 'text-sm'
      },
      lg: {
        base: 'text-base gap-3',
        icon: 'w-6 h-6',
        title: 'text-base',
        description: 'text-sm'
      }
    }
  },
  compoundVariants: [
    // Size × Variant padding overrides — inline keeps the left-accent geometry
    // across sizes, soft/filled scale padding uniformly.
    { variant: 'soft', size: 'sm', class: { base: 'p-3' } },
    { variant: 'soft', size: 'lg', class: { base: 'p-5' } },
    { variant: 'inline', size: 'sm', class: { base: 'py-1.5 pl-2.5 pr-3' } },
    { variant: 'inline', size: 'lg', class: { base: 'py-3 pl-4 pr-5' } },
    { variant: 'filled', size: 'sm', class: { base: 'p-3' } },
    { variant: 'filled', size: 'lg', class: { base: 'p-5' } },

    // Dismiss-button position per variant/size — otherwise the close button
    // sits outside the text baseline for inline (low py) or sm (low padding).
    { variant: 'inline', size: 'sm', class: { dismissButton: 'top-1 right-2' } },
    { variant: 'inline', size: 'md', class: { dismissButton: 'top-2 right-3' } },
    { variant: 'inline', size: 'lg', class: { dismissButton: 'top-3 right-4' } },
    { variant: 'soft', size: 'sm', class: { dismissButton: 'top-2 right-2' } },
    { variant: 'filled', size: 'sm', class: { dismissButton: 'top-2 right-2' } },

    // Soft — tinted bg, intent-emphasis text, no border
    {
      intent: 'primary',
      variant: 'soft',
      class: { base: 'bg-primary-subtle text-primary-emphasis', icon: 'text-primary-emphasis' }
    },
    {
      intent: 'info',
      variant: 'soft',
      class: { base: 'bg-info-subtle text-info-emphasis', icon: 'text-info-emphasis' }
    },
    {
      intent: 'success',
      variant: 'soft',
      class: { base: 'bg-success-subtle text-success-emphasis', icon: 'text-success-emphasis' }
    },
    {
      intent: 'warning',
      variant: 'soft',
      class: { base: 'bg-warning-subtle text-warning-emphasis', icon: 'text-warning-emphasis' }
    },
    {
      intent: 'danger',
      variant: 'soft',
      class: { base: 'bg-danger-subtle text-danger-emphasis', icon: 'text-danger-emphasis' }
    },
    {
      intent: 'neutral',
      variant: 'soft',
      class: { base: 'bg-neutral-subtle text-text-primary', icon: 'text-text-secondary' }
    },

    // Inline — left accent only, transparent bg, intent text
    {
      intent: 'primary',
      variant: 'inline',
      class: { base: 'border-l-primary text-text-primary', icon: 'text-primary' }
    },
    {
      intent: 'info',
      variant: 'inline',
      class: { base: 'border-l-info text-text-primary', icon: 'text-info' }
    },
    {
      intent: 'success',
      variant: 'inline',
      class: { base: 'border-l-success text-text-primary', icon: 'text-success' }
    },
    {
      intent: 'warning',
      variant: 'inline',
      class: { base: 'border-l-warning text-text-primary', icon: 'text-warning-emphasis' }
    },
    {
      intent: 'danger',
      variant: 'inline',
      class: { base: 'border-l-danger text-text-primary', icon: 'text-danger' }
    },
    {
      intent: 'neutral',
      variant: 'inline',
      class: { base: 'border-l-border-emphasis text-text-primary', icon: 'text-text-secondary' }
    },

    // Filled — solid bg, contrast text
    {
      intent: 'primary',
      variant: 'filled',
      class: { base: 'bg-primary text-text-on-primary', dismissButton: 'text-text-on-primary' }
    },
    {
      intent: 'info',
      variant: 'filled',
      class: { base: 'bg-info text-text-on-primary', dismissButton: 'text-text-on-primary' }
    },
    {
      intent: 'success',
      variant: 'filled',
      class: { base: 'bg-success text-text-on-primary', dismissButton: 'text-text-on-primary' }
    },
    {
      intent: 'warning',
      variant: 'filled',
      class: { base: 'bg-warning text-text-on-surface', dismissButton: 'text-text-on-surface' }
    },
    {
      intent: 'danger',
      variant: 'filled',
      class: { base: 'bg-danger text-text-on-primary', dismissButton: 'text-text-on-primary' }
    },
    {
      intent: 'neutral',
      variant: 'filled',
      class: { base: 'bg-neutral text-text-on-primary', dismissButton: 'text-text-on-primary' }
    }
  ],
  defaultVariants: {
    intent: 'primary',
    variant: 'soft',
    size: 'md'
  }
});

export type AlertVariants = VariantProps<typeof alertVariants>;
