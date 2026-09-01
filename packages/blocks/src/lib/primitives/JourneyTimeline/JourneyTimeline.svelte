<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import {
    journeyTimelineVariants,
    type JourneyTimelineSlots,
    type JourneyTimelineVariants
  } from './journey-timeline.variants';
  import type { JourneyNode, JourneyStatus, JourneyTimelineProps } from './index';

  const bt = useBlocksI18n();

  let {
    items,
    orientation = 'vertical',
    size = 'md',
    detail: detailProp,
    focusId = $bindable(),
    defaultFocusId,
    onFocusChange,
    node,
    meta,
    marker,
    trailing,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: JourneyTimelineProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Horizontal always renders the shared panel — inline expansion inside a
  // horizontal rail has no sane geometry. `detail` only chooses for vertical.
  const detailMode = $derived(orientation === 'horizontal' ? 'panel' : (detailProp ?? 'inline'));

  // The chronicle axis renders as soon as any node carries `meta` (or a rich
  // `meta` snippet is provided).
  const hasMetaRail = $derived(!!meta || items.some((it) => it.meta !== undefined));

  // --- focus state (controlled via bind:focusId, else internal) -------------
  const focusableItems = $derived(items.filter((it) => it.focusable !== false));
  const isFocusable = (id: string | undefined) =>
    id !== undefined && focusableItems.some((it) => it.id === id);

  // Default focus: explicit → first `active` node → first focusable node.
  const defaultFocus = $derived(
    (isFocusable(defaultFocusId) ? defaultFocusId : undefined) ??
      items.find((it) => it.status === 'active' && it.focusable !== false)?.id ??
      focusableItems[0]?.id
  );

  let internalFocusId = $state<string | undefined>(undefined);
  // A stale internal focus (the focused node was removed) falls back to the
  // default so a node is always in focus. A controlled `focusId` is honoured
  // as-is (write-strict) and only surfaced via the dev warning below.
  const activeFocusId = $derived(
    focusId !== undefined ? focusId : isFocusable(internalFocusId) ? internalFocusId : defaultFocus
  );

  // The roving-tabindex target: the last keyboard/click-touched node, else the
  // focused node. Kept distinct from `activeFocusId` so arrow keys can move DOM
  // focus without changing the focused node (that happens on Enter/Space/click).
  // Guarded against removed nodes so the tab stop never lands on nothing.
  let rovingId = $state<string | undefined>(undefined);
  // Every candidate is validated against the live focusable set (not just the
  // first non-undefined one), so a stale roving/active id — or a bad controlled
  // focusId — can never leave every button with tabindex=-1.
  const tabbableId = $derived(
    [rovingId, activeFocusId, focusableItems[0]?.id].find((id) => isFocusable(id))
  );

  // Dev-only signals for caller mistakes that otherwise fail silently. Mirrors
  // the `Select`/`Guide` precedent (`import.meta.env?.DEV && console.warn`).
  $effect(() => {
    if (!import.meta.env?.DEV || items.length === 0) return;
    if (focusId !== undefined && !isFocusable(focusId)) {
      console.warn(
        `[JourneyTimeline] focusId "${focusId}" matches no focusable node — no node shows its detail.`
      );
    }
    if (focusId === undefined && defaultFocusId !== undefined && !isFocusable(defaultFocusId)) {
      console.warn(
        `[JourneyTimeline] defaultFocusId "${defaultFocusId}" matches no focusable node — falling back to the first active/focusable node.`
      );
    }
    if (!node && focusableItems.length > 0) {
      console.warn(
        '[JourneyTimeline] focusable nodes render as buttons but no `node` snippet was provided. Pass a `node` snippet or set focusable:false on nodes that carry no detail.'
      );
    }
    if (orientation === 'horizontal' && detailProp === 'inline') {
      console.warn(
        '[JourneyTimeline] detail="inline" is ignored for orientation="horizontal" — the horizontal rail always renders the shared panel.'
      );
    }
  });

  function setFocus(id: string): boolean {
    const target = items.find((it) => it.id === id);
    if (!target || target.focusable === false || id === activeFocusId) return false;
    if (focusId !== undefined) focusId = id;
    else internalFocusId = id;
    onFocusChange?.(id);
    return true;
  }

  function activate(item: JourneyNode) {
    rovingId = item.id;
    if (setFocus(item.id)) pinFocusAnchor(item.id);
  }

  // --- focus anchor pinning --------------------------------------------------
  // When activating a node below the currently open card, that card's collapse
  // would yank the freshly activated header up the page. While the height
  // transition runs, counter-scroll each frame so the activated header stays
  // visually stationary — the context moves, the focus point doesn't. Real user
  // scroll input cancels the pin immediately. Inline vertical detail only; the
  // panel modes never change geometry.
  // Only one pin may drive the scroll at a time: activating another node while
  // a pin is in flight cancels it first (two loops anchored to different
  // headers would fight over the scroll position frame by frame).
  let cancelActivePin: (() => void) | undefined;
  function pinFocusAnchor(id: string) {
    if (orientation !== 'vertical' || detailMode !== 'inline' || !node || !rootRef) return;
    cancelActivePin?.();
    const anchor = rootRef.querySelector<HTMLElement>(
      `[data-journey-trigger][data-node-id="${id}"]`
    );
    if (!anchor) return;

    // Nearest scrollable ancestor, else the window.
    let scroller: HTMLElement | null = rootRef.parentElement;
    while (scroller) {
      const style = getComputedStyle(scroller);
      if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight)
        break;
      scroller = scroller.parentElement;
    }

    // Pin for as long as the grid-rows transition runs (motion tokens collapse
    // to 1ms under prefers-reduced-motion, so the pin is a single correction).
    const detailEl = rootRef.querySelector<HTMLElement>('[data-journey-detail]');
    const raw = detailEl ? getComputedStyle(detailEl).transitionDuration.split(',')[0].trim() : '';
    const parsed = raw.endsWith('ms')
      ? Number.parseFloat(raw)
      : raw.endsWith('s')
        ? Number.parseFloat(raw) * 1000
        : Number.NaN;
    const duration = Math.min(Number.isFinite(parsed) ? parsed + 80 : 380, 600);

    const startTop = anchor.getBoundingClientRect().top;
    const start = performance.now();
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    cancelActivePin = cancel;
    window.addEventListener('wheel', cancel, { passive: true, capture: true });
    window.addEventListener('touchmove', cancel, { passive: true, capture: true });
    const cleanup = () => {
      window.removeEventListener('wheel', cancel, { capture: true });
      window.removeEventListener('touchmove', cancel, { capture: true });
      if (cancelActivePin === cancel) cancelActivePin = undefined;
    };
    const step = () => {
      if (cancelled || !anchor.isConnected) {
        cleanup();
        return;
      }
      const drift = anchor.getBoundingClientRect().top - startTop;
      if (drift !== 0) {
        if (scroller) scroller.scrollTop += drift;
        else window.scrollBy(0, drift);
      }
      if (performance.now() - start < duration) requestAnimationFrame(step);
      else cleanup();
    };
    requestAnimationFrame(step);
  }

  // --- keyboard roving navigation -------------------------------------------
  let rootRef = $state<HTMLDivElement>();

  function triggerEls(): HTMLElement[] {
    return rootRef
      ? Array.from(rootRef.querySelectorAll<HTMLElement>('[data-journey-trigger]'))
      : [];
  }

  function moveFocus(delta: number) {
    const els = triggerEls();
    if (els.length === 0) return;
    const currentId = rovingId ?? activeFocusId;
    const currentIdx = els.findIndex((el) => el.dataset.nodeId === currentId);
    const startIdx = currentIdx === -1 ? (delta > 0 ? -1 : 0) : currentIdx;
    const next = els[(startIdx + delta + els.length) % els.length];
    if (!next) return;
    rovingId = next.dataset.nodeId;
    next.focus();
  }

  function focusEdge(edge: 'first' | 'last') {
    const els = triggerEls();
    const el = edge === 'first' ? els[0] : els[els.length - 1];
    if (!el) return;
    rovingId = el.dataset.nodeId;
    el.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Only navigate when a node header is focused — never hijack arrow keys
    // typed inside an expanded node's detail content.
    if (!(e.target as HTMLElement)?.hasAttribute?.('data-journey-trigger')) return;
    const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
    const backward = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
    switch (e.key) {
      case forward:
        e.preventDefault();
        moveFocus(1);
        break;
      case backward:
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        e.preventDefault();
        focusEdge('first');
        break;
      case 'End':
        e.preventDefault();
        focusEdge('last');
        break;
      // Enter / Space activate via the native <button> click → activate().
    }
  }

  // --- styling ---------------------------------------------------------------
  type Styles = ReturnType<typeof journeyTimelineVariants>;

  // The timeline's own state, and all four of it: `detailMode` reads nothing but
  // `orientation` and the `detail` prop, and `hasMetaRail` is one `.some()` over
  // every item — so both carry the same value into the container and into every
  // node, which is what makes them the component's to speak for. One object read
  // by the styling calls and by the override cascade, so a rule keyed on the
  // shape being painted cannot see a different one.
  const variantProps = $derived({
    orientation,
    size,
    detail: detailMode,
    withMeta: hasMetaRail
  } satisfies JourneyTimelineVariants);

  const containerStyles = $derived(unstyled ? null : journeyTimelineVariants(variantProps));

  // The axes below genuinely vary per node, so they stay out of `variantProps`:
  // one resolved override record is applied to every slot, and a rule keyed on
  // one node's status would claim it of all of them.
  function nodeStyles(item: JourneyNode, focused: boolean): Styles | null {
    return unstyled
      ? null
      : journeyTimelineVariants({
          ...variantProps,
          status: item.status,
          focused,
          interactive: item.focusable !== false,
          // The connector leaving a completed node reads as "travelled".
          travelled: item.status === 'complete',
          connectorStyle: item.connector ?? 'solid'
        });
  }

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'JourneyTimeline',
      preset,
      variantProps,
      slotClassesProp,
      journeyTimelineVariants.config
    )
  );

  function sc(styles: Styles | null, key: JourneyTimelineSlots, extra?: string | false) {
    const override = resolveClassChain(slotClasses?.[key], extra) || undefined;
    if (unstyled || !styles) return override;
    return styles[key]({ class: override });
  }

  // --- misc derived ----------------------------------------------------------
  const focusedItem = $derived(
    items.find((it) => it.focusable !== false && it.id === activeFocusId)
  );

  const propsId = $props.id();
  const uid = `journey-${propsId}`;
  const detailDomId = (index: number) => `${uid}-detail-${index}`;
  const panelId = `${uid}-panel`;

  function statusLabel(status: JourneyStatus) {
    return bt(`journeyTimeline.status.${status}`);
  }
