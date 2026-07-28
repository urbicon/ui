<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { resolveIcon } from '$lib/icons';
  import ChevronLeftIconDefault from '$lib/icons/ChevronLeftIcon.svelte';
  import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { ScrollerProps } from './index';
  import {
    activeItemIndex,
    type ScrollerItemMetrics,
    scrollEdges,
    scrollTargetForIndex,
    scrollTargetForStep
  } from './scroller.utils';
  import { scrollerVariants, type ScrollerVariants } from './scroller.variants';

  const bt = useBlocksI18n();

  // Statically imported defaults resolved through the icon context: an
  // IconProvider can swap the chevrons house-wide, and only these two icons
  // reach the consumer bundle (never the 315-icon registry).
  const ChevronLeftIcon = resolveIcon('chevronLeft', ChevronLeftIconDefault);
  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);

  let {
    children,
    label,
    align = 'start',
    // Undefaulted: the resting strictness depends on `align` (see `snap` below),
    // which a plain default value cannot express.
    snap: snapProp,
    gap = 'md',
    itemBasis = '16rem',
    controls = 'auto',
    indicator = 'none',
    emphasis = 'none',
    onActiveChange,
    previousLabel = bt('scroller.previous'),
    nextLabel = bt('scroller.next'),
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ScrollerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Snap strictness follows the alignment, because the two alignments mean
  // different things. A `start` row is a list you sweep across — `mandatory`
  // there can strand content between snap points (plan §3.5), and a chip bar
  // that fights every flick is worse than one that doesn't snap. A `center` row
  // is a stage: the middle IS the unit, so it has to land on one, and
  // `proximity` there reads as "snapping is broken" because it rarely engages.
  const snap = $derived(snapProp ?? (align === 'center' ? 'mandatory' : 'proximity'));

  let viewportRef = $state<HTMLDivElement>();

  // Everything below is MEASURED, never assumed: whether the row overflows, how
  // many items it holds and where they sit is a layout outcome the component
  // cannot compute from its props (the children are consumer markup, and their
  // width can be overridden by a slot class). All of it starts empty, so the
  // server render and the first client paint agree — a row is an ordinary row
  // until the browser says otherwise.
  let items = $state<ScrollerItemMetrics[]>([]);
  let overflowing = $state(false);
  let scrollStart = $state(0);
  let scrollSize = $state(0);
  let viewportSize = $state(0);

  // Horizontal scroll geometry here is PHYSICAL (left-to-right), matching
  // Slider/SplitPane: an RTL document scrolls with negative `scrollLeft` in
  // modern browsers, which would invert the edge detection below. RTL support is
  // a house-wide pass with one seam per primitive, not something to half-do here.
  function measure() {
    const el = viewportRef;
    if (!el) return;

    viewportSize = el.clientWidth;
    scrollSize = el.scrollWidth;
    scrollStart = el.scrollLeft;
    // +1 absorbs sub-pixel layout: a row that fits exactly can report a
    // scrollWidth a fraction larger than its clientWidth and would otherwise
    // claim a tab stop and a set of controls it has no use for.
    overflowing = el.scrollWidth > el.clientWidth + 1;

    // `offsetLeft`/`offsetWidth`, NOT `getBoundingClientRect()`: the rect is the
    // VISUAL box and includes transforms, so with `emphasis` on, the item the
    // browser is currently scaling measures ~4% wider than it lays out — and the
    // measurement changes as you scroll. Feeding that back into the scroll
    // targets makes the dots jump to the wrong place, which is exactly what it
    // did before this was fixed. The layout API is transform-free and stable.
    //
    // The viewport is `relative` (see scroller.variants.ts) so it is its
    // children's `offsetParent`; `clientLeft` subtracts its own left border, so
    // the result is measured from the same origin `scrollLeft` addresses.
    const border = el.clientLeft;
    items = Array.from(el.children, (child) => ({
      start: (child as HTMLElement).offsetLeft - border,
      size: (child as HTMLElement).offsetWidth
    }));
  }

  // Two observers, because the row can stop fitting for two unrelated reasons:
  // the container gets narrower (ResizeObserver) or items are added/removed
  // (MutationObserver on childList). Watching only the first is the common bug —
  // a row that grows past its container after a data load never notices.
  $effect(() => {
    const el = viewportRef;
    if (!el) return;

    measure();
    if (typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // Item widths can change without the viewport changing (a CSS length that
    // resolves against a font size, an image that finishes loading), so the
    // items are observed too.
    for (const child of el.children) ro.observe(child);

    const mo =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(() => {
            ro.disconnect();
            ro.observe(el);
            for (const child of el.children) ro.observe(child);
            measure();
          });
    mo?.observe(el, { childList: true });

    return () => {
      ro.disconnect();
      mo?.disconnect();
    };
  });

  // Prop changes that alter the track's geometry — a re-measure, not a re-render
  // concern. Reading them is the point; `measure()` itself only writes.
  $effect(() => {
    void itemBasis;
    void align;
    void gap;
    measure();
  });

  // What the container can actually reach. Passing it into the geometry is what
  // keeps the trailing dots alive: with `align="start"` the last items begin
  // further right than `scrollLeft` can ever go, so judging them by their raw
  // anchor left their dots permanently unlit (see scroller.utils).
  const maxScroll = $derived(Math.max(0, scrollSize - viewportSize));
  const activeIndex = $derived(activeItemIndex(items, scrollStart, viewportSize, align, maxScroll));
  const edges = $derived(scrollEdges(scrollStart, scrollSize, viewportSize));

  // DEV fail-loud: the lift is scroll-position-driven and only means anything
  // when an item can arrive somewhere — with `align="start"` there is no middle,
  // so the variants deliberately do not wire the animation and the prop is a
  // silent no-op. Surface that once per instance. Plain flag, not `$state`: the
  // warn must not feed back into the reactive graph.
  let warnedEmphasisWithoutCenter = false;
  $effect(() => {
    if (
      import.meta.env?.DEV &&
      !warnedEmphasisWithoutCenter &&
      emphasis !== 'none' &&
      align !== 'center'
    ) {
      warnedEmphasisWithoutCenter = true;
      console.warn(
        '[Scroller] emphasis has no effect with align="start" — the lift marks the item in the MIDDLE of the scrollport, and a start-aligned row has no middle to arrive at. Set align="center", or drop emphasis.'
      );
    }
  });

  // Report only real transitions, and never the -1 of an empty row.
  let lastReported = -1;
  $effect(() => {
    if (activeIndex !== -1 && activeIndex !== lastReported) {
      lastReported = activeIndex;
      onActiveChange?.(activeIndex);
    }
  });

  function onViewportScroll() {
    if (viewportRef) scrollStart = viewportRef.scrollLeft;
  }

  // No `behavior` argument on purpose: leaving it at `auto` defers to the
  // `scroll-behavior` CSS property, which the viewport sets to `smooth` and
  // drops to `auto` under `prefers-reduced-motion`. One motion decision, in CSS,
  // instead of a second one in a `matchMedia` check here.
  //
  // If this ever *looks* like a no-op under automation, check the tab first: a
  // backgrounded tab runs no rAF, so no scroll animation of any kind advances
  // and every smooth scroll appears to be ignored. `behavior: 'instant'` still
  // works there, which makes it look like a bug in this function. It is not.
  function scrollToPosition(left: number) {
    viewportRef?.scrollTo({ left });
  }

  function step(direction: 1 | -1) {
    scrollToPosition(
      scrollTargetForStep(items, scrollStart, viewportSize, align, direction, maxScroll)
    );
  }

  function goToItem(index: number) {
    scrollToPosition(scrollTargetForIndex(items, index, viewportSize, align));
  }

  const showControls = $derived(controls === 'always' || (controls === 'auto' && overflowing));
  // Dots earn their place only when part of the row is out of sight; with
  // everything visible they would announce a position nobody needs.
  const showDots = $derived(indicator === 'dots' && overflowing && items.length > 1);
  const showControlBar = $derived(showControls || showDots);

  // A dot's identity IS its ordinal — it stands for "the nth item in this row",
  // and nothing else about it is stable (the measured metrics change on every
  // resize). Keying by the ordinal is therefore the domain-correct key here, not
  // the index-as-key shortcut the house rule warns about: keying by a measured
  // value would rebuild every dot on resize and drop keyboard focus.
  const dotOrdinals = $derived(items.map((_, index) => index));

  const variantProps: ScrollerVariants = $derived({
    align,
    snap,
    gap,
    emphasis,
    // Once buttons or dots are on screen they carry "there is more to see", so
    // the native scrollbar stops being the only promise and starts being a
    // third indicator stacked on the other two. Without them it stays.
    scrollbar: showControlBar ? 'hidden' : 'visible'
  });

  const styles = $derived(scrollerVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Scroller', preset, variantProps, slotClassesProp)
  );

  // Resolved through the typed catalogue rather than a consumer-supplied
  // template (the PinInput convention): the placeholders are checked at compile
  // time, and rewording is an i18n override, not a prop.
  function dotLabel(index: number): string {
    return bt('scroller.item', { index: index + 1, total: items.length });
  }
</script>

<div
  {...restProps}
  class={unstyled
    ? [slotClasses?.root, className].filter(Boolean).join(' ')
    : styles.root({ class: [slotClasses?.root, className] })}
  data-align={align}
  data-overflowing={overflowing || undefined}
>
  <!--
    The tab stop is the whole point of §3.3: a scrollable container that is not
    focusable cannot be scrolled by keyboard at all (Safari does not adopt it
    automatically), which is the defect in nearly every media row on the web.
    It is conditional because the inverse is also a defect — a tab stop on a row
    with nothing to scroll costs a Tab press and does nothing.

    Nothing here handles arrow keys: a focused scroll container already gets
    Arrow/Home/End/PageUp/PageDown scrolling from the browser, snapped, with the
    platform's own inertia. Reimplementing that would be strictly worse.

    `role="group"` and the name are tied to the same condition — a group is only
    warranted once this is a region the user can land on, and `aria-label` on a
    plain div (generic role) would be ignored anyway.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={viewportRef}
    class={unstyled
      ? (slotClasses?.viewport ?? '')
      : styles.viewport({ class: slotClasses?.viewport })}
    style:--blocks-scroller-item={itemBasis}
    role={overflowing ? 'group' : undefined}
    aria-label={overflowing ? label : undefined}
    tabindex={overflowing ? 0 : undefined}
    onscroll={onViewportScroll}
  >
    {@render children()}
  </div>

  {#if showControlBar}
    <div
      class={unstyled
        ? (slotClasses?.controls ?? '')
        : styles.controls({ class: slotClasses?.controls })}
    >
      {#if showControls}
        <!-- Disabled at the ends rather than hidden: a control that disappears
             takes its width with it and shifts the row underneath it. -->
        <CoreIconButton
          aria-label={previousLabel}
          disabled={edges.atStart}
          onclick={() => step(-1)}
          class={unstyled
            ? (slotClasses?.control ?? '')
            : styles.control({ class: slotClasses?.control })}
        >
          <ChevronLeftIcon size={20} />
        </CoreIconButton>
      {/if}

      {#if showDots}
        <div
          class={unstyled
            ? (slotClasses?.indicator ?? '')
            : styles.indicator({ class: slotClasses?.indicator })}
        >
          {#each dotOrdinals as index (index)}
            <button
              type="button"
              aria-label={dotLabel(index)}
              aria-current={index === activeIndex ? 'true' : undefined}
              onclick={() => goToItem(index)}
              class={unstyled ? (slotClasses?.dot ?? '') : styles.dot({ class: slotClasses?.dot })}
            ></button>
          {/each}
        </div>
      {/if}

      {#if showControls}
        <CoreIconButton
          aria-label={nextLabel}
          disabled={edges.atEnd}
          onclick={() => step(1)}
          class={unstyled
            ? (slotClasses?.control ?? '')
            : styles.control({ class: slotClasses?.control })}
        >
          <ChevronRightIcon size={20} />
        </CoreIconButton>
      {/if}
    </div>
  {/if}
</div>
