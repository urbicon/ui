<!--
  StreamingMarkdown-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { StreamingMarkdown, Button } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const DEMO = `## Rate limiting with a token bucket

A **token bucket** lets short bursts through while capping the long-run rate.
The bucket refills at a steady pace, and each request spends one token.

- Refill tokens on a timer, up to a maximum
- Allow a request when a token is free, otherwise reject it

\`\`\`ts
if (tokens > 0) { tokens--; allow(); } else reject();
\`\`\`
`;

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

  const controls = deriveControls(componentData, {
    pick: ['size', 'streaming', 'headingLevelStart'],
    overrides: {
      streaming: { label: 'Streaming cursor', defaultValue: true },
      // Die Bühne setzte 3 fest, damit die Demo-Überschriften nicht in die
      // Gliederung der Doku-Seite rutschen. Als Regler steht dieselbe Zahl im
      // Schnipsel — und der Leser sieht, dass es eine Stellschraube ist.
      headingLevelStart: { label: 'Heading level start', defaultValue: 3 }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="StreamingMarkdown"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { StreamingMarkdown } from '@urbicon-ui/blocks';"],
    // `$state`, nicht `const`: Der Sinn der Komponente ist ein Wert, der
    // wächst. Der Startwert ist der Text, den die Bühne im Ruhezustand zeigt —
    // der Abspiel-Knopf darüber ist Demo-Steuerung und kein Teil der API.
    state: { content: DEMO },
    bind: ['content']
  }}
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
          headingLevelStart={Number(values.headingLevelStart ?? 3) as 1 | 2 | 3 | 4 | 5 | 6}
        />
      </div>
    </div>
  {/snippet}
</PlaygroundConfigurator>
