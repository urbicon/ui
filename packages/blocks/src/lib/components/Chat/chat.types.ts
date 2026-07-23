// Chat conversation data model — the contract between a consumer's transport
// layer (SSE/fetch/websocket) and the Chat family's rendering components.
//
// Deliberately NOT a store: the consumer owns `ChatMessageData[]` (typically
// `$state` + appends from a stream) and passes it down. Components never
// mutate messages.

import type { CitationSource } from './CitationChip';

/** Author of a chat message. */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Lifecycle of a message. `streaming` drives the live-rendering affordances
 * (markdown tail repair, cursor, deferred screen-reader announcement);
 * `error` / `aborted` switch the message to its failure presentation.
 * A message without a status counts as `complete`.
 */
export type ChatMessageStatus = 'streaming' | 'complete' | 'error' | 'aborted';

/**
 * One renderable segment of a message. Mirrors the shape of modern
 * model/tool transcripts: interleaved text, reasoning, tool calls, sources
 * and attachments — rendered in order by the ChatMessage component.
 */
export type ChatMessagePart =
  /** Markdown text, rendered through StreamingMarkdown. */
  | { type: 'text'; text: string }
  /** Model reasoning. Collapsed, tertiary presentation; `durationMs` feeds the "Thought for Xs" label. */
  | { type: 'reasoning'; text: string; durationMs?: number }
  /** A tool invocation with its lifecycle state. P2 renders a compact status line; ToolCallCard (P3) takes over via `partRenderers`. */
  | {
      type: 'tool-call';
      id: string;
      name: string;
      state: 'pending' | 'running' | 'complete' | 'error';
      input?: unknown;
      output?: unknown;
      errorMessage?: string;
    }
  /** A cited source. Same shape as CitationSource — also feeds StreamingMarkdown's `sources` for `[id]` markers. */
  | ({ type: 'source' } & CitationSource)
  /**
   * A file attached to the message. `url` is only ever rendered as a
   * policy-checked download link (never as an inline image/iframe) — LLM- or
   * server-supplied URLs are untrusted input.
   */
  | { type: 'attachment'; name: string; mimeType: string; size?: number; url?: string }
  /** Declarative A2UI payload (P4). Validated fail-loud by A2UIView; ignored by default renderers until then. */
  | { type: 'a2ui'; payload: unknown };

/**
 * One message in a conversation. Named `ChatMessageData` because the value
 * export `ChatMessage` is the component that renders it.
 */
export interface ChatMessageData {
  /** Stable unique id — keyed `{#each}` identity, never an array index. */
  id: string;
  role: ChatRole;
  /** Ordered renderable segments. A plain text answer is `[{ type: 'text', text }]`. */
  parts: ChatMessagePart[];
  createdAt?: Date;
  /** Omitted counts as `complete`. */
  status?: ChatMessageStatus;
  /** Consumer-defined extras (model name, token counts, …). Not rendered by defaults. */
  metadata?: Record<string, unknown>;
}
