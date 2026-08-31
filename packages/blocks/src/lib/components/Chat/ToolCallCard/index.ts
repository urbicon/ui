import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChatToolCallPart } from '../chat.types';
import type { ToolCallCardSlots } from './tool-call-card.variants';

/**
 * @summary What the agent called, and what came back.
 * @description Collapsible disclosure for one agent tool-call part (`type: 'tool-call'`)
 * — a status indicator + monospaced tool name in the header, and the JSON input/output (or an
 * error message) in the expandable body. It is the default renderer ChatMessage reaches for on
 * `tool-call` parts (wire it in via `partRenderers`). By default it renders `plain`: one muted
 * line in the message flow, in the same register as ReasoningDisclosure, because a reader
 * following prose is not reading the machinery. Switch to `variant="card"` where the call is
 * the content — an agent trace, a tool-run log.
 * Opens itself when a call fails so the error is visible without a click; a manual toggle always
 * wins afterwards. Pass a `children` snippet to replace the default JSON body with a
 * domain-specific view of the same part.
 * @tag ai
 * @related ChatMessage
 * @related ReasoningDisclosure
 * @related CodeBlock
 * @stability experimental
 *
 * @example
 * ```svelte
 * <ToolCallCard toolCall={part} />
 * ```
 *
 * @example The framed header, for a trace view where the call is the content
 * ```svelte
 * <ToolCallCard toolCall={part} variant="card" />
 * ```
 *
 * @example Domain-specific body via the children snippet
 * ```svelte
 * <ToolCallCard {toolCall}>
 *   {#snippet children(call)}
 *     <WeatherResult data={call.output} />
 *   {/snippet}
 * </ToolCallCard>
 * ```
 */
export interface ToolCallCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
  /** The tool-call part to render. Required. */
  toolCall: ChatToolCallPart;
  /**
   * How prominent the header is. `plain` is one muted line in the message
   * flow, with no outline, surface, or badge, as wide as its own text. `card`
   * is a framed header (outline, radius, shadow, status badge, the container's
   * full width) for surfaces where the tool call is the subject.
   * @summary A muted line in the message flow, or a framed header for a trace view.
   * @default 'plain'
   */
  variant?: 'plain' | 'card';
  /**
   * Whether the card is expanded. Supports `bind:open`. Left uncontrolled, the
   * card starts collapsed for `pending` / `running` / `complete` and expanded
   * for `error`.
   */
  open?: boolean;
  /**
   * Initial expanded state for uncontrolled usage. Defaults to `true` when the
   * call is already in the `error` state, `false` otherwise.
   */
  defaultOpen?: boolean;
  /** Fired once per toggle, after the new open state is applied. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Replace the default JSON input/output body with a custom rendering of the
   * tool-call part. Receives the same `toolCall`. When provided, the built-in
   * error line + input/output sections are not rendered.
   */
  children?: Snippet<[ChatToolCallPart]>;

  /** Header status label for the `pending` state. @default 'Pending' */
  pendingLabel?: string;
  /** Header status label for the `running` state. @default 'Running' */
  runningLabel?: string;
  /** Header status label for the `complete` state. @default 'Done' */
  completeLabel?: string;
  /** Header status label for the `error` state. @default 'Failed' */
  errorLabel?: string;
  /** Caption in the input payload's header. @default 'Input' */
  inputLabel?: string;
  /** Caption in the output payload's header. @default 'Output' */
  outputLabel?: string;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Strip the component's default tv() classes, the underlying Collapsible's and the status Badge's. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: `trigger` (header button), `triggerLeft`,
   * `triggerRight`, `spinner`, `toolName`, `statusText` (the plain header's
   * status; `card` uses a Badge instead), `chevron`, `body`, `section`,
   * `errorMessage`. The payloads render as `variant="plain"` CodeBlocks — style
   * those through `<BlocksProvider presets={{ CodeBlock: {...} }}>`.
   */
  slotClasses?: Partial<Record<ToolCallCardSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ToolCallCard: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette.
   */
  preset?: string;
}

export { default as ToolCallCard } from './ToolCallCard.svelte';
export {
  type ToolCallCardSlots,
  type ToolCallCardVariants,
  toolCallCardVariants
} from './tool-call-card.variants';
