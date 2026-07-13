<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { fly } from 'svelte/transition';
  import { getOverlayMotion } from '$lib/utils';
  import { toastVariants, type ToastVariants } from './toast.variants';
  import { toaster } from './toast.store.svelte';
  import { resolveIcon, type IconComponent } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import InfoCircleIconDefault from '$lib/icons/InfoCircleIcon.svelte';
  import SuccessCircleIconDefault from '$lib/icons/SuccessCircleIcon.svelte';
  import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
  import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import Spinner from '../Spinner/Spinner.svelte';
  import type { ToastData, ToastProps } from './index';

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
    transitionDuration,
    transitionEasing,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ToastProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  // Component-level slot-class cascade. Per-toast `intent` is NOT part of
  // activeProps — it is applied per row in the `slot(key, intent)` helper via
  // its own `toastVariants({ placement, intent })` call (see below).
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Toaster', preset, { placement }, slotClassesProp)
  );

  $effect(() => {
    toaster.placement = placement;
  });

  $effect(() => {
    return toaster.registerSubscriber();
  });

  // Sonner-style hover-to-pause. The pointer or keyboard focus being anywhere in
  // the toaster region freezes the whole visible stack (all auto-dismiss timers
  // + the progress bars) and leaving resumes each from its remaining time.
  //
  // These are bubbling over/out + focusin/focusout, NOT pointerenter/leave: the
  // container is `pointer-events-none` (so clicks fall through the gaps between
  // toasts to the page), which means it never becomes a pointer target itself —
  // only its `pointer-events-auto` toast children do. enter/leave don't bubble
  // and so would never fire here; over/out bubble up from the toasts. The
  // `relatedTarget` containment check collapses the noisy per-descendant out/blur
  // events into a single "the pointer/focus actually left the region" signal.
  let pointerInside = $state(false);
  let focusInside = $state(false);

  $effect(() => {
    if (pointerInside || focusInside) toaster.pause();
    else toaster.resume();
  });

  // Safety net: if the Toaster unmounts while the stack is frozen (pointer/focus
  // was still inside), un-freeze the singleton store so its timers aren't stranded.
  $effect(() => {
    return () => toaster.resume();
  });

  function leftRegion(event: PointerEvent | FocusEvent) {
    const next = event.relatedTarget as Node | null;
    return !(event.currentTarget as HTMLElement).contains(next);
  }

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
          actions: () => '',
          actionButton: () => '',
          cancelButton: () => '',
          dismissButton: () => '',
          progress: () => ''
        }
      : toastVariants({ placement })
  );

  // Run a toast action/cancel button: fire its handler, then dismiss unless the
  // action opted out (`dismissOnClick: false`, e.g. a "Retry" that re-issues the
  // async work and updates the same toast).
  function runAction(toast: ToastData, which: 'action' | 'cancel') {
    const action = toast[which];
    if (!action) return;
    action.onClick?.(toast.id);
    if (action.dismissOnClick !== false) toaster.dismiss(toast.id);
  }

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
    // Enter/exit motion resolved from the shared overlay tokens
    // (--blocks-overlay-*, same source as Dialog/Drawer): a global theme or
    // `prefers-reduced-motion` retunes every toast, and the two props override
    // it per toaster instance. Resolved per toast so the live reduced-motion
    // value applies; `fly` is symmetric here, so the enter duration drives both
    // directions.
    const motion = getOverlayMotion({
      enterDuration: transitionDuration,
      exitDuration: transitionDuration,
      easing: transitionEasing
    });
    return {
      y: isBottom ? 20 : -20,
      x: isRight ? 20 : isLeft ? -20 : 0,
      duration: motion.enterDuration,
      easing: motion.easing
    };
  }
</script>

<div
  class={[slot('container'), className].filter(Boolean).join(' ')}
  aria-live="polite"
  aria-relevant="additions removals"
  onpointerover={() => (pointerInside = true)}
  onpointerout={(e) => {
    if (leftRegion(e)) pointerInside = false;
  }}
  onfocusin={() => (focusInside = true)}
  onfocusout={(e) => {
    if (leftRegion(e)) focusInside = false;
  }}
  {...restProps}
>
  {#each visibleToasts as toast (toast.id)}
    {@const IntentIcon = INTENT_ICON_MAP[toast.intent] ?? INTENT_ICON_MAP.neutral}
    <div class={slot('toast', toast.intent)} role="alert" transition:fly={flyParams()}>
      {#if toast.loading}
        <span class={slot('icon', toast.intent)}><Spinner size="sm" /></span>
      {:else}
        <IntentIcon class={slot('icon', toast.intent)} />
      {/if}

      <div class={slot('content')}>
        {#if toast.title}
          <div class={slot('title')}>{toast.title}</div>
        {/if}
        {#if toast.description}
          <div class={slot('description')}>{toast.description}</div>
        {/if}
        {#if toast.action || toast.cancel}
          <div class={slot('actions')}>
            {#if toast.action}
              <button
                type="button"
                class={slot('actionButton')}
                onclick={() => runAction(toast, 'action')}
              >
                {toast.action.label}
              </button>
            {/if}
            {#if toast.cancel}
              <button
                type="button"
                class={slot('cancelButton')}
                onclick={() => runAction(toast, 'cancel')}
              >
                {toast.cancel.label}
              </button>
            {/if}
          </div>
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

      {#if toast.showProgress && Number.isFinite(toast.duration) && toast.duration > 0}
        <!-- Duration comes from the toast itself (the real countdown), not a token.
             `animation-play-state` tracks the store's paused flag so the bar freezes
             with the timer on hover/focus and resumes in place — changing only the
             play-state never restarts the animation. -->
        <div
          class={slot('progress', toast.intent)}
          style="animation: blocks-toast-progress {toast.duration}ms linear forwards; animation-play-state: {toaster.paused
            ? 'paused'
            : 'running'};"
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