</script>

{#snippet metaCell(item: JourneyNode, styles: Styles | null)}
  {#if meta}
    {@render meta(item)}
  {:else if item.meta !== undefined}
    <span class={sc(styles, 'meta')}>{item.meta}</span>
  {/if}
{/snippet}

{#snippet labels(item: JourneyNode, styles: Styles | null)}
  <span class={sc(styles, 'labelGroup')}>
    <span class={sc(styles, 'title')}>{item.title}</span>
    {#if item.subtitle}
      <span class={sc(styles, 'subtitle')}>{item.subtitle}</span>
    {/if}
  </span>
  <span class="sr-only">{statusLabel(item.status)}</span>
{/snippet}

{#snippet markerDot(item: JourneyNode, styles: Styles | null)}
  <!-- Decorative either way: the status is announced via the sr-only label,
       so custom glyph content never needs to be readable. -->
  <span class={sc(styles, 'marker')} data-journey-marker="" aria-hidden="true">
    {#if marker}{@render marker(item)}{/if}
  </span>
{/snippet}

{#snippet headerRow(item: JourneyNode, index: number, focused: boolean, styles: Styles | null)}
  <div class={sc(styles, 'header')}>
    {@render trigger(item, index, focused, styles)}
    {#if trailing}
      <div class={sc(styles, 'trailing')} data-journey-trailing="">
        {@render trailing(item)}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet trigger(item: JourneyNode, index: number, focused: boolean, styles: Styles | null)}
  {@const interactive = item.focusable !== false}
  {#if interactive}
    <button
      type="button"
      class={sc(styles, 'trigger')}
      data-journey-trigger=""
      data-node-id={item.id}
      tabindex={item.id === tabbableId ? 0 : -1}
      aria-expanded={node ? focused : undefined}
      aria-controls={node
        ? detailMode === 'panel'
          ? // Reference the shared readout only while it actually renders — a
            // bad controlled focusId leaves no panel to point at.
            focusedItem && panelId
          : detailDomId(index)
        : undefined}
      onclick={() => activate(item)}
    >
      {@render labels(item, styles)}
    </button>
  {:else}
    <div class={sc(styles, 'trigger')} data-node-id={item.id}>
      {@render labels(item, styles)}
    </div>
  {/if}
{/snippet}

<div
  bind:this={rootRef}
  class={sc(containerStyles, 'base', className)}
  data-orientation={orientation}
  data-detail={detailMode}
  {...restProps}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ol
    class={sc(containerStyles, 'rail')}
    aria-label={bt('journeyTimeline.label')}
    onkeydown={handleKeydown}
  >
    {#each items as item, index (item.id)}
      {@const focused = item.focusable !== false && item.id === activeFocusId}
      {@const last = index === items.length - 1}
      {@const styles = nodeStyles(item, focused)}
      {#if orientation === 'horizontal'}
        <li
          class={sc(styles, 'node')}
          data-journey-node=""
          data-node-id={item.id}
          aria-current={item.status === 'active' ? 'step' : undefined}
        >
          {#if hasMetaRail}
            <div class={sc(styles, 'metaColumn')}>
              {#if meta || item.meta !== undefined}
                {@render metaCell(item, styles)}
              {:else}
                <!-- Empty placeholder keeps every station's meta row the same
                     height, so markers and titles stay on one baseline. -->
                <span class={sc(styles, 'meta')} aria-hidden="true">&nbsp;</span>
              {/if}
            </div>
          {/if}
          <!-- DOM order header → spine (visual order flipped via order-*):
               a segment label is announced after the node it departs from. -->
          {@render headerRow(item, index, focused, styles)}
          <div class={sc(styles, 'markerColumn')}>
            {@render markerDot(item, styles)}
            {#if !last}
              <span data-journey-connector="" class={sc(styles, 'connector')} aria-hidden="true"
              ></span>
              {#if item.segmentLabel}
                <span class={sc(styles, 'segment')} data-journey-segment="">
                  {item.segmentLabel}
                </span>
                <span data-journey-connector="" class={sc(styles, 'connector')} aria-hidden="true"
                ></span>
              {/if}
            {/if}
          </div>
        </li>
      {:else}
        <li
          class={sc(styles, 'node')}
          data-journey-node=""
          data-node-id={item.id}
          aria-current={item.status === 'active' ? 'step' : undefined}
        >
          {#if hasMetaRail}
            <div class={sc(styles, 'metaColumn')}>
              {@render metaCell(item, styles)}
            </div>
          {/if}
          <div class={sc(styles, 'markerColumn')}>
            {@render markerDot(item, styles)}
            {#if !last}
              <span data-journey-connector="" class={sc(styles, 'connector')} aria-hidden="true"
              ></span>
            {/if}
          </div>
          <div class={sc(styles, 'content', last && 'pb-0')}>
            <div class={sc(styles, 'card')}>
              {@render headerRow(item, index, focused, styles)}
              {#if detailMode === 'inline' && node && item.focusable !== false}
                <div
                  id={detailDomId(index)}
                  role="region"
                  aria-label={item.title}
                  data-journey-detail=""
                  class={sc(styles, 'detail')}
                  style="grid-template-rows: {focused ? '1fr' : '0fr'}"
                >
                  <div class={sc(styles, 'detailInner')}>
                    <div class={sc(styles, 'detailContent')}>
                      {#if focused}{@render node(item)}{/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
            {#if item.segmentLabel && !last}
              <div class={sc(styles, 'segment')} data-journey-segment="">
                {item.segmentLabel}
              </div>
            {/if}
          </div>
        </li>
      {/if}
    {/each}
  </ol>

  {#if detailMode === 'panel' && node && focusedItem}
    <div
      id={panelId}
      role="region"
      aria-label={focusedItem.title}
      data-journey-panel=""
      class={sc(containerStyles, 'panel')}
    >
      {@render node(focusedItem)}
    </div>
  {/if}
</div>
