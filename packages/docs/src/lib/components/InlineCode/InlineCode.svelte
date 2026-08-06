<script lang="ts">
  import type { InlineCodeProps } from './index';

  let { text = '', codeClass = 'text-text-primary font-mono' }: InlineCodeProps = $props();

  /**
   * Split on backticks. Even indices are prose, odd indices are code.
   *
   * An odd number of backticks means one of them is unpaired — a stray
   * character rather than a marker — so the string is left as written instead
   * of turning its tail into code.
   *
   * Deliberately not a markdown parser and deliberately not `{@html}`: every
   * segment goes through Svelte's text interpolation and is escaped, so a
   * description carrying `<script>` stays a description.
   */
  const parts = $derived.by(() => {
    const segments = text.split('`');
    return segments.length % 2 === 1 ? segments : [text];
  });
</script>

<!-- prettier-ignore -->
{#each parts as part, i (i)}{#if i % 2 === 1}<code class={codeClass}>{part}</code>{:else}{part}{/if}{/each}
