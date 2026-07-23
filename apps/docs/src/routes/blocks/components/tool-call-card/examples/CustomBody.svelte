<script lang="ts">
  import { Badge, ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';

  type SearchHit = { title: string; url: string; score: number };

  const call: ChatToolCallPart = {
    type: 'tool-call',
    id: 'search-3',
    name: 'web_search',
    state: 'complete',
    input: { query: 'oklch color space' },
    output: [
      { title: 'OKLCH in CSS: why we moved', url: 'example.com/oklch', score: 0.94 },
      { title: 'A perceptual color picker', url: 'example.com/picker', score: 0.87 },
      { title: 'Gamut mapping explained', url: 'example.com/gamut', score: 0.71 }
    ] satisfies SearchHit[]
  };
</script>

<!-- The children snippet replaces the default JSON body with a domain view of
     the same part — the header (status badge + tool name) stays intact. -->
<ToolCallCard toolCall={call}>
  {#snippet children(part)}
    {@const hits = (part.output ?? []) as SearchHit[]}
    <ul class="divide-border-subtle divide-y">
      {#each hits as hit (hit.url)}
        <li class="flex items-center justify-between gap-3 py-2">
          <div class="min-w-0">
            <p class="text-text-primary truncate text-sm font-medium">{hit.title}</p>
            <p class="text-text-tertiary truncate text-xs">{hit.url}</p>
          </div>
          <Badge intent="neutral" variant="soft" size="sm">
            {(hit.score * 100).toFixed(0)}%
          </Badge>
        </li>
      {/each}
    </ul>
  {/snippet}
</ToolCallCard>
