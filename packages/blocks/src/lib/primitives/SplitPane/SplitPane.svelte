<script lang="ts">
  import { untrack } from 'svelte';
  import { mintAttachment } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { SplitPaneProps } from './index';
  import { clampRatio, parseLimit, ratioFromPointer, resolveDragRatio } from './split-pane.utils';
  import { splitPaneVariants, type SplitPaneVariants } from './split-pane.variants';

  let {
    start,
    end,
    handle,
    orientation = 'horizontal',
    defaultRatio = 0.5,
    ratio = $bindable(defaultRatio),
    min = '10%',
    max = '90%',
    collapsible = false,
    collapseThreshold = 48,
    disabled = false,
    onRatioChange,
    onCollapsedChange,
    handleLabel = 'Resize panes',
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SplitPaneProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // aria-controls needs a stable id for the first pane. `$props.id()` must be a
  // top-level initializer (compiler rule) — SplitPane has no `id` prop, so the
  // single-step form is enough.
  const propsId = $props.id();
  const startPaneId = `splitpane-${propsId}-start`;

  // Slider performs NO right-to-left inversion in its pointer/keyboard handling
  // (physical coordinates, ArrowRight = increase). SplitPane mirrors that role
  // model exactly, so `rtl` stays false here. The geometry util still accepts an
  // `rtl` flag (and is unit-tested for it) so a future house-wide RTL pass has
  // one seam to wire — see the primitive's open issues.
  const rtl = false;

  let rootRef = $state<HTMLDivElement>();
  let handleRef = $state<HTMLDivElement>();
  let dragging = $state(false);
  // Collapsed is DERIVED from the bindable ratio, never tracked separately —
  // an external `bind:ratio` write must move this flag too, or the Enter
  // toggle acts on stale state (review finding, P1 wave).
  const collapsed = $derived(collapsible && ratio <= 0);
  // Remembers the ratio to restore when re-expanding via Enter. Seeded once
  // from the initial defaultRatio — `untrack` marks the one-time snapshot so it
  // does not read as a missed reactive dependency.
  let lastExpandedRatio = $state(untrack(() => defaultRatio));

  // Keep the restore target fresh from every expanded ratio (interactive or
  // consumer-driven), and fire onCollapsedChange on actual transitions of the
  // derived flag — regardless of which side caused them.
  let lastCollapsed = untrack(() => collapsed);
  $effect(() => {
    if (ratio > 0) lastExpandedRatio = ratio;
  });
  $effect(() => {
    if (collapsed !== lastCollapsed) {
      lastCollapsed = collapsed;
      onCollapsedChange?.(collapsed);
    }
  });
  // Last measured container size on the active axis — feeds px-limit resolution
  // and the aria-value* bounds. Kept fresh via a ResizeObserver (no-op in jsdom).
  let measuredPx = $state(0);

  $effect(() => {
    const el = rootRef;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      measuredPx = orientation === 'horizontal' ? rect.width : rect.height;
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  // mint is wired on the interactive element — the divider — exactly as Slider
  // applies it to its track ref.
  function containerSize(): number {
    if (!rootRef) return measuredPx;
    const rect = rootRef.getBoundingClientRect();
    const px = orientation === 'horizontal' ? rect.width : rect.height;
    if (px > 0) measuredPx = px;
    return px > 0 ? px : measuredPx;
  }

  function emitRatio(next: number) {
    if (next !== ratio) {
      ratio = next;
      onRatioChange?.(next);
    }
  }

  // ─── Pointer drag ────────────────────────────────────────────────────────
  // setPointerCapture routes every subsequent pointer event to the divider, so
  // move/up listeners live on the divider itself — no window listeners, nothing
  // to leak. Cancel restores the resting state.
  function onHandlePointerDown(event: PointerEvent) {
    if (disabled) return;
    event.preventDefault();
    handleRef?.focus();
    handleRef?.setPointerCapture?.(event.pointerId);
    dragging = true;
  }

  function onHandlePointerMove(event: PointerEvent) {
    if (!dragging || disabled || !rootRef) return;
    const rect = rootRef.getBoundingClientRect();
    const px = orientation === 'horizontal' ? rect.width : rect.height;
    if (px > 0) measuredPx = px;
    const clientPos = orientation === 'horizontal' ? event.clientX : event.clientY;
    const raw = ratioFromPointer(clientPos, rect, orientation, rtl);
    const resolved = resolveDragRatio(
      raw,
      px,
      { min, max, collapsible, collapseThreshold },
      collapsed
    );
    emitRatio(resolved.ratio);
  }

  function endDrag(event: PointerEvent) {
    if (!dragging) return;
    handleRef?.releasePointerCapture?.(event.pointerId);
    dragging = false;
  }

  function onHandleDblClick() {
    if (disabled) return;
    emitRatio(clampRatio(defaultRatio, min, max, containerSize()));
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────
  // Arrow keys map to the layout axis (horizontal → Left/Right, vertical →
  // Up/Down): the "increase" key grows the first pane. ±2% default, ±10% with
  // Shift; Home/End jump to the min/max limits. Enter follows the APG window
  // splitter: with `collapsible` it toggles collapse, otherwise it restores
  // defaultRatio — which also gives keyboard users the reset that double-click
  // provides for pointers.
  function onHandleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    const px = containerSize();
    const stepAmount = event.shiftKey ? 0.1 : 0.02;
    const incKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const decKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    switch (event.key) {
      case incKey: {
        event.preventDefault();
        emitRatio(clampRatio(ratio + stepAmount, min, max, px));
        return;
      }
      case decKey: {
        event.preventDefault();
        emitRatio(clampRatio(ratio - stepAmount, min, max, px));
        return;
      }
      case 'Home': {
        event.preventDefault();
        emitRatio(parseLimit(min, px) ?? 0);
        return;
      }
      case 'End': {
        event.preventDefault();
        emitRatio(parseLimit(max, px) ?? 1);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        if (!collapsible) {
          emitRatio(clampRatio(defaultRatio, min, max, px));
        } else if (collapsed) {
          const restore = lastExpandedRatio > 0 ? lastExpandedRatio : defaultRatio;
          emitRatio(clampRatio(restore, min, max, px));
        } else {
          emitRatio(0);
        }
        return;
      }
      default:
        return;
    }
  }

  const separatorOrientation = $derived(orientation === 'horizontal' ? 'vertical' : 'horizontal');

  // The DISPLAYED ratio is always clamped into [min, max] (collapse being the
  // one legitimate exception), so an out-of-window initial/controlled value or
  // a container resize can never render the pane — or report aria-valuenow —
  // outside the configured bounds. The bound `ratio` itself is left untouched
  // (no write-backs from render state).
  const effectiveRatio = $derived.by(() => {
    const bounded = Math.max(0, Math.min(1, ratio));
    if (collapsed) return 0;
    return clampRatio(bounded, min, max, measuredPx);
  });
  const startBasisPct = $derived(effectiveRatio * 100);

  const valueNow = $derived(Math.round(effectiveRatio * 100));
  // With `collapsible`, 0 is a legitimate value of the separator's range —
  // otherwise a collapsed pane would report valuenow below valuemin.
  const valueMin = $derived(collapsible ? 0 : Math.round((parseLimit(min, measuredPx) ?? 0) * 100));
  const valueMax = $derived(Math.round((parseLimit(max, measuredPx) ?? 1) * 100));

  const variantProps: SplitPaneVariants = $derived({
    orientation,
    dragging: dragging || undefined,
    disabled: disabled || undefined
  });

  const styles = $derived(splitPaneVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'SplitPane', preset, variantProps, slotClassesProp)
  );
</script>

<div
  {...restProps}
  bind:this={rootRef}
  class={unstyled
    ? resolveClassChain(slotClasses?.root, className)
    : styles.root({ class: [slotClasses?.root, className] })}
  data-orientation={orientation}
  data-dragging={dragging || undefined}
  data-collapsed={collapsed || undefined}
>
  <div
    id={startPaneId}
    class={unstyled
      ? (slotClasses?.startPane ?? '')
      : styles.startPane({ class: slotClasses?.startPane })}
    style="flex: 0 0 {startBasisPct}%"
  >
    {@render start()}
  </div>

  <!-- The divider is the ARIA "window splitter": role="separator" made focusable
       (tabindex) with aria-value* + keyboard resize. Svelte's a11y rules treat
       any separator as non-interactive; this pattern is the sanctioned exception. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={handleRef}
    {@attach mintAttachment(mint, { enabled: !disabled })}
    role="separator"
    tabindex={disabled ? -1 : 0}
    aria-label={handleLabel}
    aria-controls={startPaneId}
    aria-orientation={separatorOrientation}
    aria-valuenow={valueNow}
    aria-valuemin={valueMin}
    aria-valuemax={valueMax}
    aria-disabled={disabled || undefined}
    data-dragging={dragging || undefined}
    class={unstyled ? (slotClasses?.handle ?? '') : styles.handle({ class: slotClasses?.handle })}
    onpointerdown={onHandlePointerDown}
    onpointermove={onHandlePointerMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
    ondblclick={onHandleDblClick}
    onkeydown={onHandleKeydown}
  >
    {@render handle?.()}
  </div>

  <div
    class={unstyled
      ? (slotClasses?.endPane ?? '')
      : styles.endPane({ class: slotClasses?.endPane })}
    style="flex: 1 1 0%"
  >
    {@render end()}
  </div>
</div>
