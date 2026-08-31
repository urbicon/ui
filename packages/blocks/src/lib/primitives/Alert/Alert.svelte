<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { alertVariants, type AlertVariants } from './alert.variants';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { AlertProps } from './index';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    intent = 'primary',
    variant = 'soft',
    size = 'md',
    title,
    children,
    icon,
    actions,
    dismissible = false,
    onDismiss,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: AlertProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: AlertVariants = $derived({ intent, variant, size });
  const styles = $derived(alertVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Alert', preset, variantProps, slotClassesProp)
  );
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  role="alert"
  {...restProps}
>
  {#if icon}
    <div class={unstyled ? (slotClasses?.icon ?? '') : styles.icon({ class: slotClasses?.icon })}>
      {@render icon()}
    </div>
  {/if}

  <div
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
  >
    {#if title}
      <div
        class={unstyled ? (slotClasses?.title ?? '') : styles.title({ class: slotClasses?.title })}
      >
        {title}
      </div>
    {/if}
    {#if children}
      <div
        class={unstyled
          ? (slotClasses?.description ?? '')
          : styles.description({ class: slotClasses?.description })}
      >
        {@render children()}
      </div>
    {/if}
    {#if actions}
      <div
        class={unstyled
          ? (slotClasses?.actions ?? '')
          : styles.actions({ class: slotClasses?.actions })}
      >
        {@render actions()}
      </div>
    {/if}
  </div>

  {#if dismissible}
    <button
      type="button"
      class={unstyled
        ? (slotClasses?.dismissButton ?? '')
        : styles.dismissButton({ class: slotClasses?.dismissButton })}
      onclick={onDismiss}
      aria-label={bt('accessibility.dismiss')}
    >
      <CloseIcon class="h-4 w-4" />
    </button>
  {/if}
</div>
