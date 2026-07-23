<script lang="ts">
  import { CitationChip, type CitationSource } from '@urbicon-ui/blocks';

  // Standalone reference list — no streamed message required. Each chip opens a
  // popover with the title, snippet, and a policy-checked outbound link.
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
    },
    {
      id: '3',
      title: 'Training language models to follow instructions',
      url: 'https://arxiv.org/abs/2203.02155',
      snippet: 'Human feedback aligns models with user intent.'
    }
  ];
</script>

<div class="flex flex-wrap items-center gap-2">
  <span class="text-text-tertiary text-sm">Sources:</span>
  {#each sources as source, i (source.id)}
    <CitationChip {source} index={i + 1} />
  {/each}
</div>
