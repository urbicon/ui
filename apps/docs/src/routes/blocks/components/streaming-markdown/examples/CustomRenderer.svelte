<script lang="ts">
  import { StreamingMarkdown } from '@urbicon-ui/blocks';

  const content = `Fenced code flows through your own renderer:

\`\`\`ts
export const answer = 42;
\`\`\`
`;
</script>

<!--
  A `renderers` snippet fully replaces the built-in renderer for one node type —
  the hook point for syntax highlighting, lightboxes, or router-aware links,
  without pulling any of those into the core. Here: a custom code presentation.
-->
{#snippet codeBlock({ code, lang }: { code: string; lang?: string; open?: boolean })}
  <div class="border-primary/40 rounded-contain mt-4 overflow-hidden border first:mt-0">
    <div class="bg-primary-subtle flex items-center justify-between px-3 py-1.5">
      <span class="text-primary font-mono text-xs">{lang ?? 'code'}</span>
      <span class="text-text-tertiary text-xs">custom renderer</span>
    </div>
    <pre class="text-text-primary overflow-x-auto px-3 py-2.5 font-mono text-sm">{code}</pre>
  </div>
{/snippet}

<StreamingMarkdown {content} renderers={{ codeBlock }} headingLevelStart={3} />
