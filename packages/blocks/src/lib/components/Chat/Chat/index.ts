import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ChatSlots, ChatVariants } from './chat.variants';

/**
 * @summary The full-height shell of a chat: pinned header, scrolling conversation, composer at the bottom.
 * @description Thin full-height layout shell for a chat surface: an optional pinned
 * `header` (border-b), the scrollable conversation area as `children` (the consumer
 * drops a ChatMessageList here — the shell itself never scrolls, the body child does),
 * and an optional pinned `composer` at the bottom (border-t, e.g. PromptInput). No
 * state, no context, no provider — pure structure with `min-h-0` flex discipline so it
 * fills its parent and hands scrolling to its body.
 *
 * @tag ai
 * @tag layout
 * @related ChatMessageList
 * @related PromptInput
 * @stability experimental
 *
 * @example
 * ```svelte
 * <Chat>
 *   {#snippet header()}<Toolbar>…</Toolbar>{/snippet}
 *   <ChatMessageList {messages} />
 *   {#snippet composer()}<PromptInput onSubmit={send} />{/snippet}
 * </Chat>
 * ```
 */
export interface ChatProps
  extends ChatVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  /** The scrollable conversation area — typically a ChatMessageList. */
  children?: Snippet;
  /** Optional pinned header rendered above the conversation (border-b). */
  header?: Snippet;
  /** Optional pinned composer rendered below the conversation (border-t) — e.g. PromptInput. */
  composer?: Snippet;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: root | header | body | composer */
  slotClasses?: Partial<Record<ChatSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Chat: {...} }}>`.
   * Prefer this over `class` overrides for reusable custom looks.
   */
  preset?: string;
}

export { default as Chat } from './Chat.svelte';
export { type ChatSlots, type ChatVariants, chatVariants } from './chat.variants';
