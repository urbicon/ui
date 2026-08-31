<script lang="ts">
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { useBlocksI18n } from '$lib/i18n';
  import { Button } from '$lib/primitives/Button';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset,
    arrow as floatingArrow
  } from '$lib/utils/floating';
  import { observeTargetResolution } from '$lib/utils/observe-target';
  import { getGuideContext } from './guide.context';
  import { guideTourVariants, type GuideTourVariants } from './guide.variants';
  import type { GuideProps } from './index';

  const bt = useBlocksI18n();

  let {
    padding = 8,
    radius: radiusProp,
    arrow = true,
    placement = 'bottom',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset
  }: GuideProps = $props();

  const guide = getGuideContext();

  if (import.meta.env?.DEV && !guide) {
    console.warn(
      '[Guide] <Guide> is used without a <GuideProvider> ancestor — the tour will not render.'
    );
  }

  // Stable id for the action-gated step's screen-reader hint (aria-describedby target).
  const uid = $props.id();
  const actionHintId = `guide-action-hint-${uid}`;

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuideTourVariants = $derived({});
  const styles = $derived(guideTourVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Guide', preset, variantProps, slotClassesProp)
  );

  // ── Controller-driven tour state ───────────────────────────────────────────
  const isTourActive = $derived(guide?.isTourActive ?? false);
  // `paused` hides the surface while a foreign modal stacks above the tour (§3.4),
  // without ending it — so visibility ≠ active.
  const visible = $derived(isTourActive && !(guide?.paused ?? false));
  const step = $derived(guide?.currentStep ?? null);
  const stepIndex = $derived(guide?.stepIndex ?? 0);
  const stepCount = $derived(guide?.stepCount ?? 0);
  const isFirstStep = $derived(guide?.isFirstStep ?? true);
  const isLastStep = $derived(guide?.isLastStep ?? false);
  // Bumped by the MutationObserver below when a step's `data-guide` target appears (lazy
  // render) or vanishes (removed / route swap) — the DOM fallback's `querySelector` is not
  // otherwise reactive. Reads of `target` then re-resolve.
  let targetRevision = $state(0);
  // Reactive to the registry (SvelteMap) *and* to `targetRevision` for the DOM fallback.
  // `null` → centered, full-scrim step (also the graceful fallback for a vanished target).
  const target = $derived.by(() => {
    void targetRevision;
    return step?.target ? (guide?.resolveTarget(step.target) ?? null) : null;
  });

  // ── Geometry ────────────────────────────────────────────────────────────────
  let containerEl = $state<HTMLElement>();
  let bubbleEl = $state<HTMLElement>();
  let arrowEl = $state<HTMLElement>();
  // A target-less step centers the bubble in the viewport over a full scrim. `pointer-events:auto`
  // is essential: the popover container is `pointer-events:none` (so the scrim hole stays
  // click-through) and that inherits, so the bubble must re-enable events or its buttons are dead.
  // No `inset:auto` here (unlike GuideHint): the bubble is a child div, not the popover, so the UA
  // `[popover]` inset never applies — and `inset:auto` would override the `left`/`top` set above.
  const CENTERED_STYLE =
    'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;pointer-events:auto;';

  let scrimPath = $state('');
  let holeRect = $state<{ x: number; y: number; w: number; h: number; r: number } | null>(null);
  let bubbleStyle = $state(CENTERED_STYLE);
  let arrowStyle = $state('');

  /** Clockwise rounded-rect subpath — combined with the outer rect under
   *  `fill-rule="evenodd"` to punch the spotlight hole. */
  function roundedRectSubpath(x: number, y: number, w: number, h: number, r: number): string {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    return (
      `M${x + rr},${y}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}` +
      `v${h - 2 * rr}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-(w - 2 * rr)}` +
      `a${rr},${rr} 0 0 1 ${-rr},${-rr}v${-(h - 2 * rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}z`
    );
  }

  /** Recompute the scrim cut-out for the current target (or a full scrim when centered). */
  function computeScrim() {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const outer = `M0,0H${vw}V${vh}H0Z`;
    if (!target) {
      scrimPath = outer; // no hole → solid dim behind a centered step
      holeRect = null;
      return;
    }
    const rect = target.getBoundingClientRect();
    const x = rect.left - padding;
    const y = rect.top - padding;
    const w = rect.width + padding * 2;
    const h = rect.height + padding * 2;
    let r = radiusProp;
    if (r == null) {
      const own = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      r = own + padding; // follow the target's own corner, expanded by the padding
    }
    const clamped = Math.max(0, Math.min(r, w / 2, h / 2));
    holeRect = { x, y, w, h, r: clamped };
    scrimPath = outer + roundedRectSubpath(x, y, w, h, clamped);
  }

  /** Reposition the bubble (and arrow), then refresh the scrim — anchored or centered. */
  function update() {
    computeScrim();
    if (!bubbleEl) return;
    if (!target) {
      bubbleStyle = CENTERED_STYLE;
      arrowStyle = '';
      return;
    }
    computePosition(target, bubbleEl, {
      placement: step?.placement ?? placement,
      strategy: 'fixed',
      middleware: [
        offset(12),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        ...(arrow && arrowEl ? [floatingArrow({ element: arrowEl, padding: 6 })] : [])
      ]
    })
      .then(({ x, y, middlewareData, placement: resolved }) => {
        if (!bubbleEl || !Number.isFinite(x) || !Number.isFinite(y)) return;
        // pointer-events:auto — see CENTERED_STYLE; the bubble must re-enable events. No
        // `inset:auto` — it would clobber the `left`/`top` set here (the bubble isn't the popover).
        bubbleStyle = `position:fixed;left:${x}px;top:${y}px;margin:0;pointer-events:auto;`;

        const arrowData = middlewareData.arrow as { x?: number; y?: number } | undefined;
        if (arrowData && arrowEl) {
          const staticSide =
            { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[
              resolved.split('-')[0]
            ] ?? 'bottom';
          arrowStyle = `position:absolute;${arrowData.x != null ? `left:${arrowData.x}px;` : ''}${
            arrowData.y != null ? `top:${arrowData.y}px;` : ''
          }${staticSide}:-5px;`;
        } else {
          arrowStyle = '';
        }
      })
      .catch((err) => console.warn('[Guide] computePosition failed', err));
  }

  function showPopoverSafe() {
    if (containerEl && !containerEl.matches(':popover-open')) {
      try {
        containerEl.showPopover();
      } catch (err) {
        console.warn('[Guide] showPopover failed', err);
      }
    }
  }

  function hidePopoverSafe() {
    if (containerEl && containerEl.matches(':popover-open')) {
      try {
        containerEl.hidePopover();
      } catch (err) {
        console.warn('[Guide] hidePopover failed', err);
      }
    }
  }

  // Show/position while visible; tear down autoUpdate + hide otherwise. Re-runs on
  // step/target change so each step re-anchors. Mirrors GuideHint's single exit point.
  $effect(() => {
    if (!containerEl) return;
    if (!visible || !bubbleEl) {
      hidePopoverSafe();
      return;
    }
    // Track the deps that should re-anchor the surface.
    void stepIndex;
    const anchor = target;
    showPopoverSafe();
    update();

    if (anchor) {
      return autoUpdate(anchor, bubbleEl, update);
    }
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  });

  // DEV guard: an action-gated step that is not interactive keeps the blocker rect over the
  // spotlight hole (or, target-less, the full scrim) — the action being taught is then not
  // clickable, and only an app-side controller.next() from outside the spotlight can advance.
  // Usually a step-definition mistake; mirrors the unresolved-target warning.
  $effect(() => {
    if (!import.meta.env?.DEV || !guide) return;
    if (step?.advance === 'action' && !step.interactive) {
      console.warn(
        `[Guide] tour "${guide.activeTour?.id}" step ${stepIndex}: advance:'action' without ` +
          `interactive:true — the spotlit target is not clickable, so the step can only ` +
          `advance via controller.next() from outside the spotlight.`
      );
    }
  });

  // Lazy / vanishing targets: while a step declares a target, watch the DOM so a target
  // that renders *after* this step began gets anchored + spotlit, and one that is removed
  // (or swapped by a route change) falls back to the centered scrim. `autoUpdate` only
  // tracks an element that already exists, so the existence change needs its own observer.
  $effect(() => {
    if (!visible || !step?.target || !guide) return;
    const controller = guide;
    const id = step.target;
    return observeTargetResolution(
      () => controller.resolveTarget(id),
      () => {
        targetRevision++; // re-resolve `target` → the positioning effect re-anchors
        controller.reapplyStepHighlight(); // land (or clear) the engine's ring + scroll
      }
    );
  });

  // Return focus to whatever was focused when the tour started — restored only when the
  // tour fully ends (not on a mere pause), so a foreign modal that pauses us keeps focus.
  $effect(() => {
    if (!isTourActive) return;
    const previouslyFocused = (
      typeof document !== 'undefined' ? document.activeElement : null
    ) as HTMLElement | null;
    return () => previouslyFocused?.focus?.();
  });

  // Move focus into the bubble when the tour opens (or resumes after a pause) so keyboard
  // users land in the dialog and Arrow/Tab/Escape work. Per-step announcement is handled by
  // the polite live region in the template — NOT this focus move, which is a no-op on the
  // arrow-key path (focus is already in the bubble). Deferred past render so the bubble exists.
  $effect(() => {
    if (!visible) return;
    tick().then(() => {
      if (visible) bubbleEl?.focus();
    });
  });

  // If the renderer unmounts mid-tour (conditional render / route change), abandon the tour so
  // the overlay-stack entry and highlight ring don't leak. `stopTour` tears down WITHOUT marking
  // the tour seen (it wasn't user-dismissed), so it can surface again. Runs once: no reactive
  // reads in the body, so the returned cleanup fires only on destroy.
  $effect(() => {
    return () => {
      if (guide?.isTourActive) guide.stopTour();
    };
  });

  // Focus containment: keep focus in the bubble (plus the target on interactive steps),
  // so Tab can't wander into the dimmed app behind the scrim.
  $effect(() => {
    if (!visible || typeof document === 'undefined') return;
    function onFocusIn(e: FocusEvent) {
      const node = e.target as Node | null;
      if (!node || !bubbleEl) return;
      if (bubbleEl.contains(node)) return;
      if (step?.interactive && target?.contains(node)) return;
      bubbleEl.focus();
    }
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  });

  const FOCUSABLE_SELECTOR =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /** Visible, tabbable descendants of `root` (the bubble's tabindex=-1 container is excluded). */
  function focusables(root: HTMLElement | null | undefined): HTMLElement[] {
    if (!root) return [];
    return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (el) => el.getClientRects().length > 0
    );
  }

  /**
   * Tab boundary between two focus zones. When Tab leaves the trailing edge of `from` (or
   * Shift+Tab the leading edge), move focus into `to` and report handled. Lets the interactive
   * step target join the bubble in one keyboard cycle — otherwise focus containment yanks focus
   * back before it can land on the target.
   */
  function edgeTab(
    e: KeyboardEvent,
    from: HTMLElement | null | undefined,
    to: HTMLElement | null
  ): boolean {
    if (typeof document === 'undefined') return false;
    let here = focusables(from);
    if (here.length === 0) {
      // A focusable `from` with no focusable descendants (e.g. a plain `<button data-guide>`)
      // is its own single-element zone, so its Tab edges still hand off cleanly.
      if (from?.matches(FOCUSABLE_SELECTOR)) here = [from];
      else return false;
    }
    const there = focusables(to);
    const active = document.activeElement;
    if (!e.shiftKey && active === here[here.length - 1]) {
      (there[0] ?? to)?.focus();
      return true;
    }
    if (e.shiftKey && active === here[0]) {
      (there[there.length - 1] ?? to)?.focus();
      return true;
    }
    return false;
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (!visible || e.defaultPrevented) return;
    // The tour is top-of-stack while visible, so it owns Escape (manual popovers don't
    // self-close). Arrow keys advance only when focus is in the bubble (see onBubbleKeydown),
    // never stealing them from an interactive step target.
    if (e.key === 'Escape') {
      e.preventDefault();
      guide?.skip();
    }
  }

  function onBubbleKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      // An advance:'action' step only moves via controller.next() — the user performs
      // the real action and the app advances imperatively (mirrors the gated footer).
      if (step?.advance !== 'action') guide?.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      guide?.prev();
    } else if (e.key === 'Tab' && step?.interactive && target) {
      // Forward off the last control → into the target; Shift+Tab off the first → target's end.
      if (edgeTab(e, bubbleEl, target)) e.preventDefault();
    }
  }

  // Reverse leg of the interactive-step cycle: Tab off the target's edges returns to the bubble.
  $effect(() => {
    if (!visible || !step?.interactive || !target || typeof document === 'undefined') return;
    const el = target;
    function onTargetKeydown(e: KeyboardEvent) {
      if (e.key === 'Tab' && edgeTab(e, el, bubbleEl ?? null)) e.preventDefault();
    }
    el.addEventListener('keydown', onTargetKeydown);
    return () => el.removeEventListener('keydown', onTargetKeydown);
  });

  const stepText = $derived(
    stepCount > 0 ? bt('guide.step', { current: stepIndex + 1, total: stepCount }) : ''
  );
  // The polite live region's text — announces each step (title + body + counter) regardless of
  // whether focus moved, so the arrow-key path is not silent for screen readers. Action-gated
  // steps append the "complete the action" hint so the disabled Next is never a dead end.
  const announcement = $derived(
    step
      ? [
          step.title,
          step.body,
          stepText,
          step.advance === 'action' ? bt('guide.actionRequired', {}) : ''
        ]
          .filter(Boolean)
          .join('. ')
      : ''
  );

  // ── Exit fade (rendered snapshot) ────────────────────────────────────────────
  // The controller clears `currentStep` synchronously on tour end, so the bubble/scrim
  // would otherwise unmount instantly and only an empty container would fade. `view` keeps
  // the last step's *content* mounted through the popover's exit transition; the geometry
  // (`scrimPath` / `holeRect` / `bubbleStyle`) freezes on its own because `update()` stops
  // running once `visible` is false. The engine-facing logic above still reads the live
  // `step`/`target` — only the rendered markup reads `view`.
  const liveView = $derived(
    step
      ? {
          interactive: step.interactive ?? false,
          actionGated: step.advance === 'action',
          title: step.title,
          body: step.body,
          index: stepIndex,
          count: stepCount,
          text: stepText,
          first: isFirstStep,
          last: isLastStep
        }
      : null
  );
  let heldView = $state<typeof liveView>(null);
  $effect(() => {
    if (liveView) heldView = liveView;
  });
  // Live while a step is active; the held snapshot during the fade-out; null once gone.
  const view = $derived(liveView ?? heldView);

  const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
  // Drop the held snapshot once the exit completes: on the container's opacity transitionend
  // when motion is on, or at once under reduced motion (where no transition — and thus no
  // transitionend — fires, and the popover is hidden instantly anyway).
  $effect(() => {
    if (!visible && reducedMotion.current) heldView = null;
  });
  function onContainerTransitionEnd(e: TransitionEvent) {
    if (e.target === containerEl && e.propertyName === 'opacity' && !visible) heldView = null;
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if guide}
  <!-- Always-present polite live region (a sibling of the popover, so never display:none-gated):
       announces each step's content on change — including the first step on open, which is a real
       mutation from empty. This, not the focus move, is the screen-reader step announcement, so the
       silent arrow-key path is covered too. -->
  <span class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
  <div
    bind:this={containerEl}
    popover="manual"
    class={[
      'guide-tour',
      unstyled
        ? (slotClasses?.container ?? '')
        : styles.container({ class: slotClasses?.container })
    ]}
    style="position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:visible;pointer-events:none;"
    ontransitionend={onContainerTransitionEnd}
  >
    {#if view}
      <!-- Spotlight scrim: even-odd cut-out so the hole stays click-through (the painted
           surround captures clicks); a non-interactive step adds a transparent blocker rect
           over the hole so the target can't be used. The svg root passes pointer events. -->
      <svg
        class={unstyled ? (slotClasses?.scrim ?? '') : styles.scrim({ class: slotClasses?.scrim })}
        style="pointer-events:none;"
        aria-hidden="true"
      >
        <path
          d={scrimPath}
          fill-rule="evenodd"
          style="fill:var(--blocks-guide-scrim);pointer-events:auto;"
        />
        {#if holeRect && !view.interactive}
          <rect
            x={holeRect.x}
            y={holeRect.y}
            width={holeRect.w}
            height={holeRect.h}
            rx={holeRect.r}
            style="fill:transparent;pointer-events:all;"
          />
        {/if}
      </svg>

      <div
        bind:this={bubbleEl}
        class={[
          'guide-tour-bubble',
          unstyled
            ? resolveClassChain(slotClasses?.bubble, className)
            : styles.bubble({ class: [slotClasses?.bubble, className] })
        ]}
        role="dialog"
        aria-label={bt('guide.tour', {})}
        aria-modal={view.interactive ? undefined : 'true'}
        tabindex="-1"
        style={bubbleStyle}
        onkeydown={onBubbleKeydown}
      >
        <!-- Stable dialog name via `aria-label`; the changing step content is announced by the
             always-present live region (a sibling of this popover, so it isn't display:none-gated
             and the first step on open is a real mutation). `aria-modal` is dropped on interactive
             steps, where the spotlight target lives outside the dialog and must stay reachable. -->
        {#if view.title}
          <p
            class={unstyled
              ? (slotClasses?.title ?? '')
              : styles.title({ class: slotClasses?.title })}
          >
            {view.title}
          </p>
        {/if}
        {#if view.body}
          <div
            class={unstyled ? (slotClasses?.body ?? '') : styles.body({ class: slotClasses?.body })}
          >
            {view.body}
          </div>
        {/if}

        <div
          class={unstyled
            ? (slotClasses?.progress ?? '')
            : styles.progress({ class: slotClasses?.progress })}
        >
          {#if view.count > 1}
            <div
              class={unstyled
                ? (slotClasses?.dots ?? '')
                : styles.dots({ class: slotClasses?.dots })}
              aria-hidden="true"
            >
              <!-- Positional, stateless markers — never reordered, so the index is a stable key. -->
              {#each Array.from({ length: view.count }) as _, i (i)}
                {@const active = i === view.index}
                <span
                  class={resolveClassChain(
                    unstyled ? '' : styles.dot(),
                    active && !unstyled ? styles.dotActive() : '',
                    slotClasses?.dot,
                    active ? slotClasses?.dotActive : undefined
                  )}
                ></span>
              {/each}
            </div>
          {/if}
          <span
            class={unstyled
              ? (slotClasses?.stepText ?? '')
              : styles.stepText({ class: slotClasses?.stepText })}
          >
            {view.text}
          </span>
        </div>

        <div
          class={unstyled
            ? (slotClasses?.footer ?? '')
            : styles.footer({ class: slotClasses?.footer })}
        >
          <Button
            {unstyled}
            variant="ghost"
            intent="neutral"
            size="sm"
            class={slotClasses?.skip}
            onclick={() => guide.skip()}
          >
            {bt('guide.skip', {})}
          </Button>
          <span
            class={unstyled
              ? (slotClasses?.spacer ?? '')
              : styles.spacer({ class: slotClasses?.spacer })}
          ></span>
          {#if !view.first}
            <Button
              {unstyled}
              variant="outlined"
              intent="neutral"
              size="sm"
              class={slotClasses?.prev}
              onclick={() => guide.prev()}
            >
              {bt('guide.previous', {})}
            </Button>
          {/if}
          <!-- An advance:'action' step gates Next: aria-disabled (still focusable, so the
               described-by hint is discoverable) and a no-op click — only controller.next()
               advances, after the user performed the real action. -->
          {#if view.actionGated}
            <span class="sr-only" id={actionHintId}>{bt('guide.actionRequired', {})}</span>
          {/if}
          <Button
            {unstyled}
            intent="primary"
            size="sm"
            class={resolveClassChain(
              !unstyled && 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
              slotClasses?.next
            )}
            aria-disabled={view.actionGated || undefined}
            aria-describedby={view.actionGated ? actionHintId : undefined}
            onclick={() => {
              if (!view.actionGated) guide.next();
            }}
          >
            {view.last ? bt('guide.done', {}) : bt('guide.next', {})}
          </Button>
        </div>

        <!-- Gated on the live, *resolved* target (not `view.hasTarget`): a declared-but-
             unresolved target renders centered with no arrow, and the arrow simply drops at
             the start of the exit fade rather than risk a stray arrow on a centered bubble. -->
        {#if arrow && target}
          <div
            bind:this={arrowEl}
            class={unstyled
              ? (slotClasses?.arrow ?? '')
              : styles.arrow({ class: slotClasses?.arrow })}
            style={arrowStyle}
          ></div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Enter / exit / pause-resume motion: the whole tour (scrim + bubble) fades together via the
     native popover; `allow-discrete` keeps the container in the top layer through both fades.
     The exit fade works because the rendered block reads the `view` snapshot, which holds the
     last step's content (and the geometry $state freezes) through the transition — without it
     the controller's synchronous `currentStep` clear would empty the container before it fades.
     The bubble position follows the target instantly (no transition) to avoid scroll lag,
     mirroring GuideHint. Reduced-motion opts out. */
  .guide-tour {
    opacity: 0;
    transition:
      opacity var(--blocks-duration-normal, 200ms) var(--blocks-ease-confident, ease),
      overlay var(--blocks-duration-normal, 200ms) allow-discrete,
      display var(--blocks-duration-normal, 200ms) allow-discrete;
  }

  .guide-tour:popover-open {
    opacity: 1;
  }

  @starting-style {
    .guide-tour:popover-open {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-tour {
      transition: none;
    }
  }
</style>
