<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    Badge,
    Button,
    Select,
    Slider,
    SplitPane,
    StreamingMarkdown,
    type CitationSource
  } from '@urbicon-ui/blocks';
  import citations from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/11-citations.md?raw';
  import codeInList from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/04-code-in-list.md?raw';
  import evilPolicy from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/12-evil-policy.md?raw';
  import gfmTable from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/01-gfm-table.md?raw';
  import longMixed from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/14-long-mixed.md?raw';
  import multiCodefence from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/05-multi-codefence.md?raw';
  import refLinks from '../../../../../../packages/blocks/src/lib/components/Chat/markdown/__fixtures__/corpus/07-ref-links-trailing.md?raw';

  const CITATION_SOURCES: CitationSource[] = [
    {
      id: '1',
      title: 'Attention Is All You Need',
      url: 'https://arxiv.org/abs/1706.03762',
      snippet:
        'We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.'
    },
    {
      id: '2',
      title: 'Scaling Laws for Neural Language Models',
      url: 'https://arxiv.org/abs/2001.08361',
      snippet:
        'Language modeling performance improves smoothly as we increase model size, dataset size, and compute.'
    },
    {
      id: '3',
      title: 'Training language models to follow instructions',
      url: 'https://arxiv.org/abs/2203.02155',
      snippet:
        'Fine-tuning with human feedback aligns language models with user intent on a wide range of tasks.'
    }
  ];

  interface Fixture {
    value: string;
    label: string;
    text: string;
    sources?: CitationSource[];
  }

  const FIXTURES: Fixture[] = [
    { value: 'long-mixed', label: 'Long mixed answer', text: longMixed },
    {
      value: 'citations',
      label: 'Citations + sources',
      text: citations,
      sources: CITATION_SOURCES
    },
    { value: 'gfm-table', label: 'GFM table', text: gfmTable },
    { value: 'multi-codefence', label: 'Multiple code fences', text: multiCodefence },
    { value: 'code-in-list', label: 'Code inside lists', text: codeInList },
    { value: 'ref-links', label: 'Late reference links', text: refLinks },
    { value: 'evil-policy', label: 'Hostile input (URL policy)', text: evilPolicy }
  ];

  const CHUNKINGS = [
    { value: 'word', label: 'Word chunks (LLM-like)' },
    { value: 'line', label: 'Per line' },
    { value: 'char', label: 'Per character' }
  ];

  let fixtureId = $state('long-mixed');
  let chunkingId = $state('word');
  let speed = $state(40);
  let content = $state('');
  let playing = $state(false);
  let position = $state(0);

  const fixture = $derived(FIXTURES.find((f) => f.value === fixtureId) ?? FIXTURES[0]);

  function chunksOf(text: string, mode: string): string[] {
    if (mode === 'char') return Array.from(text);
    if (mode === 'line') return text.split(/(?<=\n)/);
    // Word-ish chunks of 1–3 tokens — close to how model output arrives.
    const tokens = text.split(/(?<=\s)/);
    const out: string[] = [];
    for (let i = 0; i < tokens.length;) {
      const take = 1 + ((i * 7) % 3);
      out.push(tokens.slice(i, i + take).join(''));
      i += take;
    }
    return out;
  }

  const chunks = $derived(chunksOf(fixture.text, chunkingId));
  const done = $derived(position >= chunks.length);

  function reset() {
    playing = false;
    content = '';
    position = 0;
  }

  // Fixture or chunking change restarts the replay from zero.
  $effect(() => {
    void fixture;
    void chunkingId;
    reset();
  });

  $effect(() => {
    if (!playing || done) return;
    const interval = setInterval(
      () => {
        content += chunks[position];
        position += 1;
        if (position >= chunks.length) playing = false;
      },
      Math.max(8, 1000 / speed)
    );
    return () => clearInterval(interval);
  });

  function showAll() {
    playing = false;
    content = fixture.text;
    position = chunks.length;
  }
</script>

<SeoMeta
  title="StreamingMarkdown Playground"
  description="Replay real LLM output fixtures through the streaming markdown renderer — chunk by chunk, with settled-block caching, citations, and the strict URL policy live."
/>

<div class="mx-auto max-w-6xl px-4 py-10">
  <div class="mb-6 flex items-center gap-3">
    <h1 class="text-text-primary text-2xl font-semibold">StreamingMarkdown Playground</h1>
    <Badge intent="primary" variant="soft">experimental</Badge>
  </div>
  <p class="text-text-secondary mb-8 max-w-3xl">
    Replays the engine's own test fixtures — real LLM output shapes — through
    <code class="font-mono text-sm">StreamingMarkdown</code>. The right pane renders from the
    growing string exactly as a chat surface would; settled blocks never re-render. Try the hostile
    fixture to watch the strict URL policy block scheme-smuggled links and external images, or the
    citations fixture to see <code class="font-mono text-sm">[n]</code> markers resolve to chips.
  </p>

  <div class="mb-6 flex flex-wrap items-end gap-4">
    <Select
      label="Fixture"
      options={FIXTURES.map(({ value, label }) => ({ value, label }))}
      value={fixtureId}
      onValueChange={(v: string | null) => {
        if (v) fixtureId = v;
      }}
      size="sm"
      class="w-56"
    />
    <Select
      label="Chunking"
      options={CHUNKINGS}
      value={chunkingId}
      onValueChange={(v: string | null) => {
        if (v) chunkingId = v;
      }}
      size="sm"
      class="w-56"
    />
    <div class="w-48">
      <Slider label="Chunks / second" min={5} max={200} step={5} bind:value={speed} />
    </div>
    <div class="flex gap-2">
      {#if playing}
        <Button intent="primary" size="sm" onclick={() => (playing = false)}>Pause</Button>
      {:else}
        <Button intent="primary" size="sm" disabled={done} onclick={() => (playing = true)}>
          {position === 0 ? 'Play' : 'Resume'}
        </Button>
      {/if}
      <Button variant="outlined" size="sm" onclick={reset}>Reset</Button>
      <Button variant="outlined" size="sm" disabled={done} onclick={showAll}>Show all</Button>
    </div>
  </div>

  <div class="rounded-contain border-border-default h-[36rem] overflow-hidden border">
    <SplitPane defaultRatio={0.45} min="25%" max="75%">
      {#snippet start()}
        <div class="bg-surface-elevated h-full overflow-y-auto p-4">
          <div class="text-text-tertiary mb-2 text-xs font-medium tracking-wide uppercase">
            Raw stream ({position}/{chunks.length} chunks)
          </div>
          <pre
            class="text-text-secondary font-mono text-xs break-words whitespace-pre-wrap">{content}</pre>
        </div>
      {/snippet}
      {#snippet end()}
        <div class="bg-surface-base h-full overflow-y-auto p-6">
          <StreamingMarkdown
            {content}
            streaming={playing}
            sources={fixture.sources}
            headingLevelStart={2}
          />
        </div>
      {/snippet}
    </SplitPane>
  </div>
</div>
