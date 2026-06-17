<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { toastVariants, type ToastVariants } from './toast.variants';
  import { toaster } from './toast.store.svelte';
  import { resolveIcon, type IconComponent } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import InfoCircleIconDefault from '$lib/icons/InfoCircleIcon.svelte';
  import SuccessCircleIconDefault from '$lib/icons/SuccessCircleIcon.svelte';
  import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
  import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { ToastProps } from './index';

  const bt = useBlocksI18n();

  const CloseIcon = resolveIcon('close', CloseIconDefault);

  const INTENT_ICON_MAP: Record<string, IconComponent> = {
    primary: resolveIcon('info', InfoCircleIconDefault),
    info: resolveIcon('info', InfoCircleIconDefault),
    success: resolveIcon('success', SuccessCircleIconDefault),
    warning: resolveIcon('warning', WarningTriangleIconDefault),
    danger: resolveIcon('danger', DangerCircleIconDefault),
    neutral: resolveIcon('info', InfoCircleIconDefault)
  };

  let {
    placement = 'bottom-right',
    max = 5,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ToastProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Toaster?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Toaster', preset),
      slotClassesProp
    )
  );

  $effect(() => {
    toaster.placement = placement;
  });

  $effect(() => {
    return toaster.registerSubscriber();
  });

  const visibleToasts = $derived(toaster.toasts.slice(-max));

  const styles = $derived(
    unstyled
      ? {
          container: () => '',
          toast: () => '',
          icon: () => '',
          content: () => '',
          title: () => '',
          description: () => '',
          dismissButton: () => '',
          progress: () => ''
        }
      : toastVariants({ placement })
  );

  function slot(key: keyof typeof styles, intent?: string) {
    const overrides = slotClasses?.[key];
    if (unstyled) return overrides ?? '';
    if (intent) {
      const intentStyles = toastVariants({ placement, intent: intent as ToastVariants['intent'] });
      return intentStyles[key]({ class: overrides });
    }
    return styles[key]({ class: overrides });
  }

  function flyParams() {
    const isBottom = placement.startsWith('bottom');
    const isRight = placement.endsWith('right');
    const isLeft = placement.endsWith('left');
    return {
      y: isBottom ? 20 : -20,
      x: isRight ? 20 : isLeft ? -20 : 0,
      duration: 250,
      easing: quintOut
    };
  }
</script>

<div
  class={[slot('container'), className].filter(Boolean).join(' ')}
  aria-live="polite"
  aria-relevant="additions removals"
  {...restProps}
>
  {#each visibleToasts as toast (toast.id)}
    {@const IntentIcon = INTENT_ICON_MAP[toast.intent] ?? INTENT_ICON_MAP.neutral}
    <div class={slot('toast', toast.intent)} role="alert" transition:fly={flyParams()}>
      <IntentIcon class={slot('icon', toast.intent)} />

      <div class={slot('content')}>
        {#if toast.title}
          <div class={slot('title')}>{toast.title}</div>
        {/if}
        {#if toast.description}
          <div class={slot('description')}>{toast.description}</div>
        {/if}
      </div>

      {#if toast.dismissible}
        <button
          type="button"
          class={slot('dismissButton')}
          onclick={() => toaster.dismiss(toast.id)}
          aria-label={bt('accessibility.dismiss')}
        >
          <CloseIcon class="h-4 w-4" />
        </button>
      {/if}

      {#if toast.showProgress && toast.duration > 0}
        <div
          class={slot('progress', toast.intent)}
          style="animation: blocks-toast-progress {toast.duration}ms linear forwards;"
        ></div>
      {/if}
    </div>
  {/each}
</div>

<style>
  @keyframes -global-blocks-toast-progress {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
</style>
