<script lang="ts">
  import { tooltipVariants } from './tooltip.variants';
  import type { VariantProps } from '$lib/utils/variants';
  import type { TooltipProps } from './index';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset,
    arrow as floatingArrow
  } from '$lib/utils/floating';
  import { isAnchoredInModalDialog } from '$lib/utils/overlay';
  import { resolveClassChain } from '$lib/utils/variants';

  let {
    children,
    label,
    intent = 'neutral',
    size = 'md',
    placement = 'top',
    showDelay = 200,
    hideDelay = 100,
    transitionDuration,
    transitionEasing,
    disabled = false,
    arrow = true,
    open = $bindable(false),
    onOpenChange,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: TooltipProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // ACC-3 follow-up: per-instance fade motion. Set the shared tooltip CSS
  // variables inline only when a prop is provided, so the unset default keeps
  // inheriting the reduced-motion-aware token.
  const tooltipDuration = $derived(
    transitionDuration != null ? `${transitionDuration}ms` : undefined
  );

  let triggerElement = $state<HTMLElement>();
  let tooltipElement = $state<HTMLElement>();
  let arrowElement = $state<HTMLElement>();
  let arrowStyleString = $state('');

  const propsId = $props.id();
  const tooltipId = `tooltip-${propsId}`;

  const variantProps: VariantProps<typeof tooltipVariants> = $derived({ open, intent, size });
  const styles = $derived(tooltipVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Tooltip', preset, variantProps, slotClassesProp)
  );

  // Inside an open modal <dialog>, a popover shown via showPopover() forms a
  // second top-layer element WebKit won't render above the dialog (Codeberg
  // #23). Evaluated while `open` so the check runs once the dialog is
  // already modal; the tooltip then renders in place (position:fixed + the
  // opacity `open` variant + pointer-events-none) within the dialog's own
  // top-layer subtree, no showPopover() needed.
  const topLayer = $derived(open ? !isAnchoredInModalDialog(triggerElement) : true);

  let showTimeout: number;
  let hideTimeout: number;
  let cleanup: (() => void) | undefined = undefined;

  // Clear pending show/hide timers on unmount — a hover followed by a
  // teardown within `showDelay` (route change, {#if} removal) would
  // otherwise fire setOpen after destroy: a write to the destroyed
  // $bindable plus a ghost onOpenChange(true) for a tooltip that no
  // longer exists. Dependency-free effect → runs once, teardown on destroy.
  $effect(() => {
    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  });

  // Single mutation point for interaction-driven changes, so `onOpenChange`
  // fires exactly once per transition. The no-change guard keeps a re-hover
  // during the hide delay quiet (open never flipped). Consumer writes via
  // `bind:open` bypass this on purpose — they don't re-announce themselves.
  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    onOpenChange?.(next);
  }

  function show() {
    if (disabled) return;
    clearTimeout(hideTimeout);
    showTimeout = window.setTimeout(() => {
      // Re-check `disabled` after the delay — the prop can flip during
      // the timeout (e.g. when the consumer toggles disabled while the
      // user is still hovering the trigger). Without this, a stale show
      // call would briefly flash the tooltip before the effect tears it
      // back down.
      if (disabled) return;
      setOpen(true);
    }, showDelay);
  }

  function hide() {
    clearTimeout(showTimeout);
    hideTimeout = window.setTimeout(() => {
      setOpen(false);
    }, hideDelay);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      clearTimeout(showTimeout);
      setOpen(false);
    }
  }

  function updatePosition() {
    if (!triggerElement || !tooltipElement) return;

    computePosition(triggerElement, tooltipElement, {
      placement,
      // `strategy: 'fixed'` matches the popover top-layer rendering — the
      // tooltip sits in the viewport's coordinate system, not relative to
      // any positioned ancestor. Without this, scrollable parents (e.g. a
      // Toolbar with `overflow-x: auto`, which implicitly clips on y as
      // well) would chop the tooltip.
      strategy: 'fixed',
      middleware: [
        offset(8),
        flip(),
        shift({ padding: 8 }),
        ...(arrow && arrowElement ? [floatingArrow({ element: arrowElement, padding: 4 })] : [])
      ]
    })
      .then(({ x, y, middlewareData, placement: resolvedPlacement }) => {
        if (!tooltipElement) return;
        // `autoUpdate` can call this while the trigger is detached (e.g.
        // mid-unmount), in which case Floating UI returns NaN. Writing
        // `NaNpx` into style.left would teleport the tooltip to (0,0) and
        // flash before unmount — bail out instead.
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;

        const arrowData = middlewareData.arrow as { x?: number; y?: number } | undefined;
        if (arrowData && arrowElement) {
          const { x: arrowX, y: arrowY } = arrowData;
          const staticSide =
            {
              top: 'bottom',
              right: 'left',
              bottom: 'top',
              left: 'right'
            }[resolvedPlacement.split('-')[0]] ?? 'bottom';

          arrowStyleString = `
            position: absolute;
            top: ${arrowY != null ? `${arrowY}px` : ''};
            left: ${arrowX != null ? `${arrowX}px` : ''};
            ${staticSide}: -4px;
          `;
        }
      })
      .catch((err) => {
        // Middleware can throw synchronously inside `computePosition`
        // (e.g. reading geometry on a detached node). Without this catch
        // it becomes an unhandled rejection logged with no Tooltip context.
        console.warn('[Tooltip] computePosition failed', err);
      });
  }

  // Drive native popover state from `open`. `popover="manual"` puts the
  // element in the browser top layer when shown, so the tooltip is never
  // clipped by ancestor `overflow` (e.g. Toolbar). We deliberately avoid
  // `popover="auto"` here — auto would dismiss the tooltip on any outside
  // click, which is the wrong UX for a hover/focus-driven tooltip.
  //
  // Single exit point: compute `shouldShow` once, then either show-and-
  // attach-autoUpdate or hide-and-tear-down. The previous variant split
  // disabled into its own early-return and missed the hidePopover() call,
  // leaving a tooltip stuck in the top layer when consumers toggled
  // `disabled` mid-hover.
  $effect(() => {
    if (!triggerElement || !tooltipElement) return;

    const shouldShow = !disabled && open && !!label;

    if (!shouldShow) {
      // Force-clear `open` so a stale show timeout that fired right
      // before `disabled` flipped doesn't immediately re-trigger this
      // effect into the show branch on the next mouse event.
      if (disabled && open) setOpen(false);
      cleanup?.();
      cleanup = undefined;
      if (tooltipElement.matches(':popover-open')) {
        try {
          tooltipElement.hidePopover();
        } catch (err) {
          // Pre-check eliminated "already hidden"; real failures here are
          // detached elements or popover API absence. Surface so they reach
          // error telemetry instead of vanishing.
          console.warn('[Tooltip] hidePopover failed', err);
        }
      }
      return;
    }

    // Skip top-layer promotion inside a modal dialog (see `topLayer`): the
    // tooltip stays a dialog descendant and shows via the opacity variant.
    if (topLayer && !tooltipElement.matches(':popover-open')) {
      try {
        tooltipElement.showPopover();
      } catch (err) {
        // Real causes: legacy browser without Popover API (Safari < 17,
        // Chrome < 114, Firefox < 125), element detached, or `popover`
        // attribute overridden by a consumer via restProps. Logging gives
        // production telemetry a hook to find these.
        console.warn('[Tooltip] showPopover failed', err);
      }
    }
    // Dispose any prior autoUpdate before reattaching (defensive — Svelte's
    // effect destructor normally handles this, but the field is reachable
    // from updatePosition closures so we keep ownership explicit).
    cleanup?.();
    cleanup = autoUpdate(triggerElement, tooltipElement, updatePosition);

    return () => {
      cleanup?.();
      cleanup = undefined;
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!--
  focusin/focusout (not focus/blur): the wrapper span is never focusable
  itself — the actual trigger is the consumer's child element. focus/blur
  don't bubble, so a keyboard focus on the child never reached the wrapper
  and the tooltip silently skipped its WCAG 1.4.13 focus-open path;
  focusin/focusout bubble and cover any focusable descendant.
-->
<span
  class="inline-flex"
  bind:this={triggerElement}
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  onkeydown={handleKeydown}
  aria-describedby={!disabled && label && open ? tooltipId : undefined}
>
  {@render children()}
</span>

<!--
  Tooltip element stays mounted so `bind:this={tooltipElement}` is stable
  across hover cycles and Floating UI's `arrow` middleware always has a
  target (otherwise the first showPopover would compute positions before
  the arrow node existed). In top-layer mode the `popover="manual"` attribute
  hides it via the UA stylesheet until `showPopover()` is called; inside a
  modal dialog (`topLayer === false`) the attribute is dropped and the
  `open` opacity variant drives visibility instead (Codeberg #23).

  `<span>`, not `<div>` — for the panel and for the arrow. A `<div>` start tag
  closes an open `<p>` while the parser repairs the document, and Tooltip is
  the component the library documents for inline targets, i.e. inside a
  sentence. (Valid there, not flowing with it: the trigger wrapper is
  `inline-flex` and therefore atomic, so a multi-word trigger is one
  unbreakable box. Measured 2026-08-02.)

  Popover solved the same problem by withholding its panel from the server
  render: its content is the consumer's and can be any element, so no wrapper
  can make it phrasing-safe. `label` is typed `string`, so a tooltip's panel
  content is phrasing by construction and a `<span>` holds it legally.

  Popover's gate would have worked here too — it withholds only from the
  SERVER render, and from `onMount` the panel is mounted permanently, so
  `bind:this` and the arrow target are as stable as they are now. It is simply
  the worse trade when a `<span>` is available: withholding costs the panel's
  absence from the prerendered HTML (the cost Popover's own `inline` JSDoc
  states) and buys nothing a legal element does not already give.

  Nothing gives these spans a `display`: the inline `position: fixed` below
  (and `absolute` on the arrow) blockifies them per CSS. Load-bearing, and the
  reason `display` must not be added to the base slot either: an author-level
  `display` beats the UA rule `[popover]:not(:popover-open) { display: none }`,
  and a closed tooltip then keeps a laid-out fixed box — invisible (the closed
  variant is `opacity-0`) but present in the a11y tree and to find-in-page.
  Measured in Chromium and WebKit, 2026-08-02. A test guards this slot; the
  consumer-side routes to the same class list (`class`, `slotClasses.base`,
  a `preset`, provider overrides) cannot be guarded, so the `class` prop's
  JSDoc says so.

  Load-bearing attributes (`popover`, `style`, `role`, `id`) intentionally
  follow `{...restProps}` so a consumer-supplied `popover="auto"`, custom
  `style`, or override of `id`/`role` cannot silently break the show/hide
  flow or aria-describedby pairing.
-->
<span
  bind:this={tooltipElement}
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  {...restProps}
  popover={topLayer ? 'manual' : null}
  style="position: fixed; margin: 0; inset: auto; overflow: visible;"
  style:--blocks-tooltip-duration={tooltipDuration}
  style:--blocks-tooltip-easing={transitionEasing}
  role="tooltip"
  id={tooltipId}
>
  {#if !disabled && label}
    {label}
    {#if arrow}
      <span
        class={unstyled ? (slotClasses?.arrow ?? '') : styles.arrow({ class: slotClasses?.arrow })}
        bind:this={arrowElement}
        style={arrowStyleString}
      ></span>
    {/if}
  {/if}
</span>
