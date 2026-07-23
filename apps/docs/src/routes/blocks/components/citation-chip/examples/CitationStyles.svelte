<script lang="ts">
  import { CitationChip, type CitationSource } from '@urbicon-ui/blocks';

  const source: CitationSource = {
    id: '1',
    title: 'Attention Is All You Need',
    url: 'https://arxiv.org/abs/1706.03762',
    snippet: 'The Transformer, based solely on attention mechanisms.'
  };
</script>

<div class="flex flex-wrap items-center gap-3">
  <!-- numeric: a compact footnote pill for dense inline citations. -->
  <CitationChip {source} index={1} citationStyle="numeric" />
  <!-- label: the (truncated) title, for named sources in a footer or sidebar. -->
  <CitationChip {source} index={1} citationStyle="label" />
</div>
