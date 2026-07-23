<script lang="ts">
  import { StreamingMarkdown, type CitationSource } from '@urbicon-ui/blocks';

  // In a streamed answer you rarely construct chips yourself: StreamingMarkdown
  // wires them up from its `sources` prop. Each in-text [id] marker whose id
  // matches a source becomes a CitationChip automatically.
  const sources: CitationSource[] = [
    {
      id: '1',
      title: 'Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
      snippet: 'The Transformer, based solely on attention mechanisms.'
    }
  ];

  const content = 'Self-attention replaced recurrence in sequence models [1].';
</script>

<StreamingMarkdown {content} {sources} headingLevelStart={3} />
