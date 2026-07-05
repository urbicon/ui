<script lang="ts">
  import { highlighterService } from '$lib';
  import { useDocsI18n } from '$lib/i18n';
  import { Spinner } from '@urbicon-ui/blocks';
  import { codePanelVariants } from './codepanel.variants';
  import type { CodePanelProps } from './index.js';

  const dt = useDocsI18n();

  let {
    code,
    language = 'svelte',
    expanded: expandedProp,
    onToggle,
    size = 'md',
    class: className,
    unstyled = false,
    slotClasses = {}
  }: CodePanelProps = $props();

  const styles = $derived(codePanelVariants({ size }));

  function slot(name: keyof NonNullable<CodePanelProps['slotClasses']>) {
    if (unstyled) return slotClasses?.[name] ?? '';
    const slotFns = styles as Record<string, (args: { class?: string }) => string>;
    return slotFns[name]({ class: slotClasses?.[name] });
  }

  let internalExpanded = $state(true);
  const isExpanded = $derived(expandedProp !== undefined ? expandedProp : internalExpanded);

  function handleToggle() {
    if (onToggle) {
      onToggle();
    } else {
      internalExpanded = !internalExpanded;
    }
  }

  let copied = $state(false);
  let highlightedCode = $state('');
  let isLoading = $state(true);

  $effect(() => {
    isLoading = true;
    highlighterService
      .highlightCode(code, language)
      .then((result) => {
        highlightedCode = result;
        isLoading = false;
      })
      .catch((error) => {
        console.error('Failed to highlight code:', error);
        const escaped = String(code || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        highlightedCode = `<pre><code>${escaped}</code></pre>`;
        isLoading = false;
      });
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }

  const copyLabel = $derived(copied ? dt('copied') : dt('copy'));
  const toggleLabel = $derived(isExpanded ? dt('hideCode') : dt('showCode'));
</script>

<div
  class={unstyled
    ? [slotClasses?.root, className].filter(Boolean).join(' ')
    : styles.root({ class: [slotClasses?.root, className] })}
>
  <div class={slot('toolbar')}>
    <button
      type="button"
      class={slot('codeToggle')}
      onclick={handleToggle}
      aria-expanded={isExpanded}
    >
      <svg
        class={[slot('codeChevron'), isExpanded && 'rotate-90'].filter(Boolean).join(' ')}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <span class={slot('languageTag')}>{language}</span>
      <span class="sr-only">{toggleLabel}</span>
    </button>
    <span class={slot('copySeparator')} aria-hidden="true">·</span>
    <button
      type="button"
      class={slot('copyButton')}
      onclick={copyCode}
      aria-label={copyLabel}
      disabled={isLoading}
    >
      {copyLabel}
      <span aria-hidden="true">{copied ? '✓' : '↗'}</span>
    </button>
  </div>

  <div class={slot('codeCollapse')} style="grid-template-rows: {isExpanded ? '1fr' : '0fr'}">
    <div class="overflow-hidden">
      {#if isLoading}
        <div class={slot('loadingContainer')} aria-live="polite">
          <Spinner size="sm" color="current" />
          <span class={slot('loadingText')}>
            {dt('loadingSyntax')}
          </span>
        </div>
      {:else}
        <div class={slot('codeDisplay')}>
          <div class={slot('codeContent')} role="textbox" aria-readonly="true" tabindex="0">
            {@html highlightedCode}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.shiki) {
    border-radius: 0;
    border: none;
    background-color: transparent !important;
  }

  :global(.shiki pre) {
    padding: 1rem;
    overflow-x: auto;
    margin: 0;
    background-color: transparent !important;
    font-size: 0.875rem;
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
  }

  :global(.dark .shiki),
  :global(.dark .shiki pre) {
    background-color: transparent !important;
  }

  :global(.dark .shiki span) {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
    font-style: var(--shiki-dark-font-style) !important;
    font-weight: var(--shiki-dark-font-weight) !important;
    text-decoration: var(--shiki-dark-text-decoration) !important;
  }

  :global(.shiki pre::-webkit-scrollbar) {
    height: 8px;
  }

  :global(.shiki pre::-webkit-scrollbar-track) {
    background: var(--color-surface-interactive);
  }

  :global(.shiki pre::-webkit-scrollbar-thumb) {
    background: var(--color-border-default);
    border-radius: var(--radius-sm);
  }

  :global(.shiki pre::-webkit-scrollbar-thumb:hover) {
    background: var(--color-border-emphasis);
  }
</style>
