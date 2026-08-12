import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const toolCallCardVariants = tv({
  slots: {
    // The whole card header IS the collapsible trigger button. Collapsible's
    // card variant only styles the DEFAULT trigger; a custom trigger snippet
    // replaces it, so the horizontal padding / focus ring live here.
    trigger: [
      'group/toolcall items-center gap-2 text-left cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)] ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],
    // Status indicator + tool name; min-w-0 lets the mono name truncate.
    triggerLeft: 'flex items-center gap-2 min-w-0',
    // Status + chevron; never shrinks so the name gives way first.
    triggerRight: 'flex items-center gap-2 shrink-0',
    // Inline busy indicator (CoreSpinner wrapper) — tint via text-current.
    spinner: 'shrink-0',
    // The invoked tool's identifier, monospaced.
    toolName: 'font-mono text-sm truncate',
    // Plain-text status in the `plain` header (the `card` header uses a Badge).
    statusText: 'text-xs',
    // Chevron mirrors Collapsible's own spin timing so both animate in sync.
    chevron: [
      'shrink-0',
      'transition-transform duration-[var(--blocks-collapse-duration)] ease-[var(--blocks-collapse-easing)]',
      'motion-reduce:duration-[1ms]'
    ],
    // Default body wrapper (input/output sections + error line).
    body: 'flex flex-col gap-3',
    // One payload block. The caption lives in the CodeBlock's own header (it is
    // passed as `label`), so this is a plain positioning wrapper — no heading row
    // of its own, which is what removed a whole chrome level from the card.
    section: 'flex flex-col',
    // Error message line shown above the sections.
    errorMessage: 'text-sm text-danger-text'
  },
  variants: {
    /**
     * `plain` — the default, and the same word CodeBlock uses for the same idea:
     * no surface, no outline, no radius. A tool call is machinery, not content —
     * the reader of a chat wants the answer and only occasionally what produced
     * it — so the header is one muted row in the message flow, as wide as its
     * own text, in the register ReasoningDisclosure uses one line up: tertiary
     * ink for the whole row, hovering to `primary-text`.
     *
     * Why the row carries ONE colour rather than a shade per part: a hover that
     * only some children opt into is a hover the reader has to hunt for, and the
     * two neighbouring ink steps (secondary/tertiary) are the same value in dark
     * mode, so a `secondary → tertiary` shift is invisible there. Monospace and
     * size carry the hierarchy instead; `error` is the one state that takes a
     * colour of its own.
     *
     * `card` — the framed header: outline, radius, shadow, status Badge, the
     * container's full width. The right pick where the call IS the content — an
     * agent trace, a tool-run log, a debugging view — and wrong wherever a
     * reader is following prose.
     */
    variant: {
      plain: {
        // inline-flex + w-fit: the row is as wide as its own text (up to
        // `max-w-full`), so a tool call reads as an aside in the flow rather
        // than as a full-width band. The width only matters when a consumer
        // makes the Collapsible root a flex/grid container — in normal flow the
        // button is inline-level and shrink-to-fit anyway.
        // The focus ring is rounded here (the row has no radius of its own);
        // the card header rounds with its frame instead (compound below).
        trigger: [
          'inline-flex w-fit max-w-full py-1',
          'text-text-tertiary hover:text-primary-text',
          'focus-visible:rounded-sm'
        ],
        chevron: 'w-3.5 h-3.5',
        // The payload is indented against the message text it interrupts, so
        // where it starts and where the answer resumes stays readable without
        // drawing a box around it.
        body: 'pt-1 pl-3'
      },
      card: {
        trigger: [
          'flex w-full justify-between px-4 py-2',
          'text-text-primary hover:bg-surface-hover'
        ],
        toolName: 'text-text-secondary',
        spinner: 'text-text-tertiary',
        chevron: 'w-4 h-4 text-text-tertiary'
      }
    },
    /**
     * Mirrors the disclosure state. It spins the chevron, and it is what lets
     * the card header round its hover fill with the frame — see the compound
     * rules. It lives here rather than as a class passed in from the component
     * so that a `slotClasses` override lands in a LATER source than the radius
     * and can therefore strip it; within one source the CSS cascade decides,
     * which made a consumer's `rounded-*` win or lose by alphabet.
     */
    open: {
      true: { chevron: 'rotate-180' },
      false: {}
    },
    /**
     * The call's lifecycle state, mirrored from `toolCall.state`. Only `error`
     * takes a colour of its own. Named `callState` rather than `state` because
     * the docs playground already exposes a demo knob called `state` that swaps
     * the whole `toolCall` — two different things, and the knob lint is right to
     * refuse a component axis of the same name.
     */
    callState: {
      pending: {},
      running: {},
      complete: {},
      error: { statusText: 'text-danger-text' }
    }
  },
  compoundVariants: [
    // The card header is a rectangle sitting inside a rounded, un-clipped frame,
    // so its hover fill has to carry the frame's radius itself — otherwise the
    // fill squares off the corners it sits in, which is invisible at the default
    // 2px `--radius-contain` and glaring in a theme that rounds containers.
    // Collapsed the header IS the frame (all four corners); open, only the top
    // two, because the body continues the same fill area below. Clipping the
    // frame instead (`overflow-hidden`) is not an option: the trigger's border
    // box IS the frame's padding box, and its focus ring is an offset-less
    // `ring-2`, i.e. a box-shadow entirely outside that box — clipping erases
    // it (measured). Library panels would survive the clip, since they render
    // in the top layer via the popover API, but a hand-built absolute overlay
    // in a `children` snippet would not.
    { variant: 'card', open: false, class: { trigger: 'rounded-contain' } },
    { variant: 'card', open: true, class: { trigger: 'rounded-t-contain' } }
  ],
  defaultVariants: {
    variant: 'plain',
    open: false,
    callState: 'pending'
  }
});

export type ToolCallCardVariants = VariantProps<typeof toolCallCardVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ToolCallCardSlots = SlotNames<typeof toolCallCardVariants>;
