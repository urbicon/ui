import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const typesReferenceVariants = tv({
  slots: {
    root: ['scroll-mt-8'],
    header: ['space-y-2'],
    title: ['text-text-primary font-bold'],
    description: ['text-text-secondary leading-relaxed'],
    card: [],
    toolbar: ['flex items-center justify-between gap-3'],
    toolbarText: ['text-text-secondary'],
    filterLabel: ['text-text-primary flex items-center gap-2'],
    expandedRow: [],
    codeBlock: ['bg-surface-quiet text-text-primary', 'overflow-x-auto rounded-contain font-mono'],
    documentation: ['text-text-secondary'],
    literalValues: ['mt-2 flex flex-wrap gap-1'],
    // literalBadge without a border, just a quiet tint.
    literalBadge: [
      'bg-surface-quiet text-text-secondary',
      'inline-flex items-center rounded-modify font-medium'
    ],
    usedBySection: ['text-text-secondary mt-2'],
    usedByLink: ['text-primary hover:text-primary-emphasis', 'hover:underline transition-colors'],
    highlightRing: ['ring-2 ring-primary/50']
  },
  variants: {
    size: {
      sm: {
        title: 'text-lg',
        description: 'text-xs',
        toolbar: 'p-2',
        toolbarText: 'text-xs',
        filterLabel: 'text-xs',
        codeBlock: 'p-2 text-xs',
        documentation: 'text-xs',
        literalBadge: 'px-1.5 py-px text-3xs',
        usedBySection: 'text-xs'
      },
      md: {
        title: 'text-2xl',
        description: 'text-sm',
        toolbar: 'p-3',
        toolbarText: 'text-sm',
        filterLabel: 'text-sm',
        codeBlock: 'p-3 text-[13px]',
        documentation: 'text-sm',
        literalBadge: 'px-2 py-[2px] text-2xs',
        usedBySection: 'text-sm'
      },
      lg: {
        title: 'text-3xl',
        description: 'text-base',
        toolbar: 'p-4',
        toolbarText: 'text-sm',
        filterLabel: 'text-sm',
        codeBlock: 'p-4 text-sm',
        documentation: 'text-sm',
        literalBadge: 'px-2.5 py-0.5 text-xs',
        usedBySection: 'text-sm'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type TypesReferenceVariantProps = VariantProps<typeof typesReferenceVariants>;
