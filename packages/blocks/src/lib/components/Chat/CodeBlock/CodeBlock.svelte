<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CopyIconDefault from '$lib/icons/CopyIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import { codeBlockVariants, type CodeBlockVariants } from './code-block.variants';
  import type { CodeBlockProps } from './index';

  let {
    code,
    lang,
    showCopy = true,
    wrap = false,
    copyLabel = 'Copy code',
    copiedLabel = 'Copied',
    onCopy,
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

  const variantProps: CodeBlockVariants = $derived({ wrap });
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

  const showHeader = $derived(!!lang || showCopy || !!actions);
  const regionLabel = $derived(lang ? `${lang} code` : 'Code');

  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copied = false;
        resetTimer = undefined;
      }, 2000);
      onCopy?.(code);
    } catch (err) {
      // Never swallow silently — but leave state untouched so the UI does not
      // falsely confirm a copy that failed (e.g. denied clipboard permission).
      console.error('CodeBlock: failed to copy code', err);
    }
  }

  // Clear a pending reset on unmount so the timer can't fire into a torn-down component.
  $effect(() => () => {
    if (resetTimer) clearTimeout(resetTimer);
  });
</script>

<div class={cls('root', className)} {...restProps}>
  {#if showHeader}
    <div class={cls('header')}>
      <span class={cls('langLabel')}>{lang ?? ''}</span>
      <div class="flex items-center gap-1">
        {@render actions?.()}
        {#if showCopy}
          <button
            type="button"
            class={cls('copyButton')}
            onclick={copyCode}
            aria-label={copied ? copiedLabel : copyLabel}
          >
            {#if copied}
              <CheckIcon size={14} />
            {:else}
              <CopyIcon size={14} />
            {/if}
            <span>{copied ? copiedLabel : copyLabel}</span>
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
    Copy confirmation for screen readers. A label change on the button the user
    just activated is not a reliable announcement — a live status region is. It
    must exist in the DOM before `copied` flips, so it always renders and only
    its text content changes.
  -->
  <span class="sr-only" role="status">{copied ? copiedLabel : ''}</span>
</div>
