import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const chatMessageVariants = tv({
  slots: {
    // Group scope drives the hover/focus reveal of the action bar. `min-w-0`
    // so long code/markdown scrolls inside the message, never the page.
    root: ['group/message flex w-full min-w-0 flex-col'],
    // Bubble layout: avatar beside the bubble. Plain layout ignores this and
    // uses `header` + `content` instead.
    container: ['flex min-w-0 items-start gap-3'],
    // Plain-layout header row: avatar + role name above the full-width content.
    header: ['flex min-w-0 items-center gap-2'],
    roleName: ['text-sm font-medium text-text-secondary select-none'],
    avatar: ['shrink-0'],
    // The content bubble (bubble layout) / the full-width column (plain layout).
    bubble: ['min-w-0 max-w-full'],
    // Vertical stack of the rendered parts.
    partsFlow: ['flex min-w-0 flex-col'],
    // reasoning
    reasoningBlock: [
      'flex flex-col gap-1 rounded-modify border border-border-subtle bg-surface-base px-3 py-2'
    ],
    reasoningHeader: ['text-xs font-medium text-text-tertiary select-none'],
    reasoningText: ['whitespace-pre-wrap text-sm text-text-tertiary'],
    // tool-call
    toolCallRow: [
      'flex flex-wrap items-center gap-2 rounded-modify border border-border-subtle bg-surface-base px-2.5 py-1.5'
    ],
    toolCallName: ['font-mono text-sm text-text-secondary'],
    toolCallError: ['w-full text-xs text-danger'],
    // attachments
    attachment: [
      'inline-flex max-w-full items-center gap-2 rounded-modify border border-border-subtle bg-surface-base px-2.5 py-1.5 text-sm no-underline',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out'
    ],
    attachmentIcon: ['shrink-0 text-text-tertiary'],
    attachmentName: ['min-w-0 truncate text-text-primary'],
    attachmentSize: ['shrink-0 text-xs text-text-tertiary'],
    // sources footer
    sourcesFooter: ['flex flex-wrap items-center gap-1.5 pt-1'],
    // streaming placeholder (zero parts)
    placeholder: ['py-1'],
    // status alert
    statusAlert: ['mt-1'],
    // footer row holding actions + metadata
    footer: ['flex items-center gap-2'],
    actions: [
      'flex items-center gap-1 opacity-0',
      'transition-opacity duration-[var(--blocks-duration-fast)] ease-out',
      'group-hover/message:opacity-100 group-focus-within/message:opacity-100'
    ],
    actionButton: [
      'inline-flex items-center justify-center rounded-modify p-1.5',
      'text-text-tertiary cursor-pointer',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
    ],
    metadata: ['text-xs text-text-tertiary']
  },
  variants: {
    layout: {
      bubble: {},
      // Document-like: full-width content under an avatar + role header row.
      plain: {
        bubble: 'w-full',
        partsFlow: 'gap-3'
      }
    },
    role: {
      user: {},
      assistant: {},
      system: {}
    },
    density: {
      comfortable: {
        root: 'gap-1.5',
        partsFlow: 'gap-2'
      },
      compact: {
        root: 'gap-1',
        partsFlow: 'gap-1.5'
      }
    }
  },
  compoundVariants: [
    // ── bubble layout: role tint + alignment ────────────────────────────────
    {
      layout: 'bubble' as const,
      role: 'user' as const,
      class: {
        // Reverse so the (avatar-less) bubble packs to the right edge.
        container: 'flex-row-reverse',
        bubble: 'max-w-[85%] rounded-contain bg-primary-subtle'
      }
    },
    {
      layout: 'bubble' as const,
      role: 'assistant' as const,
      class: {
        bubble: 'max-w-[85%] rounded-contain bg-surface-elevated'
      }
    },
    {
      layout: 'bubble' as const,
      role: 'system' as const,
      class: {
        container: 'justify-center',
        bubble:
          'max-w-[90%] rounded-contain border border-border-subtle bg-surface-base text-sm text-text-secondary'
      }
    },
    // ── bubble layout: density padding ──────────────────────────────────────
    {
      layout: 'bubble' as const,
      density: 'comfortable' as const,
      class: { bubble: 'px-3.5 py-2.5' }
    },
    {
      layout: 'bubble' as const,
      density: 'compact' as const,
      class: { bubble: 'px-3 py-2' }
    }
  ],
  defaultVariants: {
    layout: 'bubble',
    role: 'assistant',
    density: 'comfortable'
  }
});

export type ChatMessageVariants = VariantProps<typeof chatMessageVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ChatMessageSlots = SlotNames<typeof chatMessageVariants>;
