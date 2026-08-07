import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

export const typesReferenceVariants = tv({
  slots: {
    // Everything above the toolbar — the `<section>`, the heading, the
    // description, the header margin — belongs to `<Section>` now. What is left
    // here is the section's body: flat and frameless, the shape ApiReference
    // has. The elevated `<Card>` this used to sit in made the lower of two
    // stacked reference tables read as a separate widget. `gap-3` is
    // ApiReference's `base` gap, so the toolbar sits the same distance above
    // its table in both.
    stack: ['flex flex-col gap-3'],
    expandedPanel: [],
    // Count + filter line above the table. Mirrors ApiReference's `stats` slot
    // token for token: same line, same place, same job — reading as one thing
    // is the point. No padding of its own: the card that justified it is gone.
    toolbar: ['flex flex-wrap items-center justify-between gap-3 text-xs text-text-tertiary'],
    // The checkbox keeps its own `xs` size; this only stops the label from
    // inheriting a colour louder than the line it sits in.
    filterLabel: ['text-text-tertiary'],
    codeBlock: ['bg-surface-quiet text-text-primary', 'overflow-x-auto rounded-contain font-mono'],
    documentation: ['text-text-secondary'],
    // In-row clamp, on its own slot: `documentation` also styles the full text
    // in the expanded row, and folded into one the disclosure would show the
    // same two lines the cell already showed. ApiReference splits it the same
    // way.
    documentationClamped: ['line-clamp-2'],
    // Em dash for an undocumented type — ApiReference's `placeholder`.
    placeholder: ['text-text-tertiary'],
    literalValues: ['mt-2 flex flex-wrap gap-1'],
    // literalBadge without a border, just a quiet tint.
    literalBadge: [
      'bg-surface-quiet text-text-secondary',
      'inline-flex items-center rounded-modify font-medium'
    ],
    // "+N more" after the capped literal badges — was an inline class string.
    moreValues: ['text-text-tertiary text-2xs'],
    usedBySection: ['text-text-secondary mt-2'],
    usedByLink: [
      'text-primary hover:text-primary-emphasis',
      'hover:underline transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-modify'
    ],
    // `@see` on the type declaration. Same two roles as in ApiReference: a
    // navigable target becomes a real link, a bare sibling-type name stays a
    // quiet footnote chip — a link there would have nowhere to point.
    seeAlsoSection: ['mt-2 flex flex-wrap items-center gap-1 text-text-tertiary'],
    seeAlsoRef: [
      'inline-flex items-center rounded-modify',
      'bg-surface-quiet px-1.5 py-0.5 font-mono leading-none text-text-secondary'
    ],
    seeAlsoLink: [
      'text-primary underline decoration-primary/40 hover:decoration-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-modify'
    ],
    // Empty state when the "only referenced" filter matches nothing — was an
    // inline class string on the markup.
    emptyText: ['text-text-tertiary py-6 text-center text-sm'],
    highlightRing: ['ring-2 ring-primary/50']
  },
  // The `size` axis is the density of what this component still owns: the table
  // body and the expanded panel. It reaches neither the heading (that is
  // `<Section intent="secondary">`, pinned so the types section reads as a
  // sibling of the API section above it) nor the table's own rows (pinned to
  // `sm` so they match ApiReference's — see the component).
  variants: {
    size: {
      sm: {
        codeBlock: 'p-2 text-xs',
        documentation: 'text-xs',
        literalBadge: 'px-1.5 py-px text-3xs',
        usedBySection: 'text-xs',
        seeAlsoSection: 'text-3xs',
        seeAlsoRef: 'text-3xs'
      },
      md: {
        codeBlock: 'p-3 text-[13px]',
        documentation: 'text-sm',
        literalBadge: 'px-2 py-[2px] text-2xs',
        usedBySection: 'text-sm',
        seeAlsoSection: 'text-2xs',
        seeAlsoRef: 'text-2xs'
      },
      lg: {
        codeBlock: 'p-4 text-sm',
        documentation: 'text-sm',
        literalBadge: 'px-2.5 py-0.5 text-xs',
        usedBySection: 'text-sm',
        seeAlsoSection: 'text-xs',
        seeAlsoRef: 'text-xs'
      }
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type TypesReferenceVariantProps = VariantProps<typeof typesReferenceVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type TypesReferenceSlots = SlotNames<typeof typesReferenceVariants>;
