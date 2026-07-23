<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { StreamingMarkdown, Button } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];

  // Live streaming demo — the content prop grows over time exactly as a chat
  // surface would drive it from a model stream. Settled blocks never re-render.
  const DEMO = `## Streaming answer

The renderer parses **markdown** as it arrives — settled blocks are cached and
never re-render, so a long answer stays cheap to append to.

- Zero \`{@html}\`, safe by construction
- Strict URL policy on by default

\`\`\`ts
for await (const chunk of stream) render(chunk);
\`\`\`
`;

  // Word-ish chunks (1–3 tokens), close to how model output actually arrives.
  const chunks = (() => {
    const tokens = DEMO.split(/(?<=\s)/);
    const out: string[] = [];
    for (let i = 0; i < tokens.length;) {
      const take = 1 + ((i * 7) % 3);
      out.push(tokens.slice(i, i + take).join(''));
      i += take;
    }
    return out;
  })();

  let content = $state('');
  let pos = $state(0);
  let playing = $state(false);
  const done = $derived(pos >= chunks.length);

  function replay() {
    content = '';
    pos = 0;
    playing = true;
  }

  $effect(() => {
    if (!playing || done) return;
    const timer = setInterval(() => {
      content += chunks[pos];
      pos += 1;
      if (pos >= chunks.length) playing = false;
    }, 45);
    return () => clearInterval(timer);
  });

  function codeGenerator(vals: Record<string, unknown>): string {
    const size = vals.size === 'sm' ? ' size="sm"' : '';
    const streaming = vals.streaming ? ' streaming' : '';
    return `<StreamingMarkdown content={answer}${streaming}${size} />`;
  }
</script>

<SeoMeta
  title="StreamingMarkdown Component"
  description="Streaming-safe markdown renderer for LLM output: parses a growing string incrementally, caches settled blocks, and enforces a strict URL policy — rendering to a real component tree, so it is XSS-safe by construction."
/>

<DocsPageLayout
  title="StreamingMarkdown"
  description="Streaming-safe markdown renderer for LLM output. Parses a growing string incrementally, caches settled blocks, and enforces a strict URL policy by default — rendering to a real component tree, never to an HTML string."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="StreamingMarkdown"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'md', value: 'md' },
            { label: 'sm', value: 'sm' }
          ],
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'streaming', label: 'Streaming cursor', defaultValue: true }
      ]}
      values={{ size: 'md', streaming: true }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <Button intent="primary" size="sm" onclick={replay} disabled={playing}>
              {pos === 0 ? 'Play stream' : 'Replay'}
            </Button>
            {#if playing}
              <span class="text-text-tertiary text-xs">streaming… {pos}/{chunks.length}</span>
            {:else if done}
              <span class="text-text-tertiary text-xs">done</span>
            {/if}
          </div>
          <div class="border-border-subtle bg-surface-base rounded-contain min-h-48 border p-5">
            <StreamingMarkdown
              content={content || DEMO}
              streaming={playing || (values.streaming as boolean)}
              size={values.size as 'sm' | 'md'}
              headingLevelStart={3}
            />
          </div>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { StreamingMarkdown } from '@urbicon-ui/blocks';
import type {
  StreamingMarkdownProps,
  MarkdownRenderers,
  MarkdownUrlPolicy,
  CitationSource
} from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/streaming-markdown/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
