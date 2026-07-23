<script lang="ts">
  import { StreamingMarkdown, type CitationSource } from '@urbicon-ui/blocks';

  // Ids activate the matching `[id]` markers in the text; the markers render as
  // CitationChip (1-based, in array order). `[3]` below has no source, so it
  // stays plain text — prose like "step [3]" is never mangled.
  const sources: CitationSource[] = [
    {
      id: '1',
      title: 'Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
      snippet: 'The Transformer, based solely on attention mechanisms.'
    },
    {
      id: '2',
      title: 'Scaling Laws for Neural Language Models',
      url: 'https://arxiv.org/abs/2001.08361',
      snippet: 'Quality improves smoothly with model size, dataset size, and compute.'
    }
  ];

  const content = `Transformers replaced recurrence with self-attention [1], and later
work mapped how quality scales with model and dataset size [2]. A bare marker
like [3] with no matching source stays plain text.`;
</script>

<StreamingMarkdown {content} {sources} headingLevelStart={3} />
