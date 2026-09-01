<script lang="ts">
  import { useBlocksI18n, mintAttachment, createPersistentState } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import CoreFieldMessage from '$lib/internal/core/CoreFieldMessage.svelte';
  import { useFormField, getTierContext } from '$lib/utils';
  import type { InputProps } from '.';
  import { inputVariants, type InputVariants } from './input.variants';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { resolveClassChain } from '$lib/utils/variants';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    children,
    label,
    error,
    helper,
    leftIcon,
    rightIcon,
    onLeftIconClick,
    onRightIconClick,
    leftIconAriaLabel,
    rightIconAriaLabel,
    clearable = false,
    onClear,
    tier,
    variant = 'outlined',
    size = 'md',
    intent = 'default',
    mint = 'none',
    disabled = false,
    required = false,
    readonly = false,
    value = $bindable(),
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    persistKey,
    persistStorage = 'localStorage',
    persistDebounceMs = 300,
    persistVersion = 1,
    persistNamespace,
    onkeydown: userOnKeydown,
    id: idProp,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: InputProps = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let inputRef = $state<HTMLInputElement>();

  let persisted: ReturnType<typeof createPersistentState<string | null>> | null = null;

  $effect(() => {
    if (!persistKey) {
      persisted = null;
      return;
    }
    const key = [persistKey, persistNamespace].filter(Boolean).join(':');
    persisted = createPersistentState<string | null>({
      key,
      defaultValue: '',
      storage: persistStorage,
      debounceMs: persistDebounceMs,
      version: persistVersion,
      serialize: (v) => JSON.stringify(v ?? ''),
      deserialize: (s) => {
        try {
          const parsed = JSON.parse(s);
          return typeof parsed === 'string' ? parsed : '';
        } catch {
          return '';
        }
      }
    });
  });

  $effect(() => {
    if (!persisted) return;
    if (!value) {
      const fromStore = persisted.value as unknown as string | null;
      if (fromStore) value = fromStore;
    }
  });

  const shouldShowClear = $derived(clearable && !!value && !disabled && !readonly);
  const effectiveRightIcon = $derived(shouldShowClear ? undefined : rightIcon);
  const hasLeftIcon = $derived(!!leftIcon);
  const hasRightIcon = $derived(!!(effectiveRightIcon || shouldShowClear));

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the input's active variants.
  const variantProps: InputVariants = $derived({
    tier: effectiveTier,
    variant,
    size,
    intent,
    disabled: disabled,
    readonly: readonly,
    error: !!error,
    required: required || undefined,
    hasLeftIcon: hasLeftIcon || undefined,
    hasRightIcon: hasRightIcon || undefined,
    messageType: error ? 'error' : 'helper'
  });

  const styles = $derived(inputVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Input',
      preset,
      variantProps,
      slotClassesProp,
      inputVariants.config
    )
  );

  // ARIA wiring is shared with every form primitive — see XC-2.
  // A consumer-supplied `id` wins over the generated one: pairing an Input
  // with an external `<label for>` is only possible if the id we are handed
  // actually reaches the `<input>`. `$props.id()` may only appear as a
  // top-level initializer, hence the two-step derive.
  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `input-${propsId}`);
  const ff = useFormField(() => ({
    fieldId,
    helper,
    error,
    required,
    disabled
  }));

  // Consumer-supplied `aria-describedby` (e.g. an external hint rendered
  // outside the component) merges with the internal error/helper chain
  // instead of being clobbered by it — internal descriptions first, the
  // consumer's supplemental one last.
  const describedBy = $derived(
    [ff.describedBy, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  function handleClear() {
    if (disabled || readonly) return;
    value = '';
    if (persisted) persisted.value = '';
    onClear?.();
    inputRef?.focus();
  }

  function handleLeftIconClick() {
    if (!disabled && onLeftIconClick) onLeftIconClick();
  }

  function handleRightIconClick() {
    if (!disabled && onRightIconClick) onRightIconClick();
  }

  function handleKeydown(event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }) {
    if (event.key === 'Escape' && shouldShowClear) {
      event.preventDefault();
      handleClear();
    }
    // Forward the consumer's onkeydown (NumberInput's Arrow-step, etc.) — Input's
    // own handler is hardcoded on the element, so without this it would swallow it.
    userOnKeydown?.(event);
  }

  $effect(() => {
    if (persisted) persisted.value = (value as unknown as string) ?? '';
  });
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

  <div
    class={unstyled
      ? (slotClasses?.container ?? '')
      : styles.container({ class: slotClasses?.container })}
  >
    {#if leftIcon}
      <div
        class={unstyled
          ? (slotClasses?.iconContainer ?? '')
          : styles.iconContainer({ iconPosition: 'left', class: slotClasses?.iconContainer })}
      >
        {#if onLeftIconClick}
          <button
            type="button"
            class={unstyled
              ? (slotClasses?.iconButton ?? '')
              : styles.iconButton({ class: slotClasses?.iconButton })}
            onclick={handleLeftIconClick}
            {disabled}
            aria-label={leftIconAriaLabel}
          >
            {@render leftIcon()}
          </button>
        {:else}
          <span
            class={unstyled
              ? (slotClasses?.iconDecoration ?? '')
              : styles.iconDecoration({ class: slotClasses?.iconDecoration })}
          >
            {@render leftIcon()}
          </span>
        {/if}
      </div>
    {/if}

    <input
      {...restProps}
      bind:this={inputRef}
      {@attach mintAttachment(mint, { enabled: !disabled })}
      bind:value
      id={ff.fieldId}
      class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}
      {disabled}
      {readonly}
      {required}
      aria-invalid={ff.invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      onkeydown={handleKeydown}
    />

    {#if shouldShowClear}
      <div
        class={unstyled
          ? (slotClasses?.iconContainer ?? '')
          : styles.iconContainer({ iconPosition: 'right', class: slotClasses?.iconContainer })}
      >
        <button
          type="button"
          class={unstyled
            ? (slotClasses?.iconButton ?? '')
            : styles.iconButton({ class: slotClasses?.iconButton })}
          onclick={handleClear}
          aria-label={bt('accessibility.clearInput')}
        >
          <CloseIcon />
        </button>
      </div>
    {:else if effectiveRightIcon}
      <div
        class={unstyled
          ? (slotClasses?.iconContainer ?? '')
          : styles.iconContainer({ iconPosition: 'right', class: slotClasses?.iconContainer })}
      >
        {#if onRightIconClick}
          <button
            type="button"
            class={unstyled
              ? (slotClasses?.iconButton ?? '')
              : styles.iconButton({ class: slotClasses?.iconButton })}
            onclick={handleRightIconClick}
            {disabled}
            aria-label={rightIconAriaLabel}
          >
            {@render effectiveRightIcon()}
          </button>
        {:else}
          <span
            class={unstyled
              ? (slotClasses?.iconDecoration ?? '')
              : styles.iconDecoration({ class: slotClasses?.iconDecoration })}
          >
            {@render effectiveRightIcon()}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <CoreFieldMessage
    {error}
    {helper}
    errorId={ff.errorId}
    helperId={ff.helperId}
    class={unstyled
      ? (slotClasses?.message ?? '')
      : styles.message({ class: slotClasses?.message })}
  />

  {#if children}
    <div class="mt-1.5">
      {@render children()}
    </div>
  {/if}
</div>
