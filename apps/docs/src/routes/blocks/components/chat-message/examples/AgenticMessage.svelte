<script lang="ts">
  import { ChatMessage, type ChatMessageData } from '@urbicon-ui/blocks';

  // A single assistant message whose ordered parts exercise the whole dispatch:
  // reasoning → tool-call → text, with two sources collected into the footer.
  const message: ChatMessageData = {
    id: 'agentic-1',
    role: 'assistant',
    parts: [
      {
        type: 'reasoning',
        text: 'The user wants sources. Look up the attention paper and the scaling-laws work, then cite both inline.',
        durationMs: 2400
      },
      {
        type: 'tool-call',
        id: 'tc-search',
        name: 'search_papers',
        state: 'complete',
        input: { query: 'transformer attention scaling laws' },
        output: { hits: 2 }
      },
      {
        type: 'text',
        text: 'The Transformer replaced recurrence with self-attention [1], and later work showed its performance scales predictably with compute [2].'
      },
      {
        type: 'source',
        id: '1',
        title: 'Attention Is All You Need',
        url: 'https://arxiv.org/abs/1706.03762',
        snippet: 'We propose a new simple network architecture, the Transformer.'
      },
      {
        type: 'source',
        id: '2',
        title: 'Scaling Laws for Neural Language Models',
        url: 'https://arxiv.org/abs/2001.08361',
        snippet: 'Performance improves smoothly with model size, data and compute.'
      }
    ],
    createdAt: new Date('2026-01-01T09:41:00'),
    status: 'complete'
  };
</script>

<div class="w-full max-w-2xl">
  <ChatMessage {message} layout="plain" onRegenerate={() => {}} />
</div>
