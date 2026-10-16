<script lang="ts">
  import type { InlineCodeProps } from './index';
  import { parseInlineRuns, type InlineRun } from './inline-runs';

  let { text = '', codeClass = 'text-text-primary font-mono' }: InlineCodeProps = $props();

  // Not `{@html}`: every run reaches the DOM through text interpolation, so a
  // description carrying `<script>` stays a description.
  const runs = $derived(parseInlineRuns(text));
</script>

<!-- prettier-ignore -->
{#snippet content(run: InlineRun)}{#if run.code}<code class={codeClass}>{run.text}</code>{:else}{run.text}{/if}{/snippet}

<!-- prettier-ignore -->
{#each runs as run, i (i)}{#if run.strong && run.em}<strong><em>{@render content(run)}</em></strong>{:else if run.strong}<strong>{@render content(run)}</strong>{:else if run.em}<em>{@render content(run)}</em>{:else}{@render content(run)}{/if}{/each}
