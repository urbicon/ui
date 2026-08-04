<script lang="ts">
  import { highlighterService } from '$lib';
  import { useDocsI18n } from '$lib/i18n';
  import { ChevronRightIcon, Spinner } from '@urbicon-ui/blocks';
  import { codePanelVariants } from './codepanel.variants';
  import { LINE_NUMBER_AUTO_THRESHOLD, type CodePanelProps } from './index.js';

  const dt = useDocsI18n();

  let {
    code,
    language = 'svelte',
    label,
    lineNumbers = 'auto',
    expanded: expandedProp,
    onToggle,
    size = 'md',
    class: className,
    unstyled = false,
    slotClasses = {}
  }: CodePanelProps = $props();

  const styles = $derived(codePanelVariants({ size }));

  // Trailing blank lines would otherwise be numbered; they are not code.
  const lineCount = $derived(
    String(code ?? '')
      .replace(/\n+$/, '')
      .split('\n').length
  );
  const showLineNumbers = $derived(
    lineNumbers === 'auto' ? lineCount >= LINE_NUMBER_AUTO_THRESHOLD : lineNumbers
  );
  // Keep the gutter exactly as wide as the largest number needs.
  const lineNumberWidth = $derived(String(lineCount).length);

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
  // Accessible name for the read-only code region (fixes axe aria-input-field-name).
  const codeLabel = $derived(
    label ? dt('codeExampleLabeled', { title: label }) : dt('codeExample')
  );
</script>

<div class={[slot('root'), className]}>
  <div class={slot('toolbar')}>
    <button
      type="button"
      class={slot('codeToggle')}
      onclick={handleToggle}
      aria-expanded={isExpanded}
    >
      <ChevronRightIcon
        class={[slot('codeChevron'), isExpanded && 'rotate-90'].filter(Boolean).join(' ')}
      />
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
    <!--
      Copy confirmation for screen readers. The button's label already flips to
      "Copied!", but a *label* change on the control the user just activated is
      not a reliable announcement — a status region is. It must be in the DOM
      BEFORE `copied` flips (a region inserted together with its text is not
      announced), so the span always renders and only its text content changes.
    -->
    <span class="sr-only" role="status">{copied ? dt('copied') : ''}</span>
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
          <div
            class={[slot('codeContent'), showLineNumbers && 'has-line-numbers']
              .filter(Boolean)
              .join(' ')}
            style={showLineNumbers ? `--code-line-number-width: ${lineNumberWidth}ch` : undefined}
            role="textbox"
            aria-readonly="true"
            aria-label={codeLabel}
            tabindex="0"
          >
            {@html highlightedCode}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  /*
   * Line numbers as CSS generated content on Shiki's per-line `.line` spans.
   * Deliberately not markup: ::before content is not part of the DOM text, so it
   * cannot land in the clipboard — neither via the copy button (which copies the
   * raw `code` prop) nor via a manual selection (further guarded by user-select).
   */
  .has-line-numbers :global(.shiki code) {
    counter-reset: code-line;
  }

  .has-line-numbers :global(.shiki .line::before) {
    counter-increment: code-line;
    content: counter(code-line);
    display: inline-block;
    width: var(--code-line-number-width, 2ch);
    margin-right: 1.5ch;
    text-align: right;
    color: var(--color-text-quaternary);
    user-select: none;
    -webkit-user-select: none;
  }

  :global(.shiki) {
    border-radius: 0;
    border: none;
    background-color: transparent !important;
  }

  /*
   * Dark syntax colours.
   *
   * This is the one place in the repo that cannot ride `light-dark()`: Shiki
   * writes the light theme's colour *inline* on every span and exposes only the
   * dark one as a custom property (`--shiki-dark`), so there is no
   * `--shiki-light` to pair with — hence the `!important` overrides below, which
   * are what beat the inline style. (Shiki's `defaultColor: 'light-dark()'`
   * output mode would emit both as properties and collapse all of this into a
   * single `light-dark()` declaration; that switch lives in `highlighter.ts`.)
   *
   * The condition mirrors the `color-scheme` contract in blocks' `semantic.css`:
   * an explicit choice sets `:root.light` / `:root.dark`, and system mode sets no
   * class at all and follows the OS. So dark applies when the reader explicitly
   * chose dark, OR when the OS is dark and they have not explicitly chosen light.
   * The `:not(.light)` guard is what lets an explicit light choice win on a dark
   * OS. Two blocks, because CSS cannot express that disjunction in one selector.
   *
   * Without the media-query half, a reader on a dark OS who never touched the
   * toggle (the default) got the light theme's near-black text on the dark
   * surface — every code block on the site unreadable at ~1.05:1.
   */
  :global(.dark .shiki span) {
    color: var(--shiki-dark) !important;
    background-color: var(--shiki-dark-bg) !important;
    font-style: var(--shiki-dark-font-style) !important;
    font-weight: var(--shiki-dark-font-weight) !important;
    text-decoration: var(--shiki-dark-text-decoration) !important;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not(.light) .shiki span) {
      color: var(--shiki-dark) !important;
      background-color: var(--shiki-dark-bg) !important;
      font-style: var(--shiki-dark-font-style) !important;
      font-weight: var(--shiki-dark-font-weight) !important;
      text-decoration: var(--shiki-dark-text-decoration) !important;
    }
  }

  /*
   * Removed here: a `:global(.shiki pre)` rule (padding/overflow/font) and four
   * `:global(.shiki pre::-webkit-scrollbar*)` rules. Both selectors target a
   * `<pre>` INSIDE `.shiki`, and Shiki 4 emits `<pre class="shiki">` itself —
   * verified in the browser: `document.querySelector('.shiki').tagName` is
   * `PRE` and it contains zero `<pre>` descendants. So none of them ever
   * matched, and what actually styles the block is `pre.shiki { @apply p-2 }`
   * in the package stylesheet.
   *
   * They are deleted rather than re-pointed at `.shiki`: re-pointing would
   * newly apply `padding: 1rem` over today's `p-2` and change every code block
   * on the site. The scrollbar rules are moot anyway — `pre.shiki` sets
   * `white-space: pre-wrap`, so the block never scrolls horizontally.
   */
</style>
