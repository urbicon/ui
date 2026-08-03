import { type SlotNames, tv, type VariantProps } from '@urbicon-ui/blocks';

/**
 * The card of titled notes that closes almost every documentation page.
 *
 * The markup this replaces was hand-copied 101 times across 79 files, and it
 * carried 223 notes across 60 of them — the two counts have different bases,
 * because 19 of those files use the divider for something other than a note
 * (settings rows, recipe lists). An earlier version of this comment read
 * "79 files (223 notes)", which glues one measurement's file count to the
 * other's item count.
 *
 * The row padding was written positionally — `pb-4` on the first row, `py-4`
 * in the middle, `pt-4` on the last. That is a computed property, so it is
 * computed here: `py-4 first:pt-0 last:pb-0` produces the identical box on
 * every row without the author having to know where the row sits.
 */
export const noteListVariants = tv({
  slots: {
    root: ['rounded-2xl border border-border-subtle bg-surface-elevated p-6'],
    list: ['divide-y divide-border-subtle']
  },
  variants: {
    /**
     * `flush` drops the card chrome for a note list that already sits inside a
     * bordered surface — the rules between rows stay, the second border goes.
     */
    variant: {
      card: {},
      flush: { root: 'rounded-none border-0 bg-transparent p-0' }
    }
  },
  defaultVariants: {
    variant: 'card'
  }
});

/**
 * A single row. The prose tokens sit on the row rather than on an inner
 * paragraph wrapper, so a note can hold a `<ul>` or a second `<p>` without the
 * component having to guess which block element the author wanted.
 */
export const noteVariants = tv({
  slots: {
    root: ['py-4 first:pt-0 last:pb-0 text-sm leading-relaxed text-text-secondary'],
    title: ['mb-1.5 text-sm font-semibold leading-normal text-text-primary']
  }
});

export type NoteListVariantProps = VariantProps<typeof noteListVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type NoteListSlots = SlotNames<typeof noteListVariants>;

export type NoteVariantProps = VariantProps<typeof noteVariants>;
/** Slot names derived from the `tv()` config above — single source of truth for `slotClasses`. */
export type NoteSlots = SlotNames<typeof noteVariants>;
