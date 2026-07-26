<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CopyIconDefault from '$lib/icons/CopyIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import { createCopyState } from '$lib/internal/copy-state.svelte';
  import { codeBlockVariants, type CodeBlockVariants } from './code-block.variants';
  import type { CodeBlockProps } from './index';

  let {
    code,
    lang,
    label,
    variant = 'card',
    showCopy = true,
    wrap = false,
    copyLabel = 'Copy',
    copiedLabel = 'Copied',
    copyFailedLabel = 'Copy failed',
    onCopy,
    onCopyError,
    actions,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: CodeBlockProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const CopyIcon = resolveIcon('copy', CopyIconDefault);
  const CheckIcon = resolveIcon('check', CheckIconDefault);

  // Deliberately NOT routed through useBlocksI18n(). CodeBlock is a leaf with no
  // other reason to pull the i18n registry, and doing so for three strings costs
  // +5 KB gz here — which StreamingMarkdown and ReasoningDisclosure then inherit
  // by embedding it (+25% each, measured against bundle-size.baseline.json). A
  // consumer localises through the three label props; ChatMessage, which already
  // carries the registry via Alert/Avatar/Button/Tooltip, does use the
  // translations because there it is free. See technical-debt.md — splitting
  // translations/en.ts per area would remove the trade-off.

  const variantProps: CodeBlockVariants = $derived({ variant, wrap });
  const styles = $derived(codeBlockVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'CodeBlock', preset, variantProps, slotClassesProp)
  );

  function cls(name: keyof typeof slotClasses, extra?: string | (string | undefined)[]) {
    if (unstyled) {
      const own = slotClasses?.[name];
      return [own, ...(Array.isArray(extra) ? extra : [extra])].filter(Boolean).join(' ');
    }
    const slotFns = styles as Record<string, (args: { class?: unknown }) => string>;
    return slotFns[name]({
      class: [slotClasses?.[name], ...(Array.isArray(extra) ? extra : [extra])]
    });
  }

  // `label` wins over `lang` in the header: an embedding parent (ToolCallCard)
  // passes what the payload *is* ("Input"), which says more than the language it
  // happens to be serialised in — and showing both is the same fact twice.
  const headerLabel = $derived(label ?? lang);
  const showHeader = $derived(!!headerLabel || showCopy || !!actions);
  // The accessible name of the scroll region keeps naming the language when
  // there is one: "Input code" is vaguer than "json code" for a screen reader.
  const regionLabel = $derived(lang ? `${lang} code` : label ? `${label} code` : 'Code');

  const copyState = createCopyState();

  async function handleCopy() {
    const result = await copyState.copy(code);
    if (result.ok) {
      onCopy?.(code);
    } else if (onCopyError) {
      onCopyError(result.error);
    } else {
      // Never silent: a copy that did nothing is the outcome most worth
      // reporting, and the consumer opted out of handling it.
      console.error('CodeBlock: failed to copy code', result.error);
    }
  }

  // The button reports the outcome, all three of them. A denied clipboard
  // permission used to leave it looking untouched (console-only).
  const buttonText = $derived(
    copyState.phase === 'copied'
      ? copiedLabel
      : copyState.phase === 'error'
        ? copyFailedLabel
        : copyLabel
  );
</script>

<div class={cls('root', className)} {...restProps}>
  {#if showHeader}
    <div class={cls('header')}>
      <span class={cls('langLabel')}>{headerLabel ?? ''}</span>
      <div class="flex items-center gap-1">
        {@render actions?.()}
        {#if showCopy}
          <!--
            Icon-only: the button sits in a header whose other half already names
            the payload, and a text button there outweighed the caption it was
            supposed to serve. `title` carries the label for pointer users, the
            live region below announces the outcome.
          -->
          <button
            type="button"
            class={cls('copyButton')}
            onclick={handleCopy}
            aria-label={buttonText}
            title={buttonText}
          >
            {#if copyState.phase === 'copied'}
              <CheckIcon size={14} />
            {:else}
              <CopyIcon size={14} />
            {/if}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!--
    Scrollable code region: tabindex=0 + role=region + aria-label so keyboard
    users can reach and scroll the overflow (WCAG 2.1.1). Svelte flags tabindex
    on a "noninteractive" element, but a focusable scroll container is the
    sanctioned exception here.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <pre class={cls('pre')} tabindex="0" role="region" aria-label={regionLabel}><code
      class={cls('code')}>{code}</code
    ></pre>

  <!--
    Copy outcome for screen readers. A label change on the button the user just
    activated is not a reliable announcement — a live status region is. It must
    exist in the DOM before the phase flips, so it always renders and only its
    text content changes.
  -->
  <span class="sr-only" role="status">{copyState.phase === 'idle' ? '' : buttonText}</span>
</div>
