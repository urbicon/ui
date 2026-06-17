import { tv, type VariantProps } from '@urbicon-ui/blocks';

export const apiReferenceVariants = tv({
  slots: {
    base: ['flex flex-col gap-3'],
    stats: ['flex flex-wrap items-center gap-3 text-xs text-text-tertiary'],
    nameCode: ['font-mono text-xs font-semibold text-text-primary'],
    spreadCode: ['font-mono text-xs text-text-tertiary'],
    typeCode: ['font-mono text-xs text-text-secondary'],
    // typeChip without a border, just a quiet tint.
    typeChip: [
      'inline-flex items-center rounded-modify',
      'bg-surface-quiet px-1.5 py-0.5 font-mono text-[11px] leading-none text-text-secondary'
    ],
    defaultCode: ['font-mono text-xs text-text-tertiary'],
    description: ['text-sm leading-relaxed text-text-secondary'],
    placeholder: ['text-text-tertiary'],
    link: ['text-primary underline decoration-primary/40 hover:decoration-primary'],
    // usageNotes as an inline note (left accent instead of a card wrapper).
    usageNotes: ['border-l-2 border-l-border-default pl-4 py-2 text-sm text-text-secondary']
  },
  variants: {},
  defaultVariants: {}
});

export type ApiReferenceVariantProps = VariantProps<typeof apiReferenceVariants>;
