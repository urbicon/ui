import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const streamingMarkdownVariants = tv({
  slots: {
    // Inherits the surrounding type scale at `md` so chat surfaces stay in
    // control of the base font size; `sm` opts into a compact scale.
    base: 'min-w-0 break-words text-text-primary',
    paragraph: 'mt-4 leading-relaxed first:mt-0',
    heading1: 'mt-6 text-2xl font-semibold leading-tight first:mt-0',
    heading2: 'mt-6 text-xl font-semibold leading-tight first:mt-0',
    heading3: 'mt-5 text-lg font-semibold leading-snug first:mt-0',
    heading4: 'mt-5 text-base font-semibold leading-snug first:mt-0',
    heading5: 'mt-4 text-sm font-semibold first:mt-0',
    heading6: 'mt-4 text-sm font-medium text-text-secondary first:mt-0',
    inlineCode: 'rounded-modify bg-neutral-subtle px-1 py-0.5 font-mono text-[0.9em]',
    link: [
      'rounded-modify text-primary-text underline underline-offset-2',
      'hover:text-primary-emphasis',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    // Policy-blocked link: inert text, dotted underline as the "this was a
    // link" cue. The original URL never reaches the DOM.
    linkBlocked: 'text-text-secondary underline decoration-dotted underline-offset-2',
    image: 'mt-4 max-w-full rounded-contain border border-border-subtle first:mt-0',
    // Alt-text fallback chip for policy-blocked images.
    imageBlocked: [
      'mt-1 inline-flex max-w-full items-center gap-1.5 rounded-modify',
      'bg-neutral-subtle px-2 py-1 text-xs text-text-secondary'
    ],
    // Lists hug their introducing sentence (mt-2, not mt-4) — that is the
    // typographically correct rhythm and keeps nested lists compact too.
    listUnordered: 'mt-2 list-disc space-y-1 ps-5 marker:text-text-tertiary first:mt-0',
    listOrdered: 'mt-2 list-decimal space-y-1 ps-5 marker:text-text-tertiary first:mt-0',
    listItem: 'leading-relaxed',
    // Task items replace the list marker with a checkbox; -ms-5 cancels the
    // list padding so the checkbox sits where the marker was.
    taskItem: '-ms-5 flex list-none items-start gap-2 leading-relaxed',
    taskCheckbox: 'pointer-events-none mt-1 size-3.5 accent-primary',
    blockquote: 'mt-4 border-s-2 border-border-emphasis ps-4 text-text-secondary first:mt-0',
    codeBlock: 'mt-4 first:mt-0',
    tableWrapper: [
      'mt-4 overflow-x-auto rounded-contain border border-border-subtle first:mt-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    table: 'w-full border-collapse text-sm',
    tableRow: '',
    // Cell alignment comes from the column's delimiter row and is applied
    // per cell in the renderer (text-start/center/end), never here.
    tableHeadCell: 'border-b border-border-default bg-surface-elevated px-3 py-2 font-semibold',
    tableCell: 'border-b border-border-subtle px-3 py-2 align-top',
    hr: 'mt-6 border-t border-border-subtle first:mt-0',
    cursor: [
      '-mb-0.5 ms-0.5 inline-block h-[1em] w-0.5 bg-text-secondary',
      'motion-safe:animate-pulse'
    ]
  },
  variants: {
    size: {
      sm: {
        base: 'text-sm',
        heading1: 'text-xl',
        heading2: 'text-lg',
        heading3: 'text-base',
        heading4: 'text-sm',
        heading5: 'text-sm',
        heading6: 'text-xs'
      },
      md: {}
    }
  },
  defaultVariants: {
    size: 'md'
  }
});

export type StreamingMarkdownVariants = VariantProps<typeof streamingMarkdownVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type StreamingMarkdownSlots = SlotNames<typeof streamingMarkdownVariants>;
