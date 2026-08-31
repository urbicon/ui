import type { HTMLAttributes } from 'svelte/elements';
import type { ChatReasoningPart } from '../chat.types';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { ReasoningDisclosureSlots } from './reasoning-disclosure.variants';

/**
 * @summary The model's thinking, folded away until someone wants to look.
 * @description Default renderer for `reasoning` parts in ChatMessage. Wraps a
 * model's thinking trace in a collapsed, muted disclosure: the header shows a
 * state label ("Thinking" while streaming, "Thought for Xs" once settled with a
 * duration, otherwise "Reasoning"), the body renders the reasoning text through
 * StreamingMarkdown in a damped tertiary tone, indented rather than boxed. Stays
 * collapsed by default — including while streaming — so a growing reasoning
 * trace never steals the answer's space; the caller drives the `streaming` flag
 * (the part carries no status). Renders in the same register as ToolCallCard's
 * default header: both report how an answer came about, and a reader should be
 * able to tell at a glance that they are the same kind of thing.
 * @tag ai
 * @related ChatMessage
 * @related ToolCallCard
 * @related StreamingMarkdown
 * @stability experimental
 *
 * @example
 * ```svelte
 * <ReasoningDisclosure
 *   reasoning={{ type: 'reasoning', text: model.reasoning, durationMs: 2400 }}
 *   streaming={message.status === 'streaming'}
 * />
 * ```
 */
export interface ReasoningDisclosureProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
  /** The reasoning part to render (`{ type: 'reasoning'; text; durationMs? }`). Required. */
  reasoning: ChatReasoningPart;
  /**
   * The reasoning trace is currently growing. Drives the "Thinking" label and
   * its pulse; supplied by the caller (the part itself carries no status).
   * @default false
   * @summary Whether the trace is still growing, which drives the Thinking label and its pulse.
   */
  streaming?: boolean;
  /**
   * Whether the disclosure is expanded. Supports `bind:open`. Passing `open`
   * without `bind:` requires mirroring every `onOpenChange` back into your state.
   */
  open?: boolean;
  /**
   * Initial expanded state for uncontrolled usage. Reasoning stays collapsed by
   * default, even while streaming.
   * @default false
   */
  defaultOpen?: boolean;
  /** Fires once per trigger-driven open transition, after the state is applied. */
  onOpenChange?: (open: boolean) => void;
  /**
   * URL policy passed through to the inner StreamingMarkdown for any links in
   * the reasoning text (same strict default — untrusted model output).
   */
  urlPolicy?: MarkdownUrlPolicy;
  /**
   * Header label while `streaming`.
   * @default 'Thinking'
   */
  thinkingLabel?: string;
  /**
   * Header label once settled without a `durationMs`.
   * @default 'Reasoning'
   */
  reasoningLabel?: string;
  /**
   * Header label once settled with a `durationMs`, receiving whole seconds
   * (`Math.round(durationMs / 1000)`).
   * @default (s) => `Thought for ${s}s`
   */
  formatDuration?: (seconds: number) => string;

  /** Extra classes merged onto the root (the underlying Collapsible base). */
  class?: string;
  /** Strip the tv() classes of this component (trigger/label/chevron/content), of the Collapsible it renders and of the markdown body; the collapse mechanics stay. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: `trigger` (header button), `label` (state label), `chevron`, `content` (markdown wrapper). */
  slotClasses?: Partial<Record<ReasoningDisclosureSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ReasoningDisclosure: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette.
   */
  preset?: string;
}

export { default as ReasoningDisclosure } from './ReasoningDisclosure.svelte';
export {
  type ReasoningDisclosureSlots,
  type ReasoningDisclosureVariants,
  reasoningDisclosureVariants
} from './reasoning-disclosure.variants';
