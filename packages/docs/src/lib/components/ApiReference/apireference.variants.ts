import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const apiReferenceVariants = tv({
  slots: {
    base: ['flex flex-col gap-3'],
    stats: ['flex flex-wrap items-center gap-3 text-xs text-text-tertiary'],
    // The "N required" half of the stats line — the only part that carries an
    // intent colour, so it is its own slot rather than a literal in the markup.
    requiredCount: ['text-danger-text'],
    // Wrapper around the prop name and its badges (variant/inherited/required,
    // and the two maturity markers deprecated/experimental).
    nameCell: ['flex flex-wrap items-center gap-1.5'],
    // Wrapper around the literal-value chips in the Type column.
    typeChips: ['flex flex-wrap gap-1'],
    nameCode: ['font-mono text-xs font-semibold text-text-primary'],
    // A deprecated prop's name, struck through — the convention every editor and
    // API reference already uses, so it reads before the badge next to it does.
    deprecatedCode: ['font-mono text-xs font-semibold text-text-tertiary line-through'],
    spreadCode: ['font-mono text-xs text-text-tertiary'],
    typeCode: ['font-mono text-xs text-text-secondary'],
    // typeChip without a border, just a quiet tint.
    typeChip: [
      'inline-flex items-center rounded-modify',
      'bg-surface-quiet px-1.5 py-0.5 font-mono text-2xs leading-none text-text-secondary'
    ],
    defaultCode: ['font-mono text-xs text-text-tertiary'],
    description: ['text-sm leading-relaxed text-text-secondary'],
    // The replacement instruction from `@deprecated`, in the expanded row.
    deprecationNote: ['text-sm leading-relaxed text-danger-text'],
    // In-row description. Capped at two lines: a handful of props carry prose
    // an order of magnitude longer than the rest (median 62 characters, 90th
    // percentile 259, longest 1996), and those turned single rows six lines
    // tall — a grid you cannot scan any more. The full text is one disclosure
    // away, in `expandedPanel` below.
    descriptionClamped: ['line-clamp-2'],
    // --- expanded row -------------------------------------------------------
    // Mirrors TypesReference's expanded panel: a declaration line first, then
    // the prose, then the references. Same order, same slots, so the two
    // reference tables answer a disclosure the same way.
    expandedPanel: ['flex flex-col gap-2'],
    // The prop's declaration (`disabled?: boolean`) — the API's counterpart to
    // the type definition TypesReference prints here. It is what makes the
    // disclosure worth opening on a prop with a one-line description: required
    // vs optional and the exact type, neither of which the row spells out.
    signature: [
      'bg-surface-quiet text-text-primary',
      'overflow-x-auto rounded-contain p-3 font-mono text-xs'
    ],
    // Where the prop is declared (`ButtonProps`, `Omit<HTMLButtonAttributes,
    // 'children'>` from `svelte/elements`).
    sourceSection: ['flex flex-wrap items-center gap-1 text-2xs text-text-tertiary'],
    sourceName: [
      'inline-flex items-center rounded-modify',
      'bg-surface-quiet px-1.5 py-0.5 font-mono text-2xs leading-none text-text-secondary'
    ],
    sourceLink: [
      'text-primary-text underline decoration-primary/40 hover:decoration-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'focus-visible:rounded-modify'
    ],
    // The complete literal union. The row shows the first few as chips; a prop
    // like `icon` has dozens, and printing all of them in the cell is what the
    // clamp above exists to prevent.
    valuesSection: ['flex flex-wrap items-center gap-1 text-2xs text-text-tertiary'],
    // Prose `@see` references (`HTMLButtonAttributes.value`): a real reference,
    // but one with no doc URL, so it reads as a quiet footnote rather than a
    // link. Lives in the expanded panel — in the cell it competed with the
    // description for the two lines the clamp allows.
    seeAlsoRefs: ['flex flex-wrap items-center gap-1 text-2xs text-text-tertiary'],
    seeAlsoRef: [
      'inline-flex items-center rounded-modify',
      'bg-surface-quiet px-1.5 py-0.5 font-mono text-2xs leading-none text-text-secondary'
    ],
    placeholder: ['text-text-tertiary'],
    link: ['text-primary-text underline decoration-primary/40 hover:decoration-primary'],
    // Cross-reference to a TypesReference entry. Reads as prose-quiet inline
    // reference, not a link: the dotted underline is the only affordance until
    // hover, so a type-heavy table doesn't turn into a wall of blue.
    typeLink: [
      'text-text-primary underline decoration-dotted decoration-border-emphasis underline-offset-2',
      'transition-colors duration-(--blocks-duration-fast)',
      'hover:text-primary-text hover:decoration-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      'focus-visible:rounded-modify focus-visible:ring-offset-1'
    ],
    highlightRing: ['ring-2 ring-primary/50'],
    // usageNotes as an inline note (left accent instead of a card wrapper).
    usageNotes: ['border-l-2 border-l-border-default pl-4 py-2 text-sm text-text-secondary']
  }
});

export type ApiReferenceVariantProps = VariantProps<typeof apiReferenceVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type ApiReferenceSlots = SlotNames<typeof apiReferenceVariants>;
