import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChatMessageProps } from '../ChatMessage';
import type { ChatMessageData } from '../chat.types';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { ChatMessageListSlots } from './chat-message-list.variants';

/** Render context handed to the per-message override snippet. */
export interface ChatMessageListItemContext {
  message: ChatMessageData;
  index: number;
  isLast: boolean;
}

/**
 * @summary A conversation log that follows streaming output — and lets go the moment you scroll up.
 * @description Scrollable conversation log with a stick-to-bottom engine: follows
 * streaming content while the reader is at the bottom, breaks off on upward scroll,
 * and offers a floating jump-back button with a new-message counter. Anchors the
 * scroll position when older history is prepended. Announces generation start and
 * the completed answer once to screen readers instead of every token. Renders
 * ChatMessage per entry by default; override per message via the `message` snippet.
 *
 * @tag ai
 * @tag display
 * @related ChatMessage
 * @related Chat
 * @related PromptInput
 * @stability experimental
 *
 * @example
 * ```svelte
 * <ChatMessageList
 *   {messages}
 *   onRegenerate={(m) => regenerate(m.id)}
 *   onStickChange={(stuck) => (following = stuck)}
 * />
 * ```
 */
export interface ChatMessageListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * The conversation, oldest first. The component never mutates it. Note:
   * rest attributes (incl. a raw `onscroll`) land on the non-scrolling root —
   * observe follow-state via `onStickChange` instead.
   */
  messages: ChatMessageData[];

  /** Per-message renderer override. Default: `<ChatMessage>` wired with the props below. */
  message?: Snippet<[ChatMessageListItemContext]>;
  /** Empty-state content. Default: an EmptyState with `emptyTitle`/`emptyDescription`. */
  empty?: Snippet;

  /** URL policy handed to every default ChatMessage (links, citations, attachments). */
  urlPolicy?: MarkdownUrlPolicy;
  /** Part-renderer overrides handed to every default ChatMessage. */
  partRenderers?: ChatMessageProps['partRenderers'];
  /** Message layout handed to every default ChatMessage. */
  layout?: ChatMessageProps['layout'];
  /** Message density handed to every default ChatMessage. */
  density?: ChatMessageProps['density'];

  /** Regenerate handler — wired only to the last message when it is an assistant message. */
  onRegenerate?: (message: ChatMessageData) => void;
  /** Retry handler for messages in `error`/`aborted` status. */
  onRetry?: (message: ChatMessageData) => void;
  /** Fires when the list starts (`true`) or stops (`false`) following new content. */
  onStickChange?: (stuck: boolean) => void;

  /** Accessible name of the scrollable conversation region. */
  listLabel?: string;
  /** Accessible label of the jump button when there are no new messages. */
  scrollToBottomLabel?: string;
  /** Label suffix of the jump button while new messages are pending (prefixed with the count). */
  newMessagesLabel?: string;
  /** Screen-reader announcement when an assistant message starts streaming. */
  generatingLabel?: string;
  /** Screen-reader announcement when a stream ends in `error` without text. */
  errorLabel?: string;
  /** Screen-reader announcement when a stream ends in `aborted` without text. */
  abortedLabel?: string;
  /** Empty-state heading. */
  emptyTitle?: string;
  /** Empty-state description. */
  emptyDescription?: string;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: root | viewport | content | empty | newButton */
  slotClasses?: Partial<Record<ChatMessageListSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ ChatMessageList: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette.
   */
  preset?: string;
}

export { default as ChatMessageList } from './ChatMessageList.svelte';
export {
  type ChatMessageListVariants,
  chatMessageListVariants
} from './chat-message-list.variants';
export {
  appendedCount,
  classifyTransition,
  distanceFromBottom,
  type ListIdSnapshot,
  type ListTransition,
  resolveScrollIntent,
  type ScrollSnapshot
} from './chat-scroll';
