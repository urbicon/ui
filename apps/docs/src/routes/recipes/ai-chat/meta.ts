import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'ai-chat',
  category: 'AI',
  difficulty: 'Advanced',
  title: 'AI Chat',
  description:
    'A full streaming chat surface — Chat shell + ChatMessageList + PromptInput — wired to a SvelteKit SSE endpoint that relays a Claude/LLM stream. Client reads the response as a ReadableStream (POST body, not EventSource), appends tokens in place to the last assistant message, and stops mid-stream via an AbortController.',
  components: ['Chat', 'ChatMessageList', 'PromptInput'],
  features: [
    'Chat shell with pinned header, scrollable log, and pinned composer (min-h-0 chain, full height)',
    "ChatMessageList's stick-to-bottom engine: follows tokens at the bottom, breaks on upward scroll",
    'PromptInput composer with a send button that flips to Stop while a response streams',
    'SvelteKit +server.ts POST endpoint relaying an Anthropic stream as text/event-stream',
    'Client fetch + ReadableStream reader (POST body needed → not EventSource)',
    'In-place token append to the last assistant message (never mutate the array element)',
    'AbortController Stop → status "aborted"; onRegenerate / onRetry re-run the last turn',
    'Streaming lifecycle: streaming → complete / error / aborted'
  ]
};
