import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const codeBlockVariants = tv({
  slots: {
    // Architectural surface — an elevated card, structure radius, clipped so the
    // scrollable body respects the rounded corners.
    root: [
      'relative block w-full overflow-hidden box-border',
      'bg-surface-elevated border border-border-subtle rounded-contain'
    ],
    // Header only renders when there is something to show (lang / copy / actions).
    header: [
      'flex items-center justify-between gap-2',
      'px-3 py-1.5 border-b border-border-subtle'
    ],
    langLabel: ['font-mono text-xs text-text-tertiary select-none'],
    copyButton: [
      'inline-flex items-center gap-1.5',
      'px-2 py-1 rounded-modify',
      'font-mono text-xs text-text-secondary',
      'cursor-pointer select-none',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
    ],
    // The scrollable region. Body horizontal scroll stays INSIDE the block —
    // never the page. Focusable + role=region so keyboard users can reach the
    // scroll (a11y for scrollable content).
    pre: [
      'm-0 px-3 py-2.5',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
    ],
    code: ['font-mono text-sm text-text-primary']
  },
  variants: {
    // false → single-line semantics, horizontal scroll inside the block.
    // true  → soft-wrap long lines, no horizontal scroll.
    wrap: {
      true: {
        pre: 'whitespace-pre-wrap break-words',
        code: 'whitespace-pre-wrap break-words'
      },
      false: {
        pre: 'overflow-x-auto',
        code: 'whitespace-pre'
      }
    }
  },
  defaultVariants: {
    wrap: false
  }
});

export type CodeBlockVariants = VariantProps<typeof codeBlockVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type CodeBlockSlots = SlotNames<typeof codeBlockVariants>;
