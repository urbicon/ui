import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';
import { apiReferenceVariants } from '../ApiReference/apireference.variants';

// ApiReference's slots, called rather than copied. The two tables sit under
// each other on every component page and read as one widget only while every
// cell, chip and footnote shares its classes, so a slot below that names
// `api.<slot>()` IS that slot of the API table. What this config adds of its
// own is the "only referenced" filter, the empty state and the `size` axis.
const api = apiReferenceVariants();

export const typesReferenceVariants = tv({
  slots: {
    // Everything above the toolbar — the `<section>`, the heading, the
    // description, the header margin — belongs to `<Section>`.
    stack: [api.base()],
    expandedPanel: [api.expandedPanel()],
    // Count + filter line above the table: the API table's stats line, spread
    // to carry the checkbox on the right.
    toolbar: [api.stats(), 'justify-between'],
    // The checkbox keeps its own `xs` size and its 44px pointer target; the
    // label takes the line's quiet colour, and the negative margin lets the
    // target overhang the line instead of making the line 44px tall — the API
    // table's stats line, which this one stands in for, is 16px.
    filterLabel: ['text-text-tertiary', '-my-3'],
    // --- cells: a type's name, kind, category and use count read the way the
    // API table's prop name, type and default do ---------------------------
    nameCode: [api.nameCode()],
    kindCode: [api.typeCode()],
    categoryCode: [api.defaultCode()],
    usedByCount: [api.defaultCode()],
    documentation: [api.description()],
    // In-row clamp, on its own slot: `documentation` also styles the full text
    // in the expanded row, and folded into one the disclosure would show the
    // same two lines the cell already showed.
    documentationClamped: [api.descriptionClamped()],
    placeholder: [api.placeholder()],
    // --- expanded row: the type's definition where the API table prints the
    // prop's declaration, then the prose, then the footnotes ---------------
    codeBlock: [api.signature()],
    literalValues: [api.valuesSection()],
    literalBadge: [api.typeChip()],
    // "+N more" after the capped literal badges.
    moreValues: [api.placeholder()],
    usedBySection: [api.sourceSection()],
    usedByLink: [api.sourceLink()],
    // `@see` on the type declaration. Same two roles as in ApiReference: a
    // navigable target becomes a real link, a bare sibling-type name stays a
    // quiet footnote chip — a link there would have nowhere to point.
    seeAlsoSection: [api.seeAlsoRefs()],
    seeAlsoRef: [api.seeAlsoRef()],
    seeAlsoLink: [api.link()],
    // Empty state when the "only referenced" filter matches nothing.
    emptyText: ['text-text-tertiary py-6 text-center text-sm'],
    highlightRing: [api.highlightRing()]
  },
  // The density of the expanded panel. `md` adds nothing: it is the API
  // table's own panel. It reaches neither the heading (`<Section>`) nor the
  // rows (pinned to `sm`, the API table's, in the component).
  variants: {
    size: {
      sm: {
        codeBlock: 'p-2 text-2xs',
        documentation: 'text-xs',
        literalBadge: 'text-3xs',
        usedBySection: 'text-3xs',
        seeAlsoSection: 'text-3xs',
        seeAlsoRef: 'text-3xs'
      },
      md: {},
      lg: {
        codeBlock: 'p-4 text-sm',
        documentation: 'text-base',
        literalBadge: 'text-xs',
        usedBySection: 'text-xs',
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
/** The slot names `slotClasses` accepts. */
export type TypesReferenceSlots = SlotNames<typeof typesReferenceVariants>;
