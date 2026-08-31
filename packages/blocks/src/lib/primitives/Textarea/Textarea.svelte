<script lang="ts">
  import { mintAttachment } from '$lib';
  import CoreFieldMessage from '$lib/internal/core/CoreFieldMessage.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useFormField, getTierContext } from '$lib/utils';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { TextareaProps } from './index';
  import { textareaVariants, type TextareaVariants } from './textarea.variants';

  let {
    label,
    error,
    helper,
    showCounter = false,
    counterWarningThreshold = 0.9,
    autoResize = false,
    minRows = 3,
    maxRows,
    tier,
    variant = 'outlined',
    size = 'md',
    intent = 'default',
    mint = 'none',
    disabled = false,
    required = false,
    readonly = false,
    value = $bindable(''),
    maxlength,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    oninput: userOnInput,
    id: idProp,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: TextareaProps = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let textareaRef = $state<HTMLTextAreaElement>();

  // ARIA wiring is shared with every form primitive — see XC-2.
  // A consumer-supplied `id` wins over the generated one, so an external
  // `<label for>` can address the `<textarea>` (mirrors the Input role model).
  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `textarea-${propsId}`);
  const ff = useFormField(() => ({
    fieldId,
    helper,
    error,
    required,
    disabled
  }));

  // Consumer-supplied `aria-describedby` (e.g. an external hint rendered
  // outside the component) merges with the internal error/helper chain instead
  // of replacing it — internal descriptions first, the consumer's supplemental
  // one last (mirrors the Input role model, XC-2).
  const describedBy = $derived(
    [ff.describedBy, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  const charCount = $derived(typeof value === 'string' ? value.length : 0);
  const counterState = $derived.by(() => {
    if (!maxlength) return 'normal' as const;
    if (charCount > maxlength) return 'over' as const;
    if (charCount >= maxlength * counterWarningThreshold) return 'warning' as const;
    return 'normal' as const;
  });

  const showFooter = $derived(!!error || !!helper || (showCounter && maxlength));

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the textarea's active variants.
  const variantProps: TextareaVariants = $derived({
    tier: effectiveTier,
    variant,
    size,
    intent,
    autoResize: autoResize || undefined,
    disabled: disabled || undefined,
    readonly: readonly || undefined,
    error: !!error || undefined,
    required: required || undefined,
    messageType: error ? 'error' : 'helper',
    counterState
  });

  const styles = $derived(textareaVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Textarea', preset, variantProps, slotClassesProp)
  );

  const lineHeight = $derived(size === 'sm' ? 20 : size === 'lg' ? 28 : 24);

  function adjustHeight() {
    if (!autoResize || !textareaRef) return;
    textareaRef.style.height = 'auto';

    const minHeight = minRows * lineHeight;
    const maxHeight = maxRows ? maxRows * lineHeight : Infinity;
    const scrollHeight = textareaRef.scrollHeight;

    textareaRef.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
    textareaRef.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  $effect(() => {
    if (autoResize && textareaRef) {
      void value;
      adjustHeight();
    }
  });

  function handleInput(event: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
    if (autoResize) adjustHeight();
    // Forward the consumer's oninput — Textarea's own handler sits after
    // `{...restProps}` on the element, so without this it would swallow it
    // (same class as Input's onkeydown forward).
    userOnInput?.(event);
  }
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.wrapper, className)
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
>
  {#if label}
    <label
      for={ff.fieldId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}
    </label>
  {/if}

  <textarea
    {...restProps}
    bind:this={textareaRef}
    {@attach mintAttachment(mint, { enabled: !disabled })}
    bind:value
    id={ff.fieldId}
    class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}
    rows={autoResize ? minRows : (restProps.rows ?? minRows)}
    {maxlength}
    {disabled}
    {readonly}
    {required}
    aria-invalid={ff.invalid ? 'true' : undefined}
    aria-describedby={describedBy}
    oninput={handleInput}></textarea>

  {#if showFooter}
    <div
      class={unstyled ? (slotClasses?.footer ?? '') : styles.footer({ class: slotClasses?.footer })}
    >
      {#if error || helper}
        <CoreFieldMessage
          {error}
          {helper}
          errorId={ff.errorId}
          helperId={ff.helperId}
          class={unstyled
            ? (slotClasses?.message ?? '')
            : styles.message({ class: slotClasses?.message })}
        />
      {:else}
        <!-- The footer is `justify-between`: without a first child the counter
             would slide to the left edge. Unlike every other field, Textarea's
             message shares a row, so the empty slot has to stay here. -->
        <span></span>
      {/if}

      {#if showCounter && maxlength}
        <span
          class={unstyled
            ? (slotClasses?.counter ?? '')
            : styles.counter({ class: slotClasses?.counter })}
          aria-live="polite"
        >
          {charCount}/{maxlength}
        </span>
      {/if}
    </div>
  {/if}
</div>
