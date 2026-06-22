<script lang="ts">
  import { untrack } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import {
    autoUpdate,
    computePosition,
    flip,
    size as floatingSize,
    offset,
    shift
  } from '$lib/utils/floating';
  import { popoverVariants } from './popover.variants';
  import type { PopoverProps } from './index';

  let {
    children,
    trigger,
    triggerElement = $bindable(),

    placement = 'bottom-start',
    offsetDistance = 4,
    shiftPadding = 8,
    syncWidth = false,
    syncMinWidth = false,
    usePortal = true,

    open = $bindable(false),
    autoTrigger = true,
    size = 'md',

    onOpenChange,
    onClickOutside: onClickOutsideProp,
    onEscape: onEscapeProp,

    closeOnEscape = true,
    closeOnClickOutside = true,

    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    style = '',

    role = 'dialog',
    'aria-modal': ariaModal,
    id,

    ...restProps
  }: PopoverProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Popover', preset, { size }, slotClassesProp)
  );

  let internalTriggerElement = $state<HTMLElement | null>(null);
  let popoverElement = $state<HTMLElement | null>(null);
  let cleanupFloatingUI = $state<(() => void) | undefined>();

  const effectiveTriggerElement = $derived(triggerElement || internalTriggerElement);

  // Forward aria-expanded / aria-haspopup to the first interactive descendant
  // of the trigger wrapper. Without this, the wrapper div itself would need
  // those attributes — but axe flags `aria-expanded` on an element with no
  // interactive role as `aria-allowed-attr`. Consumers are expected to pass
  // an interactive trigger (Button, <a href>, native <button>). If not, the
  // attributes simply aren't set — a non-interactive trigger isn't WAI-ARIA
  // compliant anyway.
  //
  // Cleanup removes the attributes when the effect re-runs or the component
  // unmounts, so a swapped-out trigger doesn't keep stale aria-expanded.
  $effect(() => {
    const wrapper = internalTriggerElement;
    if (!wrapper || !autoTrigger) return;

    const interactive = wrapper.querySelector<HTMLElement>('button, a[href], [role="button"]');
    if (!interactive) return;

    interactive.setAttribute('aria-expanded', String(open));
    interactive.setAttribute('aria-haspopup', 'dialog');
    return () => {
      interactive.removeAttribute('aria-expanded');
      interactive.removeAttribute('aria-haspopup');
    };
  });

  const popoverClasses = $derived(
    [unstyled ? '' : popoverVariants({ size }), slotClasses?.base, className]
      .filter(Boolean)
      .join(' ')
  );

  // ── Dismiss mode ──────────────────────────────────────────
  //
  // When both close conditions are at their default (true), we use the
  // native `popover="auto"` behavior — the browser handles Escape and
  // light dismiss for free, including stacking (one auto-popover at a
  // time) and inert handling. The toggle event tells us which path the
  // dismiss came from so we can fire the right callback.
  //
  // When either condition is `false` we switch to `popover="manual"` and
  // wire up our own listeners for the dismiss paths that remain enabled.
  // Manual mode disables the browser's automatic dismiss entirely, which
  // is the only way to veto Escape or outside-click selectively — the
  // `beforetoggle` event is intentionally not cancelable when closing.
  const popoverMode = $derived<'auto' | 'manual'>(
    closeOnEscape && closeOnClickOutside ? 'auto' : 'manual'
  );

  // ── Native popover state sync (popover="auto" mode only) ──

  // Track if the dismiss was caused by clicking the trigger (pointerdown → light dismiss).
  // This prevents the click handler from re-opening the popover after light dismiss closed it.
  let dismissedByTrigger = false;

  // Track Escape key to distinguish from click-outside in the toggle handler,
  // so we fire onEscape vs onClickOutside correctly.
  let escapePending = false;

  $effect(() => {
    if (!open || popoverMode !== 'auto') return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') escapePending = true;
    }
    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  });

  // For external triggers (autoTrigger=false), track pointerdown to coordinate
  // with light dismiss — prevents toggle-on-click when the trigger click causes dismiss.
  $effect(() => {
    if (!effectiveTriggerElement || autoTrigger) return;
    function handlePointerDown() {
      if (open) dismissedByTrigger = true;
    }
    effectiveTriggerElement.addEventListener('pointerdown', handlePointerDown);
    return () => effectiveTriggerElement.removeEventListener('pointerdown', handlePointerDown);
  });

  // Listen for native popover toggle events (light dismiss, Escape, programmatic).
  // Only relevant in `auto` mode — in manual mode the browser doesn't fire
  // toggle events for outside clicks or Escape, so the dismiss callbacks
  // come from our own listeners below.
  $effect(() => {
    if (!popoverElement || popoverMode !== 'auto') return;
    function handleToggle(e: Event) {
      const toggle = e as ToggleEvent;
      if (toggle.newState === 'closed' && open) {
        const wasEscape = escapePending;
        const wasTrigger = dismissedByTrigger;
        escapePending = false;
        // Don't reset dismissedByTrigger here — the click handler still needs it

        open = false;
        onOpenChange?.(false);

        if (wasEscape) {
          onEscapeProp?.();
        } else if (!wasTrigger) {
          onClickOutsideProp?.();
        }

        if (!wasTrigger) {
          effectiveTriggerElement?.focus();
        }
      }
    }
    popoverElement.addEventListener('toggle', handleToggle);
    return () => popoverElement?.removeEventListener('toggle', handleToggle);
  });

  // ── Manual-mode dismiss listeners ─────────────────────────
  //
  // In manual mode the browser does not auto-dismiss the popover, so we
  // implement the dismiss paths that remain enabled. Each listener is
  // gated by both `open` and the relevant `closeOn*` prop so the right
  // set of behaviors stays active when only one of the two is disabled.

  $effect(() => {
    if (!open || popoverMode !== 'manual' || !closeOnEscape) return;
    // Bubble phase intentionally — inner widgets (e.g. an editable input
    // inside the popover) get the first chance to handle Escape via
    // `e.preventDefault()` or `e.stopPropagation()`. Capture phase would
    // close the popover before the inner widget could react. The
    // `defaultPrevented` guard then honors inner widgets that
    // intentionally consume Escape.
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      open = false;
      onOpenChange?.(false);
      onEscapeProp?.();
      effectiveTriggerElement?.focus();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  });

  $effect(() => {
    if (!open || popoverMode !== 'manual' || !closeOnClickOutside) return;
    // Capture phase here is correct — pointerdown fires before click, and
    // we need to know whether the target is inside the popover or trigger
    // before any inner click handler runs. The `contains` checks correctly
    // exclude descendants even when the popover is in the top layer
    // (top-layer rendering changes paint, not DOM containment).
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverElement?.contains(target)) return;
      if (effectiveTriggerElement?.contains(target)) return;
      open = false;
      onOpenChange?.(false);
      onClickOutsideProp?.();
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  });

  // ── Mode-change re-cycle ───────────────────────────────────
  //
  // The browser binds a popover's dismiss semantics (Escape / light
  // dismiss / focus restoration) at `showPopover()` time based on the
  // `popover` attribute value AT THAT MOMENT. Changing the attribute
  // afterward updates the DOM but does NOT rebind the semantics — the
  // browser keeps routing Escape natively even though we switched to
  // `popover="manual"`. To pick up the new mode while the popover is
  // open, hide + re-show.
  // `prevPopoverMode` is a non-reactive tracker — we deliberately want the
  // *previous* value of `popoverMode`, not the current one, so we seed it
  // via `untrack` and update it manually inside the effect.
  let prevPopoverMode: 'auto' | 'manual' = untrack(() => popoverMode);
  $effect(() => {
    if (popoverMode === prevPopoverMode) return;
    prevPopoverMode = popoverMode;
    if (!open || !popoverElement?.matches(':popover-open')) return;
    try {
      popoverElement.hidePopover();
      popoverElement.showPopover();
    } catch (err) {
      console.warn('[Popover] re-cycle on mode change failed', err);
    }
  });

  // ── Floating UI positioning + native show/hide ─────────────

  $effect(() => {
    if (!open || !effectiveTriggerElement || !popoverElement) {
      if (popoverElement?.matches(':popover-open')) {
        try {
          popoverElement.hidePopover();
        } catch (err) {
          // Pre-check eliminated "already hidden"; real causes are
          // detached elements or popover API absence. Surface to telemetry.
          console.warn('[Popover] hidePopover failed', err);
        }
      }
      return;
    }

    // Show the popover in the top layer so it has layout for positioning
    if (!popoverElement.matches(':popover-open')) {
      try {
        popoverElement.showPopover();
      } catch (err) {
        // Real causes: legacy browser without Popover API (Safari < 17,
        // Chrome < 114, Firefox < 125), element detached, or `popover`
        // attribute overridden by a consumer via restProps.
        console.warn('[Popover] showPopover failed', err);
      }
    }

    const updatePosition = () => {
      if (!effectiveTriggerElement || !popoverElement) return;

      return computePosition(effectiveTriggerElement, popoverElement, {
        placement,
        // `fixed` is the right strategy when the panel sits in the popover
        // top layer (viewport-coordinated); `absolute` matches the in-flow
        // mode where the panel is positioned relative to the trigger's
        // offset parent.
        strategy: usePortal ? 'fixed' : 'absolute',
        middleware: [
          offset(offsetDistance),
          flip(),
          shift({ padding: shiftPadding }),
          floatingSize({
            apply({ rects }) {
              if (!popoverElement) return;
              // `syncWidth` clamps the panel to the trigger width exactly
              // (Select/Combobox semantics — items longer than the field
              // truncate or wrap). `syncMinWidth` is the looser Menu-style
              // variant: panel ≥ trigger.width, but content is free to grow
              // it. Hard sync wins if both are set.
              popoverElement.style.width = syncWidth ? `${rects.reference.width}px` : '';
              popoverElement.style.minWidth =
                !syncWidth && syncMinWidth ? `${rects.reference.width}px` : '';
            }
          })
        ]
      })
        .then(({ x, y }) => {
          if (!popoverElement) return;
          // `autoUpdate` may fire after the trigger has detached, in which
          // case Floating UI returns NaN. Bail rather than writing `NaNpx`.
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          Object.assign(popoverElement.style, {
            left: `${x}px`,
            top: `${y}px`
          });
        })
        .catch((err) => {
          // Middleware can throw synchronously (e.g. geometry read on a
          // detached node). Without a catch this becomes an unhandled
          // rejection with no Popover context.
          console.warn('[Popover] computePosition failed', err);
        });
    };

    updatePosition();
    cleanupFloatingUI = autoUpdate(effectiveTriggerElement, popoverElement, updatePosition);

    return () => {
      cleanupFloatingUI?.();
      cleanupFloatingUI = undefined;
      if (popoverElement?.matches(':popover-open')) {
        try {
          popoverElement.hidePopover();
        } catch (err) {
          console.warn('[Popover] hidePopover failed', err);
        }
      }
    };
  });

  // ── Trigger handlers ───────────────────────────────────────

  function handleTriggerPointerDown() {
    if (open) dismissedByTrigger = true;
  }

  function handleTriggerClick(event: MouseEvent) {
    event.stopPropagation();
    if (dismissedByTrigger) {
      dismissedByTrigger = false;
      return;
    }
    open = !open;
    onOpenChange?.(open);
  }

  function handleTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      open = !open;
      onOpenChange?.(open);
    }
  }
