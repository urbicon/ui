import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChatMessageData, ChatMessagePart, ChatRole } from '../chat.types';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { ChatMessageSlots, ChatMessageVariants } from './chat-message.variants';

/**
 * Per-part snippet overrides keyed by part `type`. When a renderer exists for a
 * part's type it replaces the built-in rendering for that part (one level up
 * from StreamingMarkdown's node `renderers`) — this is how P3 swaps in
 * ToolCallCard / ReasoningDisclosure and P4 adds A2UIView without touching this
 * component. `source` is intentionally not overridable here: sources are
 * collected into the citation footer, not rendered inline.
 */
export type ChatPartRenderers = {
  [K in Exclude<ChatMessagePart['type'], 'source'>]?: Snippet<
    [Extract<ChatMessagePart, { type: K }>]
  >;
};

/**
 * @description Renders one `ChatMessageData` — its ordered parts (markdown text via
 * StreamingMarkdown, reasoning, tool-call status lines, policy-checked attachment
 * chips) plus a citation footer, streaming placeholder, error/aborted Alert, a
 * hover-revealed copy/regenerate action bar and a timestamp. `layout="bubble"`
 * (default) tints and aligns per role; `layout="plain"` is a document-like
 * full-width Claude-style column. Untrusted URLs never render as inline media —
 * only as `urlPolicy`-checked download links. Compose many of these under
 * ChatMessageList; the consumer owns the `ChatMessageData[]`.
 *
 * @tag ai
 * @tag display
 * @related ChatMessageList
 * @related StreamingMarkdown
 * @stability experimental
 *
 * @example
 * ```svelte
 * <ChatMessage message={msg} onRegenerate={() => regenerate(msg.id)} />
 * ```
 */
export interface ChatMessageProps
  extends Omit<ChatMessageVariants, 'role'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** The message to render. The component never mutates it. */
  message: ChatMessageData;
  /**
   * URL policy applied to attachment links and forwarded to StreamingMarkdown /
   * CitationChip. Strict by default (untrusted LLM/server output). Keep it
   * referentially stable to avoid re-parsing streamed markdown.
   */
  urlPolicy?: MarkdownUrlPolicy;

  /** Provide to render a "Regenerate" action. Called on click. */
  onRegenerate?: () => void;
  /** Provide to render a "Retry" button in the error/aborted Alert. Called on click. */
  onRetry?: () => void;

  /** Avatar override. Receives the message role; default is the Avatar primitive with a role icon. */
  avatar?: Snippet<[{ role: ChatRole }]>;
  /** Action-bar override. Receives the message; default is copy (+ regenerate when `onRegenerate` is set). */
  actions?: Snippet<[{ message: ChatMessageData }]>;
  /** Metadata override. Receives the message; default is `createdAt` as a `<time>` element. */
  metadata?: Snippet<[{ message: ChatMessageData }]>;
  /** Per-part-type render overrides (see `ChatPartRenderers`). */
  partRenderers?: ChatPartRenderers;

  /** Display names per role, shown in the `plain`-layout header. */
  roleLabels?: Partial<Record<ChatRole, string>>;
  /** Accessible label / tooltip for the copy action. @default 'Copy message' */
  copyLabel?: string;
  /** Accessible label shown briefly after a successful copy. @default 'Copied' */
  copiedLabel?: string;
  /** Accessible label / tooltip for the regenerate action. @default 'Regenerate' */
  regenerateLabel?: string;
  /** Label for the retry button in the error/aborted Alert. @default 'Retry' */
  retryLabel?: string;
  /** Alert title for `status === 'error'`. @default 'Something went wrong' */
  errorLabel?: string;
  /** Alert title for `status === 'aborted'`. @default 'Generation stopped' */
  abortedLabel?: string;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: root | container | header | roleName | avatar |
   * bubble | partsFlow | reasoningBlock | reasoningHeader | reasoningText | toolCallRow |
   * toolCallName | toolCallError | attachment | attachmentIcon | attachmentName |
   * attachmentSize | sourcesFooter | placeholder | statusAlert | footer | actions |
   * actionButton | metadata
   */
  slotClasses?: Partial<Record<ChatMessageSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ChatMessage: {...} }}>`.
   * Prefer this over `class` overrides for reusable custom looks.
   */
  preset?: string;
}

export { default as ChatMessage } from './ChatMessage.svelte';
export {
  type ChatMessageSlots,
  type ChatMessageVariants,
  chatMessageVariants
} from './chat-message.variants';
