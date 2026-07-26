import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const codeBlockVariants = tv({
  slots: {
    root: ['relative block w-full overflow-hidden box-border'],
    // Header only renders when there is something to show (label / lang / copy /
    // actions).
    header: ['flex items-center justify-between gap-2'],
    langLabel: ['text-xs text-text-tertiary select-none'],
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
      'm-0',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
    ],
    code: ['font-mono text-sm text-text-primary']
  },
  variants: {
    /**
     * `card` — the standalone block: own surface, own outline, own radius. This
     * is the right frame when the code sits directly in a reading flow (a fenced
     * block in streamed markdown).
     *
     * `plain` — the EMBEDDED block: no surface, no border, no radius, no padding
     * of its own. A card inside a card is the single loudest source of visual
     * noise in this family — nested outlines at the same radius, two header rows
     * and three divider lines for one JSON payload. When the parent already
     * frames the content (ToolCallCard), the code only needs its monospace face
     * to read as code. The parent owns the frame; the child owns the text.
     */
    variant: {
      card: {
        root: 'bg-surface-elevated border border-border-subtle rounded-contain',
        header: 'px-3 py-1.5 border-b border-border-subtle',
        langLabel: 'font-mono',
        pre: 'px-3 py-2.5'
      },
      plain: {}
    },
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
    variant: 'card',
    wrap: false
  }
});

export type CodeBlockVariants = VariantProps<typeof codeBlockVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type CodeBlockSlots = SlotNames<typeof codeBlockVariants>;
