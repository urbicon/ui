<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useFloatingPanel, floatingPanelHidden, maxTransitionDurationMs } from '$lib/utils';
  import { popoverVariants } from './popover.variants';
  import type { PopoverProps } from './index';

  let {
    children,
    trigger,
    triggerElement = $bindable(),

    placement = 'bottom-start',
    // 4 is a real 4 since #197. Before that fix the panel was measured mid-enter,
    // while `popoverMotion` still had it at `scale(0.98)`, and the resulting
    // origin error pulled it a further 1% of its own height towards the trigger —
    // which is what "sits about two pixels too close" was. Raising the default
    // was considered and dropped: it would have compensated a measurement bug
    // with a design value. Menu overrides this per tier (8 / 4).
    offsetDistance = 4,
    shiftPadding = 8,
    syncWidth = false,
    syncMinWidth = false,
    usePortal = true,

    open = $bindable(false),
    autoTrigger = true,
    inline = false,
    size = 'md',

    transitionDuration,
    transitionEasing,

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

  // Per-instance motion overrides. Set the shared popover CSS variables inline
  // only when a prop is provided, so the unset default keeps inheriting the
  // reduced-motion-aware token (mirrors Tooltip's transitionDuration path).
  const popoverDurationInline = $derived(
    transitionDuration != null ? `${transitionDuration}ms` : undefined
  );

  let internalTriggerElement = $state<HTMLElement | null>(null);
  let popoverElement = $state<HTMLElement | null>(null);

  // `inline` mode keeps the panel out of the server render entirely — a `<div>`
  // start tag closes an open `<p>`, and the panel is a `<div>` whose children are
  // the consumer's, so no wrapper element can make it phrasing-safe.
  //
  // This is NOT a hydration hazard, it is the cure for one: the flag starts false
  // on the client too, so the first client render matches the server output, and
  // the panel is appended only afterwards. `onMount` (rather than an `$effect`
  // assigning state) is what pins that ordering — it is the one hook that means
  // "after the first client render, and never on the server", which is exactly
  // the condition being expressed.
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const panelRendered = $derived(!inline || hydrated);

  const effectiveTriggerElement = $derived(triggerElement || internalTriggerElement);

  // ── Exit-motion lag (ACC-3 rest) ───────────────────────────
  //
  // Closing used to tear three things down in one flush: `open` flips, the
  // children block unmounts, and `useFloatingPanel` hides the panel. The CSS
  // exit transition (see `popoverMotion` in popover.variants.ts) keeps the
  // *panel element* painted via `allow-discrete`, but the children must
  // outlive `open` or the panel fades out empty. `exiting` lags the teardown
  // by the panel's actual computed transition duration — read from the live
  // style so per-instance props, theme token overrides, and reduced motion all
  // shorten it automatically. A zero duration (jsdom/node tests, browsers
  // without the CSS, `unstyled` without rebuilt motion) tears down
  // synchronously: exactly the pre-motion behaviour.
  //
  // `$effect.pre` matters: the flag must be `true` in the SAME flush that
  // renders `open === false`, otherwise the children unmount one frame before
  // the lag starts. The `prevOpenForExit` tracker (non-reactive, seeded via
  // `untrack` like `prevPopoverMode` below) keeps the effect keyed on real
  // transitions — without it, the `bind:this` assignment would re-run the
  // effect on mount and flash a closed-by-default popover open for one lag.
  const EXIT_MOTION_BUFFER_MS = 50;
  let exiting = $state(false);
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let prevOpenForExit = untrack(() => open);
  $effect.pre(() => {
    if (open === prevOpenForExit) return;
    prevOpenForExit = open;
    if (open) {
      clearTimeout(exitTimer);
      exiting = false;
      return;
    }
    const ms = maxTransitionDurationMs(untrack(() => popoverElement));
    if (ms <= 0) return;
    exiting = true;
    exitTimer = setTimeout(() => {
      exiting = false;
    }, ms + EXIT_MOTION_BUFFER_MS);
  });

  // While `exiting`, the panel is still fading: keep children mounted and (in
  // the in-place modes) keep `display` un-hidden. `useFloatingPanel` stays on
  // the raw `open` on purpose — `hidePopover()` fires immediately and the
  // discrete transition carries the visual exit, so a re-open during the fade
  // reverses smoothly instead of waiting out the lag.
  const panelVisible = $derived(open || exiting);

  // ── Floating UI positioning + native show/hide ─────────────
  //
  // Delegated to the shared `useFloatingPanel` helper — the same positioning
  // codepath Select/Combobox use — so the iOS/visualViewport handling and the
  // keyboard-aware height cap (`--blocks-overlay-available-height`, consumed by
  // popoverVariants/menuVariants) land here too instead of being a second,
  // drifting copy. The helper drives `showPopover()`/`hidePopover()` purely from
  // `open` and reports the effective render mode (`panel.topLayer` /
  // `panel.strategy`), read below by `popoverMode` (so a panel that leaves the
  // top layer inside a modal dialog switches to manual dismiss) and by the panel
  // markup. The `popover="auto"`/`"manual"` dismiss wiring stays independent of
  // show/hide.
  const panel = useFloatingPanel({
    reference: () => effectiveTriggerElement,
    floating: () => popoverElement,
    open: () => open,
    portal: () => usePortal,
    placement: () => placement,
    offsetDistance: () => offsetDistance,
    shiftPadding: () => shiftPadding,
    syncWidth: () => syncWidth,
    syncMinWidth: () => syncMinWidth
  });

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
  //
  // `autoTrigger=false` (external trigger) ALSO forces manual mode. Native
  // `popover="auto"` light-dismiss treats the external trigger as "outside"
  // (the browser only exempts a real `popovertarget` invoker, which we do
  // not wire through Floating UI). So a tap on an open external trigger
  // light-dismisses the popover on `pointerdown`, then the consumer's own
  // `onclick` toggle re-opens it — the close-then-reopen flicker seen on
  // mobile. Manual mode's outside-pointerdown handler instead excludes the
  // trigger via `contains`, so the consumer's toggle is the single source
  // of truth. Deterministic across browsers; no reliance on light-dismiss
  // timing. Consumers with an external CLICK trigger (Menu, DatePicker)
  // get a clean toggle; hover-driven external triggers (Calendar event
  // popovers) are unaffected since they never relied on light-dismiss.
  // A panel that is NOT top-layer-promoted (nested in a modal dialog → Codeberg
  // #23) emits no native `toggle` events, so `auto` mode's browser-driven
  // Escape / light-dismiss never fires. Force `manual` there so the explicit
  // Escape / outside-pointerdown listeners below own the dismiss instead.
  const popoverMode = $derived<'auto' | 'manual'>(
    panel.topLayer && autoTrigger && closeOnEscape && closeOnClickOutside ? 'auto' : 'manual'
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
          focusTrigger();
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
      // Re-check `open` (like the auto-mode toggle handler does): the
      // listener teardown is deferred to the next effect flush, so a
      // consumer handler earlier in this same dispatch may already have
      // closed via `bind:open` — without this guard we'd report a second,
      // transition-less onOpenChange(false) + onEscape and steal focus.
      if (!open) return;
      e.preventDefault();
      open = false;
      onOpenChange?.(false);
      onEscapeProp?.();
      focusTrigger();
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
      // Same deferred-teardown re-check as handleEscape above: a consumer
      // capture-phase pointerdown handler may have closed via `bind:open`
      // within this dispatch — don't report a second close.
      if (!open) return;
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

  // ── Trigger handlers ───────────────────────────────────────

  // Restore focus to the trigger after a dismiss. The snippet trigger is
  // wrapped in a plain (non-focusable) div — `focus()` on it is a spec no-op —
  // so target the interactive descendant instead (same query as the
  // aria-expanded effect). An external `triggerElement` is the consumer's
  // real control: focus it directly.
  function focusTrigger() {
    const target =
      triggerElement ??
      internalTriggerElement?.querySelector<HTMLElement>(
        'button, a[href], [role="button"], [tabindex]'
      ) ??
      internalTriggerElement;
    target?.focus();
  }

  // Un-arm `dismissedByTrigger` at the start of the NEXT pointer gesture,
  // wherever it lands. Registered as a one-shot capture listener when the
  // guard arms: capture order (document before trigger) guarantees a stale
  // flag is cleared before any new arm, and `once` keeps at most one listener
  // pending. This closes the aborted-click hole (pointerdown on the trigger,
  // pointer released elsewhere → no click ever consumed the flag → the next
  // trigger click was swallowed once).
  function disarmDismissedByTrigger() {
    dismissedByTrigger = false;
  }

  // Unmount cleanup for the imperative leftovers: a pending exit-lag timer
  // and a still-armed disarm listener. Dependency-free → runs once,
  // teardown on destroy.
  $effect(() => {
    return () => {
      clearTimeout(exitTimer);
      document.removeEventListener('pointerdown', disarmDismissedByTrigger, true);
    };
  });

  function handleTriggerPointerDown() {
    // Arm the "this pointerdown already dismissed it" guard only in auto
    // mode, where the browser's light dismiss really closes the popover
    // between pointerdown and click (the guard stops that click from
    // re-opening it). In manual mode nothing light-dismisses — the click
    // itself must toggle-close, so arming the guard there left the trigger
    // unable to close its own popover.
    if (open && popoverMode === 'auto') {
      dismissedByTrigger = true;
      // This event has already passed the document's capture phase, so the
      // listener can only fire on a LATER pointerdown.
      document.addEventListener('pointerdown', disarmDismissedByTrigger, {
        capture: true,
        once: true
      });
    }
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
  <!-- The a11y suppression is kept for the record, not because it fires: the
       compiler cannot know a `<svelte:element>`'s tag, so it emits no
       `a11y_no_static_element_interactions` here at all (verified — svelte-check
       reports the same six warnings with and without it, none in this file).
       The handlers below still sit on a non-interactive wrapper, which is the
       thing the rule is about; the trigger snippet supplies the real control. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svelte:element
    this={inline ? 'span' : 'div'}
    bind:this={internalTriggerElement}
    class="inline-flex"
    onclick={autoTrigger ? handleTriggerClick : undefined}
    onkeydown={autoTrigger ? handleTriggerKeydown : undefined}
    onpointerdown={autoTrigger ? handleTriggerPointerDown : undefined}
  >
    {@render trigger()}
  </svelte:element>
{/if}

<!--
  Load-bearing attributes (`popover`, `role`, `id`, `aria-modal`) follow
  `{...restProps}` so a consumer-supplied `popover="manual"` or override
  of `role`/`id` cannot silently break the show/hide flow or ARIA pairing.

  The consumer `style` prop is the static `style` attribute; the load-bearing
  positioning frame follows as per-property `style:` directives, which the
  browser applies on top of (and so win over) the consumer string. A consumer
  passing `style="background: red"` still works; `style="position: absolute"`
  is overridden by `style:position` and cannot break Floating UI's coordinates.
  Keep the prop static — a reactive `style` recompiles to `setAttribute('style')`
  and would momentarily wipe the directive + Floating UI writes.

  Non-top-layer render (`panel.topLayer === false`): the `popover` attribute is
  suppressed so the browser does not promote the element to the top layer; the
  `style:` directives drive `position` + `display` while Floating UI drives
  `left` / `top` and the hook stamps the in-place `z-index` imperatively. Per-property `style:` directives are used (never a single
  dynamic `style={…}` string) so Svelte's `setAttribute('style')` can't wipe the
  imperative `left`/`top` writes — the iOS `inset: auto` clobber (Codeberg #23).
  Two triggers:
    • `usePortal=false` (e.g. Menu / Select inside another popover) →
      `position: absolute`, avoiding nested-top-layer focus & z-index quirks.
    • nested in an open modal `<dialog>` → `position: fixed`, so the panel paints
      in the dialog's own top-layer subtree instead of a second popover WebKit
      drops over a modal dialog (Codeberg #23).
-->

<!--
  `data-state` sits after `{...restProps}` like the other load-bearing
  attributes: it drives the enter/exit motion CSS (popoverMotion) and is the
  documented styling hook for consumers rebuilding motion under `unstyled`.
  `{#if panelVisible}` (not `open`) keeps the children mounted while the exit
  transition plays; `style:display` follows the same lagged flag so the
  in-place modes can fade out before they hide.

  `inert` while closed (GuidePanel's pattern): the exit-fading children are
  still mounted and displayed, so without it a Tab right after dismiss would
  focus into the visually dismissed panel and Enter could re-fire a consumer
  action; pointer-events-none (popoverMotion) only covers mouse/touch. Also
  drops the fading subtree from the a11y tree immediately.
-->
{#if panelRendered}
  <div
    bind:this={popoverElement}
    class={popoverClasses}
    {...restProps}
    popover={panel.topLayer ? popoverMode : null}
    style={style || null}
    style:position={panel.strategy}
    style:inset="auto"
    style:margin="0"
    style:display={floatingPanelHidden(panel, panelVisible) ? 'none' : null}
    style:--blocks-popover-duration={popoverDurationInline}
    style:--blocks-popover-easing={transitionEasing}
    data-state={open ? 'open' : 'closed'}
    inert={!open || undefined}
    {role}
    aria-modal={ariaModal || undefined}
    {id}
  >
    {#if panelVisible}
      {@render children()}
    {/if}
  </div>
{/if}
