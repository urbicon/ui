<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { untrack } from 'svelte';
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
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreSpinner from '$lib/internal/core/CoreSpinner.svelte';
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

  // Stranded-pause guard. A toast removed from under the cursor (e.g. its own
  // close button) does not reliably fire `pointerout`, so `pointerInside` can
  // stay stuck `true` and freeze every remaining timer — worst case a fresh
  // toast is then born paused and never counts down. Rather than trust the flag,
  // when the rendered stack SHRINKS we re-derive containment from the real cursor
  // position. The cursor is tracked from the region's own bubbling pointer events
  // (the container is `pointer-events-none`, so these fire only over a toast
  // child, which is exactly when the coords matter).
  let containerEl: HTMLElement | undefined;
  let pointerX = 0;
  let pointerY = 0;
  let prevVisibleCount = 0;

  function reconcilePointerInside() {
    // Only a stranded `true` needs rescuing; SSR-safe — effects/handlers never
    // run on the server, and `document` is guarded regardless.
    if (typeof document === 'undefined' || !pointerInside || !containerEl) return;
    const hit = document.elementFromPoint(pointerX, pointerY);
    const toastEl = (hit?.closest('[data-toast-id]') ?? null) as HTMLElement | null;
    // Inside only if the cursor sits over a toast that is (a) in THIS region and
    // (b) still live — not the just-removed one, whose node lingers through its
    // fly-out outro.
    pointerInside =
      !!toastEl &&
      containerEl.contains(toastEl) &&
      visibleToasts.some((t) => t.id === toastEl.dataset.toastId);
  }

  $effect(() => {
    const count = visibleToasts.length;
    untrack(() => {
      if (count < prevVisibleCount) reconcilePointerInside();
      prevVisibleCount = count;
    });
  });

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

  function slot(key: keyof typeof styles, intent?: string, extra?: string) {
    const overrides = [slotClasses?.[key], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
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
  bind:this={containerEl}
  class={slot('container', undefined, className)}
  aria-live="polite"
  aria-relevant="additions removals"
  onpointerover={(e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    pointerInside = true;
  }}
  onpointermove={(e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  }}
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
    <div
      class={slot('toast', toast.intent)}
      role="alert"
      aria-atomic="true"
      data-toast-id={toast.id}
      transition:fly={flyParams()}
    >
      {#if toast.loading}
        <!--
          CoreSpinner instead of the public Spinner (see internal/core/).
          Deliberate a11y delta: the old embedded Spinner emitted role="status" +
          aria-live + an sr-only "Loading..." label — a live region NESTED inside
          the toast's own role="alert" region. The core emits no semantics; the
          toast region owns the announcement. The spinner follows the toast intent
          like every other status glyph: with no explicit colour it inherits
          `text-current` from the intent-coloured `slot('icon', intent)` span
          (success → text-success-text, neutral → text-text-secondary, …), so a
          success/danger loading toast no longer shows a brand-primary spinner.
        -->
        <span class={slot('icon', toast.intent)}><CoreSpinner size="sm" /></span>
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
        <!-- The countdown animation lives in the `<style>` rule below (not inline)
             so `@media (prefers-reduced-motion: reduce)` can reach it — an inline
             `animation` shorthand is invisible to media queries. Only the real
             per-toast duration is passed inline, as a custom property.
             `animation-play-state` (also inline, bound to the store's paused flag)
             freezes the bar with the timer on hover/focus and resumes it in place;
             inline wins over the rule's implicit `running`, and toggling only the
             play-state never restarts the animation. -->
        <div
          class={[slot('progress', toast.intent), 'blocks-toast-progress-bar']}
          style="--toast-progress-duration: {toast.duration}ms; animation-play-state: {toaster.paused
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

  /* The countdown bar animates via this class (not an inline `animation`) so the
     reduced-motion query below can reach it; the per-toast duration arrives as
     the `--toast-progress-duration` custom property. `:global` keeps it off
     Svelte's scoping, consistent with the global keyframe above. */
  :global(.blocks-toast-progress-bar) {
    animation: blocks-toast-progress var(--toast-progress-duration) linear forwards;
  }

  /* A countdown bar carries no information once it can't animate, so under
     reduced motion we hide it outright rather than leave it frozen. This mirrors
     interaction.css collapsing the motion tokens; the auto-dismiss timing itself
     is unaffected. */
  @media (prefers-reduced-motion: reduce) {
    :global(.blocks-toast-progress-bar) {
      display: none;
    }
  }
</style>
