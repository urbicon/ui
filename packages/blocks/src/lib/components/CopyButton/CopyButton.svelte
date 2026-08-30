<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import CopyIconDefault from '$lib/icons/CopyIcon.svelte';
  import { createCopyState } from '$lib/internal/copy-state.svelte';
  import { Button } from '$lib/primitives/Button';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { copyButtonVariants } from './copy-button.variants';
  import type { CopyButtonProps } from './index';

  const CopyIcon = resolveIcon('copy', CopyIconDefault);
  const CheckIcon = resolveIcon('check', CheckIconDefault);

  let {
    value,
    label,
    children,
    copiedLabel,
    timeout = 2000,
    variant = 'ghost',
    intent = 'neutral',
    size = 'md',
    tier,
    disabled = false,
    hideIcon = false,
    onCopy,
    onError,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    // a11y attributes the component owns and merges consumer intent into (below),
    // pulled out of restProps so the component's state wiring can't be clobbered.
    'aria-label': ariaLabelProp,
    title: titleProp,
    ...restProps
  }: CopyButtonProps = $props();

  const bt = useBlocksI18n();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Shares the clipboard state machine with CodeBlock and ChatMessage — see
  // internal/copy-state.svelte.ts for why the outcome is returned rather than
  // delivered through callbacks captured at init.
  const copyState = createCopyState({ timeout: () => timeout });
  const state = $derived(copyState.phase);

  const copyText = $derived(label ?? bt('accessibility.copy'));
  const copiedText = $derived(copiedLabel ?? bt('accessibility.copied'));
  const failedText = $derived(bt('accessibility.copyFailed'));
  const stateText = $derived(
    state === 'copied' ? copiedText : state === 'error' ? failedText : copyText
  );
  // Real text in a polite live region — the reliable way to announce the outcome
  // in icon-only mode (an aria-label change is not announced by aria-live).
  const announcement = $derived(
    state === 'copied' ? copiedText : state === 'error' ? failedText : ''
  );

  const effectiveIntent = $derived(
    state === 'copied' ? 'success' : state === 'error' ? 'danger' : intent
  );

  const styles = $derived(unstyled ? null : copyButtonVariants({ size, state }));
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'CopyButton',
      preset,
      { size, state, variant, intent },
      slotClassesProp
    )
  );

  const buttonClass = $derived(
    (styles
      ? styles.base({ class: [slotClasses?.base, className] })
      : [slotClasses?.base, className].filter(Boolean).join(' ')) || undefined
  );
  const iconClass = $derived(
    (styles ? styles.icon({ class: slotClasses?.icon }) : slotClasses?.icon) || undefined
  );
  const labelClass = $derived(
    (styles ? styles.label({ class: slotClasses?.label }) : slotClasses?.label) || undefined
  );

  // The visible label reflects state for sighted users (screen readers get the
  // outcome from the live region instead).
  const visibleLabel = $derived(
    state === 'copied' ? copiedText : state === 'error' ? failedText : label
  );

  // Icon-only mode carries its accessible name on the button (a stable action
  // name; a consumer override stays supplemental). Labelled mode lets the
  // visible text be the name (WCAG 2.5.3), keeping any consumer aria-label.
  // `children` counts as a label here: it renders visible content, so imposing
  // an aria-label on top would override what the user can actually read.
  const hasVisibleLabel = $derived(!!children || !!label);
  const ariaLabel = $derived(hasVisibleLabel ? ariaLabelProp : (ariaLabelProp ?? copyText));

  async function handleCopy() {
    const result = await copyState.copy(value);
    if (result.ok) onCopy?.(value);
    else onError?.(result.error);
  }
</script>

<span class="contents">
  <Button
    {...restProps}
    {variant}
    intent={effectiveIntent}
    {size}
    {tier}
    {disabled}
    {unstyled}
    onclick={handleCopy}
    class={buttonClass}
    aria-label={ariaLabel}
    title={titleProp ?? stateText}
  >
    {#if !hideIcon}
      {#if state === 'copied'}
        <CheckIcon class={iconClass} aria-hidden="true" />
      {:else}
        <CopyIcon class={iconClass} aria-hidden="true" />
      {/if}
    {/if}
    {#if children}
      {@render children(state)}
    {:else if label}<span class={labelClass}>{visibleLabel}</span>{/if}
  </Button>
  <span class="sr-only" role="status">{announcement}</span>
</span>
