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
    // Everything that belongs UNDER the bubble — citations, the error alert, the
    // footer — lives in this column, not as a sibling of `container`. It is what
    // makes those rows inherit the bubble's side: a user bubble sits right, so
    // its timestamp and citations must too. `items-*` per role does the aligning
    // (see the compounds), and the width cap lives here rather than on `bubble`
    // so an alert spans the column while the bubble still hugs its text.
    column: ['flex min-w-0 flex-col'],
    // The content bubble (bubble layout) / the full-width column (plain layout).
    bubble: ['min-w-0 max-w-full'],
    // Vertical stack of the rendered parts.
    partsFlow: ['flex min-w-0 flex-col'],
    // reasoning and tool-call parts render through ReasoningDisclosure /
    // ToolCallCard (own slotClasses there); override via partRenderers.
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
    // status alert — stretches across the column (the bubble hugs its text, an
    // error does not).
    statusAlert: ['mt-1 w-full'],
    // Footer row holding actions + metadata. Its height is set by the metadata
    // line (`min-h-5`), NOT by the action buttons: those are `opacity-0` until
    // hover/focus, so letting them size the row reserved ~28px of blank strip
    // under every single message. `-my-1` below lets them overhang the shorter
    // row instead of growing it.
    footer: ['flex min-h-5 items-center gap-2'],
    actions: [
      'flex items-center gap-1 -my-1 opacity-0',
      'transition-opacity duration-[var(--blocks-duration-fast)] ease-out',
      'group-hover/message:opacity-100 group-focus-within/message:opacity-100'
    ],
    // Renders through CoreIconButton, so this carries only what the core does not
    // supply — no flex centring, cursor or `focus-visible:outline-none` here (the
    // core has no variant engine, so a repeat would resolve by stylesheet order).
    actionButton: [
      'rounded-modify p-1.5',
      'text-text-tertiary',
      'transition-[color,background-color] duration-[var(--blocks-duration-fast)] ease-out',
      'hover:bg-surface-hover hover:text-text-primary',
      'focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
    ],
    metadata: ['text-xs text-text-tertiary']
  },
  variants: {
    layout: {
      bubble: {},
      // Document-like: full-width content under an avatar + role header row.
      plain: {
        column: 'w-full items-stretch',
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
        column: 'gap-1.5',
        partsFlow: 'gap-2'
      },
      compact: {
        root: 'gap-1',
        column: 'gap-1',
        partsFlow: 'gap-1.5'
      }
    }
  },
  compoundVariants: [
    // ── bubble layout: role tint + alignment ────────────────────────────────
    // Bubbles ride the BRIDGE tier, not `contain`. `contain` (2 px) is the
    // architectural-panel radius — correct on a 600 px Card, where it reads as
    // a precise edge, but on a ~200 px bubble the same 2 px reads as a plain
    // rectangle. Optical radius scales with the area it turns. `bridge` (6 px)
    // is the middle tier and stays brand-themeable, so a consumer retunes
    // bubbles via `--radius-bridge` instead of overriding this slot.
    {
      layout: 'bubble' as const,
      role: 'user' as const,
      class: {
        // Reverse so the (avatar-less) column packs to the right edge, and
        // right-align its rows so timestamp + citations hang off the same edge
        // as the bubble instead of drifting to the left margin.
        container: 'flex-row-reverse',
        column: 'max-w-[85%] items-end',
        bubble: 'rounded-bridge bg-primary-subtle',
        // Metadata comes first in the DOM so it can sit against the bubble edge;
        // reversing here puts that edge on the right for a user message while
        // keeping the action bar on the inside.
        footer: 'flex-row-reverse'
      }
    },
    {
      layout: 'bubble' as const,
      role: 'assistant' as const,
      class: {
        column: 'max-w-[85%] items-start',
        bubble: 'rounded-bridge bg-surface-elevated'
      }
    },
    {
      layout: 'bubble' as const,
      role: 'system' as const,
      class: {
        container: 'justify-center',
        column: 'max-w-[90%] items-center',
        bubble:
          'rounded-bridge border border-border-subtle bg-surface-base text-sm text-text-secondary'
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
