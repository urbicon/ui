import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'ai-chat',
  category: 'AI',
  difficulty: 'Advanced',
  title: 'AI Chat',
  description:
    'A chat page that streams replies token by token: Chat, ChatMessageList and PromptInput over a SvelteKit endpoint relaying a model stream as server-sent events. The client posts the history, reads the response as a ReadableStream, and cancels mid-stream with an AbortController.',
  components: ['Chat', 'ChatMessageList', 'PromptInput', 'Card', 'Badge'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Chat pins the header and composer and scrolls only the log; it fills whatever box its host gives it, here an elevated Card with h-[34rem] and overflow-hidden.',
    'ChatMessageList follows the stream while the reader is at the bottom, breaks off on upward scroll, and offers a floating jump-back button with a new-message counter.',
    "PromptInput's send button flips to Stop while busy; onSubmit delivers { text, attachments }, onStop aborts the request.",
    'The server half is a SvelteKit POST +server.ts relaying an Anthropic SDK stream as text/event-stream; any provider fits, only the token-forwarding shape matters.',
    'The client reads the POST response as a ReadableStream and parses SSE frames itself; EventSource is GET-only and cannot carry the history body.',
    'Tokens append to the last assistant message by replacing the message object by id, never mutating it; status drives the live cursor and failure presentation: streaming, then complete, error or aborted.',
    "Stop is an AbortController on fetch's signal, and the route forwards the abort to the model stream; AbortError maps to status aborted, onRegenerate / onRetry drop the turn and re-send.",
    'The history snapshot is taken before the empty assistant turn is appended and drops text-less turns, so an aborted stream cannot wedge the next request.'
  ]
};
