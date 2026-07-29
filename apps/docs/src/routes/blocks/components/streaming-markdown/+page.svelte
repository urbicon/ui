<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import { StreamingMarkdown } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
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
    <Playground />
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
</DocsPageLayout>
