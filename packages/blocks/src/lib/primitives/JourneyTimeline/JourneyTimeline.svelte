<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import CircleDotIconDefault from '$lib/icons/CircleDotIcon.svelte';
  import BanIconDefault from '$lib/icons/BanIcon.svelte';
  import MinusIconDefault from '$lib/icons/MinusIcon.svelte';
  import {
    journeyTimelineVariants,
    type JourneyTimelineSlots,
    type JourneyTimelineVariants
  } from './journey-timeline.variants';
  import type { JourneyNode, JourneyStatus, JourneyTimelineProps } from './index';

  const bt = useBlocksI18n();

  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const CircleDotIcon = resolveIcon('circleDot', CircleDotIconDefault);
  const BanIcon = resolveIcon('ban', BanIconDefault);
  const MinusIcon = resolveIcon('minus', MinusIconDefault);

  let {
    items,
    orientation = 'vertical',
    size = 'md',
    focusId = $bindable(),
    defaultFocusId,
    scrollSpy = false,
    onFocusChange,
    node,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: JourneyTimelineProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // --- focus state (controlled via bind:focusId, else internal) -------------
  const focusableItems = $derived(items.filter((it) => it.focusable !== false));

  // Default focus: explicit → first `active` node → first focusable node.
  const defaultFocus = $derived(
    (defaultFocusId !== undefined && focusableItems.some((it) => it.id === defaultFocusId)
      ? defaultFocusId
      : undefined) ??
      items.find((it) => it.status === 'active' && it.focusable !== false)?.id ??
      focusableItems[0]?.id
  );

  let internalFocusId = $state<string | undefined>(undefined);
  const activeFocusId = $derived(
    focusId !== undefined ? focusId : (internalFocusId ?? defaultFocus)
  );

  // The roving-tabindex target: the last keyboard/click-touched node, else the
  // expanded node. Kept distinct from `activeFocusId` so arrow keys can move DOM
  // focus without expanding (expansion happens on Enter/Space/click).
  let rovingId = $state<string | undefined>(undefined);
  const tabbableId = $derived(rovingId ?? activeFocusId ?? focusableItems[0]?.id);

  function setFocus(id: string) {
    const target = items.find((it) => it.id === id);
    if (!target || target.focusable === false || id === activeFocusId) return;
    if (focusId !== undefined) focusId = id;
    else internalFocusId = id;
    onFocusChange?.(id);
  }

  function activate(item: JourneyNode) {
    rovingId = item.id;
    setFocus(item.id);
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

  // --- scroll-spy (optional) -------------------------------------------------
  $effect(() => {
    if (!scrollSpy || !rootRef) return;
    // Re-subscribe when the node set changes (reading `items` makes it a dep).
    const currentItems = items;
    const nodeEls = Array.from(rootRef.querySelectorAll<HTMLElement>('[data-journey-node]'));
    if (nodeEls.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.nodeId;
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const topmost = currentItems.find((it) => it.focusable !== false && visible.has(it.id));
        if (topmost) setFocus(topmost.id);
      },
      // A node counts as "current" while it sits in the top 40% of the viewport.
      { rootMargin: '0px 0px -60% 0px', threshold: 0 }
    );
    for (const el of nodeEls) observer.observe(el);
    return () => observer.disconnect();
  });

  // --- styling ---------------------------------------------------------------
  type Styles = ReturnType<typeof journeyTimelineVariants>;

  const containerStyles = $derived(
    unstyled ? null : journeyTimelineVariants({ orientation, size })
  );

  function nodeStyles(item: JourneyNode, focused: boolean): Styles | null {
    return unstyled
      ? null
      : journeyTimelineVariants({
          orientation,
          size,
          status: item.status,
          focused,
          interactive: item.focusable !== false
        });
  }

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'JourneyTimeline',
      preset,
      { orientation, size } satisfies JourneyTimelineVariants,
      slotClassesProp
    )
  );

  function sc(styles: Styles | null, key: JourneyTimelineSlots, extra?: string | false) {
    const override = [slotClasses?.[key], extra].filter(Boolean).join(' ') || undefined;
    if (unstyled || !styles) return override;
    return styles[key]({ class: override });
  }

  function connectorCls(travelled: boolean) {
    const styles = unstyled
      ? null
      : journeyTimelineVariants({ orientation, size, connectorComplete: travelled });
    return sc(styles, 'connector');
  }

  // --- misc derived ----------------------------------------------------------
  const iconSize = $derived(size === 'sm' ? 14 : size === 'lg' ? 20 : 16);
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

<!-- Marker glyph — decorative; the status is conveyed by the sr-only label. -->
{#snippet markerGlyph(item: JourneyNode)}
  {#if item.status === 'complete'}
    <CheckIcon size={iconSize} aria-hidden="true" />
  {:else if item.status === 'active'}
    <CircleDotIcon size={iconSize} aria-hidden="true" />
  {:else if item.status === 'blocked'}
    <BanIcon size={iconSize} aria-hidden="true" />
  {:else if item.status === 'skipped'}
    <MinusIcon size={iconSize} aria-hidden="true" />
  {/if}
{/snippet}

{#snippet header(item: JourneyNode, styles: Styles | null)}
  <span class={sc(styles, 'marker')}>{@render markerGlyph(item)}</span>
  <span class={sc(styles, 'labelGroup')}>
    <span class={sc(styles, 'title')}>{item.title}</span>
    {#if item.subtitle}
      <span class={sc(styles, 'subtitle')}>{item.subtitle}</span>
    {/if}
  </span>
  <span class="sr-only">{statusLabel(item.status)}</span>
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
      aria-expanded={focused}
      aria-controls={node
        ? orientation === 'horizontal'
          ? panelId
          : detailDomId(index)
        : undefined}
      onclick={() => activate(item)}
    >
      {@render header(item, styles)}
    </button>
  {:else}
    <div class={sc(styles, 'trigger')} data-node-id={item.id}>
      {@render header(item, styles)}
    </div>
  {/if}
{/snippet}

<div
  bind:this={rootRef}
  class={sc(containerStyles, 'base', className)}
  data-orientation={orientation}
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
      {@const styles = nodeStyles(item, focused)}
      {#if orientation === 'horizontal'}
        <li
          class={sc(styles, 'node')}
          data-journey-node=""
          data-node-id={item.id}
          aria-current={item.status === 'active' ? 'step' : undefined}
        >
          {@render trigger(item, index, focused, styles)}
          <span
            data-journey-connector
            class={connectorCls(item.status === 'complete')}
            aria-hidden="true"
          ></span>
        </li>
      {:else}
        <li
          class={sc(styles, 'node')}
          data-journey-node=""
          data-node-id={item.id}
          aria-current={item.status === 'active' ? 'step' : undefined}
        >
          {@render trigger(item, index, focused, styles)}
          <div class={sc(styles, 'body')}>
            <div class={sc(styles, 'connectorColumn')}>
              <span
                data-journey-connector
                class={connectorCls(item.status === 'complete')}
                aria-hidden="true"
              ></span>
            </div>
            {#if node && item.focusable !== false}
              <div
                id={detailDomId(index)}
                role="region"
                aria-label={item.title}
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
        </li>
      {/if}
    {/each}
  </ol>

  {#if orientation === 'horizontal' && node && focusedItem}
    <div
      id={panelId}
      role="region"
      aria-label={focusedItem.title}
      class={sc(containerStyles, 'panel')}
    >
      {@render node(focusedItem)}
    </div>
  {/if}
</div>
