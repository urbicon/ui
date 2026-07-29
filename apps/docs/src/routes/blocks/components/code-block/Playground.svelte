<!--
  CodeBlock-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { CodeBlock } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const SAMPLE = `type Source = { id: string; title: string; url?: string };

function cite(sources: Source[]): string {
  return sources.map((s, i) => \`[\${i + 1}] \${s.title}\`).join('\\n');
}`;

  const controls = deriveControls(componentData, {
    pick: ['lang', 'variant', 'wrap', 'showCopy'],
    overrides: {
      lang: { label: 'Language', defaultValue: 'ts' },
      wrap: { label: 'Wrap lines' },
      showCopy: { label: 'Copy button', defaultValue: true }
    }
  });

  function codeGenerator(vals: Record<string, unknown>): string {
    const parts: string[] = [];
    if (vals.lang) parts.push(`lang="${vals.lang}"`);
    if (vals.variant && vals.variant !== 'card') parts.push(`variant="${vals.variant}"`);
    if (vals.wrap) parts.push('wrap');
    if (vals.showCopy === false) parts.push('showCopy={false}');
    const attrs = parts.length ? ` ${parts.join(' ')}` : '';
    return `<CodeBlock${attrs} {code} />`;
  }
</script>

<PlaygroundConfigurator
  componentName="CodeBlock"
  {propDocs}
  {variantKeys}
  {codeGenerator}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { CodeBlock } from '@urbicon-ui/blocks';"],
    consts: { code: SAMPLE },
    bind: ['code']
  }}
>
  {#snippet children(values)}
    <div class="mx-auto max-w-xl">
      <CodeBlock
        code={SAMPLE}
        lang={(values.lang as string) || undefined}
        variant={values.variant as 'card' | 'plain'}
        wrap={values.wrap as boolean}
        showCopy={values.showCopy as boolean}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
