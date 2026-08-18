<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { edgeEnabledIndex, getTierContext, nextEnabledIndex } from '$lib/utils';
  import { type CollapseMark, hostHasRoomAgain } from './overflow';
  import { segmentGroupVariants, type SegmentGroupVariants } from './segmentgroup.variants';
  import { setSegmentGroupContext } from './segmentGroup.context';
  import type { RegisteredSegment, SegmentGroupContext, SegmentGroupProps } from './index';

  let {
    children,
    value = $bindable(),
    onValueChange,
    size = 'md',
    variant = 'default',
    tier,
    fullWidth = false,
    disabled = false,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ariaLabel,
    collapseOnOverflow = true,
    ...restProps
  }: SegmentGroupProps = $props();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'commit' default. Propagated through SegmentGroupContext
  // so the indicator + every item shares the same radius family.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let containerElement = $state<HTMLDivElement>();
  let indicatorStyle = $state('opacity: 0;');
  // Content-aware overflow degradation: when the horizontal track can't fit its
  // available width, collapse to a vertical radio-style stack. `collapsed`
  // drives the `data-collapsed` attribute (CSS does the layout switch).
  let collapsed = $state(false);
  // What the horizontal track measured at the moment we collapsed — the
  // hysteresis that lets us expand back without oscillating. See overflow.ts
  // for why the group's own width is unusable as the reference.
  let collapseMark: CollapseMark | null = null;
  // SvelteMap instead of `$state(new Map())` — `.set()`/`.delete()` must be
  // reactive so the indicator updates when new items register.
  //
  // The entry carries a `isDisabled` GETTER, not a boolean: a segment's
  // disabled state is derived in the item (its own prop OR the group's), and
  // reading it through the getter makes it a dependency of whoever reads it —
  // so `isTabStop` re-runs when a segment is disabled at runtime. A snapshot
  // boolean would need a second write path to stay true, and reading
  // `element.disabled` off the DOM (what this did until 2026-08-18) is not
  // tracked at all: disabling the segment that held the tab stop left it there,
  // unfocusable, and the group fell out of the tab order — the very #205 state.
  const registeredItems = new SvelteMap<string, RegisteredSegment>();

  const variantProps: SegmentGroupVariants = $derived({
    size,
    variant,
    tier: effectiveTier,
    fullWidth,
    disabled
  });

  const styles = $derived(segmentGroupVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'SegmentGroup', preset, variantProps, slotClassesProp)
  );

  function updateIndicator() {
    if (!containerElement || !value) {
      indicatorStyle = 'opacity: 0;';
      return;
    }

    const activeItem = registeredItems.get(value)?.element;
    if (!activeItem) {
      indicatorStyle = 'opacity: 0;';
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    const left = itemRect.left - containerRect.left;
    const top = itemRect.top - containerRect.top;
    const width = itemRect.width;
    const height = itemRect.height;

    indicatorStyle = `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; opacity: 1;`;
  }

  const segmentContext: SegmentGroupContext = {
    registerItem(itemValue: string, element: HTMLElement, isDisabled: () => boolean) {
      registeredItems.set(itemValue, { element, isDisabled });
      requestAnimationFrame(updateIndicator);

      return () => {
        registeredItems.delete(itemValue);
      };
    },

    selectItem(itemValue: string) {
      if (disabled) return;
      value = itemValue;
      onValueChange?.(itemValue);
      requestAnimationFrame(updateIndicator);
    },

    isActive(itemValue: string) {
      return value === itemValue;
    },

    // Which segment holds the roving tab stop. Normally the selected one — but
    // only a segment that can actually take focus may hold it, so the group
    // stays reachable with Tab (standard radiogroup entry behaviour; same
    // fallback as ButtonGroup). Three states hand the stop to the first enabled
    // segment instead, and every one of them is the keyboard-dead group of
    // #205: no `value` at all, a `value` naming no registered segment, and a
    // `value` naming a DISABLED one — in the last case the selected segment
    // keeps `aria-checked` (the selection is real) but a disabled button cannot
    // hold focus, so the stop moves rather than stranding there.
    isTabStop(itemValue: string) {
      const selected = value !== undefined ? registeredItems.get(value) : undefined;
      if (selected && !selected.isDisabled()) return value === itemValue;

      const itemValues = Array.from(registeredItems.keys());
      const firstEnabled = edgeEnabledIndex(itemValues.length, 1, (i) => {
        const entry = registeredItems.get(itemValues[i]);
        return !entry || entry.isDisabled();
      });
      return firstEnabled >= 0 && itemValues[firstEnabled] === itemValue;
    },

    get size() {
      return size;
    },
    get variant() {
      return variant;
    },
    get tier() {
      return effectiveTier;
    },
    get disabled() {
      return disabled;
    },
    get unstyled() {
      return unstyled;
    },
    get mint() {
      return mint;
    }
  };

  setSegmentGroupContext(segmentContext);

  $effect(() => {
    void value;
    // Reposition the indicator when the layout flips orientation — the active
    // item's box moves from a horizontal slot to a full-width row.
    void collapsed;
    requestAnimationFrame(updateIndicator);
  });

  // Everything else that moves the indicator moves an item's BOX, not `value`:
  // `size`/`variant`/`tier`/`fullWidth` resize the items, and a font load or a
  // container resize does it without touching any prop at all. Listing the
  // axes in the effect above would cover today's four and silently miss the
  // fifth; observing the boxes themselves covers all of them at once. The
  // collapse check rides along because it needs the same post-layout moment.
  $effect(() => {
    const el = containerElement;
    if (!el) return;
    // Read the map so the observer re-subscribes when the item set changes —
    // a newly registered segment brings a box of its own.
    const items = Array.from(registeredItems.values(), (entry) => entry.element);

    const remeasure = () => {
      if (collapseOnOverflow) measureOverflow();
      updateIndicator();
    };

    const ro = new ResizeObserver(remeasure);
    ro.observe(el);
    for (const item of items) ro.observe(item);
    // `untrack` so the synchronous first measure doesn't make `collapsed` or
    // `value` dependencies of this effect — they would tear down and rebuild
    // the observer on every collapse toggle and every selection.
    untrack(remeasure);

    return () => ro.disconnect();
  });

  // Detects whether the horizontal track fits its available width. Reads
  // layout, so it runs from the ResizeObserver callback rather than a reactive
  // effect. The +1 tolerance and the recorded `collapseMark` give it hysteresis
  // so it settles instead of flip-flopping at the boundary.
  //
  // We measure the items' own geometry rather than `el.scrollWidth`: the track
  // is `overflow-x-clip`, which is NOT a scroll container, and Chromium/WebKit
  // clamp `scrollWidth` to `clientWidth` for clip boxes (so the old scrollWidth
  // check silently never fired off Firefox). `getBoundingClientRect()` reports
  // true layout positions regardless of clipping.
  function measureOverflow() {
    const el = containerElement;
    if (!el || el.clientWidth === 0 || registeredItems.size === 0) return;
    if (!collapsed) {
      let minLeft = Infinity;
      let maxRight = -Infinity;
      for (const { element: item } of registeredItems.values()) {
        const r = item.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue; // not laid out yet
        minLeft = Math.min(minLeft, r.left);
        maxRight = Math.max(maxRight, r.right);
      }
      if (maxRight === -Infinity) return;
      const cs = getComputedStyle(el);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const contentWidth = maxRight - minLeft;
      // Overflow when the items can't fit the content box (clientWidth − padding).
      if (contentWidth > el.clientWidth - padX + 1) {
        collapseMark = {
          naturalWidth: contentWidth + padX,
          availWidth: el.clientWidth,
          hostWidth: hostWidth(el)
        };
        collapsed = true;
      }
    } else if (collapseMark && hostHasRoomAgain(collapseMark, hostWidth(el))) {
      collapsed = false;
      collapseMark = null;
    }
  }

  /** The one box the collapse cannot move — see overflow.ts. */
  function hostWidth(el: HTMLElement): number {
    return el.parentElement?.clientWidth ?? el.clientWidth;
  }

  // A disabled SegmentItem renders a `<button disabled>`, which can't hold focus,
  // so roving navigation must skip it — otherwise selection strands on an
  // unfocusable segment (aria-checked set, focus stuck on the previous one). The
  // index math lives in the shared roving helpers (utils/roving).
  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;

    const itemValues = Array.from(registeredItems.keys());
    const currentIndex = value ? itemValues.indexOf(value) : -1;
    // Same source as `isTabStop`, not the DOM: one answer to "can this segment
    // take focus" keeps navigation and the tab stop from disagreeing.
    const isDisabled = (i: number) => {
      const entry = registeredItems.get(itemValues[i]);
      return !entry || entry.isDisabled();
    };
    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = nextEnabledIndex(itemValues.length, currentIndex, 1, isDisabled);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = nextEnabledIndex(itemValues.length, currentIndex, -1, isDisabled);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = edgeEnabledIndex(itemValues.length, 1, isDisabled);
        break;
      case 'End':
        event.preventDefault();
        newIndex = edgeEnabledIndex(itemValues.length, -1, isDisabled);
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex && newIndex >= 0 && itemValues[newIndex]) {
      segmentContext.selectItem(itemValues[newIndex]);
      const newItem = registeredItems.get(itemValues[newIndex])?.element;
      newItem?.focus();
    }
  }
</script>

<div
  bind:this={containerElement}
  role="radiogroup"
  data-collapsed={collapsed || undefined}
  aria-orientation={collapsed ? 'vertical' : 'horizontal'}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={ariaLabel}
  aria-disabled={disabled || undefined}
  onkeydown={handleKeyDown}
  {...restProps}
>
  <div
    class={unstyled
      ? (slotClasses?.indicator ?? '')
      : styles.indicator({ class: slotClasses?.indicator })}
    style={indicatorStyle}
    aria-hidden="true"
  ></div>

  {@render children?.()}
</div>
