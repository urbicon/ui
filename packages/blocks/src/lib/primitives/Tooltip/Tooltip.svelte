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

  let {
    children,
    label,
    intent = 'neutral',
    size = 'md',
    placement = 'top',
    showDelay = 200,
    hideDelay = 100,
    disabled = false,
    arrow = true,
    onVisibleChange,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: TooltipProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let visible = $state(false);
  let triggerElement = $state<HTMLElement>();
  let tooltipElement = $state<HTMLElement>();
  let arrowElement = $state<HTMLElement>();
  let arrowStyleString = $state('');

  const propsId = $props.id();
  const tooltipId = `tooltip-${propsId}`;

  const variantProps: VariantProps<typeof tooltipVariants> = $derived({ visible, intent, size });
  const styles = $derived(tooltipVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Tooltip', preset, variantProps, slotClassesProp)
  );

  let showTimeout: number;
  let hideTimeout: number;
  let cleanup: (() => void) | undefined = undefined;

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
      visible = true;
      onVisibleChange?.(true);
    }, showDelay);
  }

  function hide() {
    clearTimeout(showTimeout);
    hideTimeout = window.setTimeout(() => {
      visible = false;
      onVisibleChange?.(false);
    }, hideDelay);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && visible) {
      clearTimeout(showTimeout);
      visible = false;
      onVisibleChange?.(false);
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

  // Drive native popover state from `visible`. `popover="manual"` puts the
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

    const shouldShow = !disabled && visible && !!label;

    if (!shouldShow) {
      // Force-clear `visible` so a stale show timeout that fired right
      // before `disabled` flipped doesn't immediately re-trigger this
      // effect into the show branch on the next mouse event.
      if (disabled && visible) visible = false;
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

    if (!tooltipElement.matches(':popover-open')) {
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
<span
  class="inline-flex"
  bind:this={triggerElement}
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
  onkeydown={handleKeydown}
  aria-describedby={!disabled && label && visible ? tooltipId : undefined}
>
  {@render children()}
</span>

<!--
  Tooltip element stays mounted so `bind:this={tooltipElement}` is stable
  across hover cycles and Floating UI's `arrow` middleware always has a
  target (otherwise the first showPopover would compute positions before
  the arrow node existed). The `popover="manual"` attribute hides it
  via the UA stylesheet until `showPopover()` is called.

  Load-bearing attributes (`popover`, `style`, `role`, `id`) intentionally
  follow `{...restProps}` so a consumer-supplied `popover="auto"`, custom
  `style`, or override of `id`/`role` cannot silently break the show/hide
  flow or aria-describedby pairing.
-->
<div
  bind:this={tooltipElement}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  {...restProps}
  popover="manual"
  style="position: fixed; margin: 0; inset: auto; overflow: visible;"
  role="tooltip"
  id={tooltipId}
>
  {#if !disabled && label}
    {label}
    {#if arrow}
      <div
        class={unstyled ? (slotClasses?.arrow ?? '') : styles.arrow({ class: slotClasses?.arrow })}
        bind:this={arrowElement}
        style={arrowStyleString}
      ></div>
    {/if}
  {/if}
</div>
