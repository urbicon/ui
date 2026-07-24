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
      'bg-surface-quiet px-1.5 py-0.5 font-mono text-2xs leading-none text-text-secondary'
    ],
    defaultCode: ['font-mono text-xs text-text-tertiary'],
    description: ['text-sm leading-relaxed text-text-secondary'],
    // Description cell wrapper — only needed when a prop also carries prose
    // `@see` references, which stack under the description text.
    descriptionCell: ['flex flex-col items-start gap-1'],
    // Prose `@see` references (`HTMLButtonAttributes.value`): a real reference,
    // but one with no doc URL, so it reads as a quiet footnote rather than a link.
    seeAlsoRefs: ['flex flex-wrap items-center gap-1 text-2xs text-text-tertiary'],
    seeAlsoRef: [
      'inline-flex items-center rounded-modify',
      'bg-surface-quiet px-1.5 py-0.5 font-mono text-2xs leading-none text-text-secondary'
    ],
    placeholder: ['text-text-tertiary'],
    link: ['text-primary underline decoration-primary/40 hover:decoration-primary'],
    // Cross-reference to a TypesReference entry. Reads as prose-quiet inline
    // reference, not a link: the dotted underline is the only affordance until
    // hover, so a type-heavy table doesn't turn into a wall of blue.
    typeLink: [
      'text-text-primary underline decoration-dotted decoration-border-emphasis underline-offset-2',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-primary hover:decoration-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'focus-visible:rounded-modify focus-visible:ring-offset-1'
    ],
    highlightRing: ['ring-2 ring-primary/50'],
    // usageNotes as an inline note (left accent instead of a card wrapper).
    usageNotes: ['border-l-2 border-l-border-default pl-4 py-2 text-sm text-text-secondary']
  },
  variants: {},
  defaultVariants: {}
});

export type ApiReferenceVariantProps = VariantProps<typeof apiReferenceVariants>;
