<script lang="ts">
  import { useBlocksI18n, mintRegistry, createPersistentState } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useFormField, getTierContext } from '$lib/utils';
  import type { InputProps } from '.';
  import { inputVariants, type InputVariants } from './input.variants';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';

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
    disabled: disabled || undefined,
    readonly: readonly || undefined,
    error: !!error || undefined,
    required: required || undefined,
    hasLeftIcon: hasLeftIcon || undefined,
    hasRightIcon: hasRightIcon || undefined,
    messageType: error ? 'error' : 'helper'
  });

  const styles = $derived(inputVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Input', preset, variantProps, slotClassesProp)
  );

  // ARIA wiring is shared with every form primitive — see XC-2.
  const propsId = $props.id();
  const ff = useFormField(() => ({
    fieldId: `input-${propsId}`,
    hint: helper,
    error,
    required,
    disabled
  }));

  $effect(() => {
    if (inputRef && mint && mint !== 'none' && !disabled) {
      return mintRegistry.apply(inputRef, mint);
    }
  });

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

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && shouldShowClear) {
      event.preventDefault();
      handleClear();
    }
  }

  $effect(() => {
    if (persisted) persisted.value = (value as unknown as string) ?? '';
  });
</script>

<div
  class={unstyled
    ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
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
      bind:value
      id={ff.fieldId}
      class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}
      {disabled}
      {readonly}
      {required}
      aria-invalid={ff.invalid ? 'true' : undefined}
      aria-describedby={ff.describedBy}
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

  {#if ff.errorId}
    <div
      id={ff.errorId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
      role="alert"
    >
      {error}
    </div>
  {:else if ff.hintId}
    <div
      id={ff.hintId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {helper}
    </div>
  {/if}

  {#if children}
    <div class="mt-1.5">
      {@render children()}
    </div>
  {/if}
</div>