</script>

{#if trigger}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={internalTriggerElement}
    class="inline-flex"
    onclick={autoTrigger ? handleTriggerClick : undefined}
    onkeydown={autoTrigger ? handleTriggerKeydown : undefined}
    onpointerdown={autoTrigger ? handleTriggerPointerDown : undefined}
  >
    {@render trigger()}
  </div>
{/if}

<!--
  Load-bearing attributes (`popover`, `role`, `id`, `aria-modal`) follow
  `{...restProps}` so a consumer-supplied `popover="manual"` or override
  of `role`/`id` cannot silently break the show/hide flow or ARIA pairing.

  The explicit `style` prop is interpolated FIRST so that the load-bearing
  positioning tokens (`position: fixed`, `margin: 0`, `inset: auto`) come
  last and win the CSS cascade. A consumer passing `style="background:
  red"` still works; a consumer passing `style="position: absolute"`
  cannot accidentally break Floating UI's coordinate system.
-->
<!--
  `usePortal=false` mode renders the panel in the regular DOM flow with
  `position: absolute`, anchored to the trigger's offset parent. The
  `popover` attribute is suppressed so the browser does not promote the
  element to the top layer; Floating UI still drives `left` / `top` via
  the existing autoUpdate effect, and the `open`/`!open` toggle just
  shows / hides the element. Used by Menu / Select consumers that live
  inside another popover (avoids nested-top-layer focus & z-index quirks).
-->
<div
  bind:this={popoverElement}
  class={popoverClasses}
  {...restProps}
  popover={usePortal ? popoverMode : null}
  style={usePortal
    ? `${style}; position: fixed; margin: 0; inset: auto;`
    : open
      ? `${style}; position: absolute; margin: 0; inset: auto;`
      : `${style}; position: absolute; margin: 0; inset: auto; display: none;`}
  {role}
  aria-modal={ariaModal || undefined}
  {id}
>
  {#if open}
    {@render children()}
  {/if}
</div>
