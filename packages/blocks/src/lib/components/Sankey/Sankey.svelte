<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { useI18n } from '@urbicon-ui/i18n';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import {
    computeSankeyLayout,
    sankeyLinkPath,
    type SankeyLaidOutLink,
    type SankeyLaidOutNode
  } from '$lib/internal/sankey/layout';
  import type {
    SankeyProps,
    SankeyIntent,
    SankeyLaidOutLinkWithMeta,
    SankeyLaidOutNodeWithMeta
  } from './index';
  import { sankeyVariants } from './sankey.variants';

  const bt = useBlocksI18n();
  const i18n = useI18n();

  let {
    nodes,
    links,
    formatValue,
    formatPercent,
    intent = 'neutral',
    nodeAlign = 'justify',
    nodeWidth = 24,
    nodePadding = 16,
    iterations = 6,
    height = 400,
    width: widthProp,
    highlightOnHover = true,
    showValues = false,
    dimmedOpacity = 0.25,
    highlightedOpacity = 0.7,
    defaultOpacity = 0.45,
    onNodeClick,
    onLinkClick,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    nodeContent: nodeContentSnippet,
    linkContent: linkContentSnippet,
    tooltip: tooltipSnippet,
    ...restProps
  }: SankeyProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Sankey?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Sankey', preset),
      slotClassesProp
    )
  );

  let wrapperRef = $state<HTMLDivElement>();
  let measuredWidth = $state(600);
  // Hover state: can be a node or a link
  type HoveredId = { kind: 'node'; id: string } | { kind: 'link'; index: number } | null;
  let hovered = $state<HoveredId>(null);
  let tooltipPos = $state<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false
  });

  const effectiveWidth = $derived(widthProp ?? measuredWidth);

  const effectiveHeight = $derived.by(() => {
    if (height !== 'auto') return height;
    const minNodeHeight = 12;
    const estimate = nodes.length * (minNodeHeight + nodePadding);
    return Math.max(280, Math.min(800, estimate));
  });

  // ResizeObserver for responsive width
  $effect(() => {
    if (!wrapperRef || widthProp !== undefined) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) measuredWidth = w;
    });
    ro.observe(wrapperRef);
    return () => ro.disconnect();
  });

  const layout = $derived(
    computeSankeyLayout(nodes, links, {
      width: effectiveWidth,
      height: effectiveHeight,
      nodeWidth,
      nodePadding,
      iterations,
      nodeAlign
    })
  );

  // Resolve the default intent per node/path
  const intentClassFill: Record<SankeyIntent, string> = {
    primary: 'fill-primary',
    secondary: 'fill-secondary',
    success: 'fill-success',
    warning: 'fill-warning',
    danger: 'fill-danger',
    neutral: 'fill-neutral'
  };
  const intentClassStroke: Record<SankeyIntent, string> = {
    primary: 'stroke-primary',
    secondary: 'stroke-secondary',
    success: 'stroke-success',
    warning: 'stroke-warning',
    danger: 'stroke-danger',
    neutral: 'stroke-neutral'
  };

  // Map over input nodes — avoids O(n²) `nodes.find()` in render loops
  const inputNodeById = $derived(new Map(nodes.map((n) => [n.id, n])));

  function getNodeFillClass(n: SankeyLaidOutNode) {
    const inputNode = inputNodeById.get(n.id);
    return intentClassFill[inputNode?.intent ?? intent];
  }

  // Link index → original link for intent lookup
  function getOriginalLink(idx: number) {
    return links[idx];
  }

  // Link intent: explicit > source-node intent > component default
  function getLinkStrokeClass(orig: { intent?: SankeyIntent } | undefined, sourceId: string) {
    const sourceIntent = inputNodeById.get(sourceId)?.intent;
    return intentClassStroke[orig?.intent ?? sourceIntent ?? intent];
  }

  // Highlight logic: is this node/link currently focused or connected?
  function isLinkHighlighted(link: SankeyLaidOutLink, linkIdx: number): boolean {
    if (!hovered) return false;
    if (hovered.kind === 'link') return hovered.index === linkIdx;
    return link.source.id === hovered.id || link.target.id === hovered.id;
  }
  function isNodeHighlighted(node: SankeyLaidOutNode): boolean {
    if (!hovered) return false;
    if (hovered.kind === 'node') return node.id === hovered.id;
    if (hovered.kind === 'link') {
      const link = layout.links[hovered.index];
      if (!link) return false;
      return link.source.id === node.id || link.target.id === node.id;
    }
    return false;
  }

  function defaultPercentFmt(p: number) {
    return (
      new Intl.NumberFormat(i18n.locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(p) + ' %'
    );
  }
  const fmtValue = (v: number) => (formatValue ? formatValue(v) : v.toString());
  const fmtPercent = (p: number) => (formatPercent ? formatPercent(p) : defaultPercentFmt(p));

  const totalFlow = $derived(
    layout.links.reduce((s, l) => s + l.value, 0) || layout.nodes.reduce((s, n) => s + n.value, 0)
  );

  function showTooltip(event: MouseEvent | FocusEvent, h: NonNullable<HoveredId>) {
    if (!wrapperRef) return;
    hovered = h;
    const rect = wrapperRef.getBoundingClientRect();
    const x = 'clientX' in event ? event.clientX : rect.left + rect.width / 2;
    const y = 'clientY' in event ? event.clientY : rect.top + rect.height / 2;
    tooltipPos = {
      x: x - rect.left + 8,
      y: y - rect.top + 8,
      visible: true
    };
  }
  function moveTooltip(event: MouseEvent) {
    if (!wrapperRef || !tooltipPos.visible) return;
    const rect = wrapperRef.getBoundingClientRect();
    tooltipPos = {
      x: event.clientX - rect.left + 8,
      y: event.clientY - rect.top + 8,
      visible: true
    };
  }
  function hideTooltip() {
    hovered = null;
    tooltipPos = { ...tooltipPos, visible: false };
  }

  const styles = $derived(sankeyVariants({ intent }));

  // Tooltip data based on the hovered state
  const tooltipDatum = $derived.by<
    | { kind: 'node'; node: SankeyLaidOutNodeWithMeta; inputLabel: string }
    | { kind: 'link'; link: SankeyLaidOutLinkWithMeta; sourceLabel: string; targetLabel: string }
    | null
  >(() => {
    const h = hovered;
    if (!h) return null;
    if (h.kind === 'node') {
      const nodeId = h.id;
      const node = layout.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const input = inputNodeById.get(nodeId);
      return {
        kind: 'node',
        node: node as SankeyLaidOutNodeWithMeta,
        inputLabel: input?.label ?? nodeId
      };
    }
    const link = layout.links[h.index];
    if (!link) return null;
    const sourceInput = inputNodeById.get(link.source.id);
    const targetInput = inputNodeById.get(link.target.id);
    return {
      kind: 'link',
      link: link as SankeyLaidOutLinkWithMeta,
      sourceLabel: sourceInput?.label ?? link.source.id,
      targetLabel: targetInput?.label ?? link.target.id
    };
  });

  function nodeLabelById(id: string) {
    return inputNodeById.get(id)?.label ?? id;
  }

  // Keyboard navigation between focusable elements (rects + paths)
  function handleNodeKeydown(event: KeyboardEvent, node: SankeyLaidOutNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onNodeClick?.(node as SankeyLaidOutNodeWithMeta);
    }
  }
  function handleLinkKeydown(event: KeyboardEvent, link: SankeyLaidOutLink) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onLinkClick?.(link as SankeyLaidOutLinkWithMeta);
    }
  }

  // ARIA summary
  const ariaSummary = $derived.by(() => {
    const summary = links
      .map((l) => `${nodeLabelById(l.source)} → ${nodeLabelById(l.target)}: ${fmtValue(l.value)}`)
      .join('; ');
    return bt('sankey.summary', {
      nodes: String(nodes.length),
      links: String(links.length),
      flows: summary
    });
  });
</script>

<div
  bind:this={wrapperRef}
  class={unstyled
    ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
  style="height: {effectiveHeight}px"
  onmousemove={moveTooltip}
  {...restProps}
>
  <svg
    role="img"
    aria-label={ariaSummary}
    class={unstyled ? (slotClasses?.svg ?? '') : styles.svg({ class: slotClasses?.svg })}
    viewBox="0 0 {effectiveWidth} {effectiveHeight}"
    width={effectiveWidth}
    height={effectiveHeight}
    preserveAspectRatio="none"
  >
    <!-- Links first so nodes render on top -->
    <g class="sankey-links">
      {#each layout.links as link, idx (`${link.source.id}-${link.target.id}-${idx}`)}
        {@const orig = getOriginalLink(idx)}
        {@const highlighted = isLinkHighlighted(link, idx)}
        {@const dimmed = hovered !== null && !highlighted}
        {#if linkContentSnippet}
          {@render linkContentSnippet(link as SankeyLaidOutLinkWithMeta)}
        {:else}
          <path
            tabindex="0"
            role="button"
            aria-label={`${link.source.id} → ${link.target.id}: ${fmtValue(link.value)}`}
            class={[
              unstyled ? (slotClasses?.link ?? '') : styles.link({ class: slotClasses?.link }),
              !unstyled && getLinkStrokeClass(orig, link.source.id)
            ]
              .filter(Boolean)
              .join(' ')}
            d={sankeyLinkPath(link)}
            stroke-width={Math.max(1, link.width)}
            style:stroke-opacity={dimmed
              ? dimmedOpacity
              : highlighted
                ? highlightedOpacity
                : defaultOpacity}
            onmouseenter={(e) => highlightOnHover && showTooltip(e, { kind: 'link', index: idx })}
            onmouseleave={hideTooltip}
            onfocus={(e) => showTooltip(e, { kind: 'link', index: idx })}
            onblur={hideTooltip}
            onclick={() => onLinkClick?.(link as SankeyLaidOutLinkWithMeta)}
            onkeydown={(e) => handleLinkKeydown(e, link)}
          ></path>
        {/if}
      {/each}
    </g>

    <!-- Nodes -->
    <g class="sankey-nodes">
      {#each layout.nodes as node (node.id)}
        {@const highlighted = isNodeHighlighted(node)}
        {@const dimmed = hovered !== null && !highlighted}
        <g
          tabindex="0"
          role="button"
          aria-label={`${nodeLabelById(node.id)}: ${fmtValue(node.value)}`}
          class={unstyled ? (slotClasses?.node ?? '') : styles.node({ class: slotClasses?.node })}
          style:opacity={dimmed ? dimmedOpacity * 1.5 : 1}
          onmouseenter={(e) => highlightOnHover && showTooltip(e, { kind: 'node', id: node.id })}
          onmouseleave={hideTooltip}
          onfocus={(e) => showTooltip(e, { kind: 'node', id: node.id })}
          onblur={hideTooltip}
          onclick={() => onNodeClick?.(node as SankeyLaidOutNodeWithMeta)}
          onkeydown={(e) => handleNodeKeydown(e, node)}
        >
          {#if nodeContentSnippet}
            {@render nodeContentSnippet(node as SankeyLaidOutNodeWithMeta)}
          {:else}
            <rect
              class={[
                unstyled
                  ? (slotClasses?.nodeRect ?? '')
                  : styles.nodeRect({ class: slotClasses?.nodeRect }),
                !unstyled && getNodeFillClass(node)
              ]
                .filter(Boolean)
                .join(' ')}
              x={node.x0}
              y={node.y0}
              width={node.x1 - node.x0}
              height={Math.max(0, node.y1 - node.y0)}
              rx="2"
            ></rect>
            {@const labelOnRight = node.x0 < effectiveWidth / 2}
            <text
              class={unstyled
                ? (slotClasses?.nodeLabel ?? '')
                : styles.nodeLabel({ class: slotClasses?.nodeLabel })}
              x={labelOnRight ? node.x1 + 6 : node.x0 - 6}
              y={(node.y0 + node.y1) / 2}
              dy={showValues ? '-0.05em' : '0.32em'}
              text-anchor={labelOnRight ? 'start' : 'end'}
            >
              {nodeLabelById(node.id)}
            </text>
            {#if showValues}
              <text
                class={unstyled
                  ? (slotClasses?.nodeValue ?? '')
                  : styles.nodeValue({ class: slotClasses?.nodeValue })}
                x={labelOnRight ? node.x1 + 6 : node.x0 - 6}
                y={(node.y0 + node.y1) / 2}
                dy="1.05em"
                text-anchor={labelOnRight ? 'start' : 'end'}
              >
                {fmtValue(node.value)}
              </text>
            {/if}
          {/if}
        </g>
      {/each}
    </g>
  </svg>

  <!-- HTML tooltip overlay -->
  <div
    class={unstyled
      ? (slotClasses?.tooltip ?? '')
      : styles.tooltip({ class: slotClasses?.tooltip })}
    style:left="{tooltipPos.x}px"
    style:top="{tooltipPos.y}px"
    data-visible={tooltipPos.visible ? 'true' : 'false'}
    aria-hidden="true"
  >
    {#if tooltipDatum && tooltipSnippet}
      {#if tooltipDatum.kind === 'node'}
        {@render tooltipSnippet(tooltipDatum.node, 'node')}
      {:else}
        {@render tooltipSnippet(tooltipDatum.link, 'link')}
      {/if}
    {:else if tooltipDatum?.kind === 'node'}
      <span
        class={unstyled
          ? (slotClasses?.tooltipLabel ?? '')
          : styles.tooltipLabel({ class: slotClasses?.tooltipLabel })}
      >
        {tooltipDatum.inputLabel}
      </span>
      <span
        class={[
          unstyled
            ? (slotClasses?.tooltipDetail ?? '')
            : styles.tooltipDetail({ class: slotClasses?.tooltipDetail }),
          'block'
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {fmtValue(tooltipDatum.node.value)}
        {#if totalFlow > 0}
          · {fmtPercent((tooltipDatum.node.value / totalFlow) * 100)}
        {/if}
      </span>
    {:else if tooltipDatum?.kind === 'link'}
      <span
        class={unstyled
          ? (slotClasses?.tooltipLabel ?? '')
          : styles.tooltipLabel({ class: slotClasses?.tooltipLabel })}
      >
        {tooltipDatum.sourceLabel} → {tooltipDatum.targetLabel}
      </span>
      <span
        class={[
          unstyled
            ? (slotClasses?.tooltipDetail ?? '')
            : styles.tooltipDetail({ class: slotClasses?.tooltipDetail }),
          'block'
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {fmtValue(tooltipDatum.link.value)}
        {#if totalFlow > 0}
          · {fmtPercent((tooltipDatum.link.value / totalFlow) * 100)}
        {/if}
      </span>
    {/if}
  </div>

  <!-- Screen-reader table -->
  <table class="sr-only">
    <caption>{ariaSummary}</caption>
    <thead>
      <tr>
        <th scope="col">{bt('sankey.source')}</th>
        <th scope="col">{bt('sankey.target')}</th>
        <th scope="col">{bt('sankey.value')}</th>
      </tr>
    </thead>
    <tbody>
      {#each links as link (`${link.source}-${link.target}`)}
        <tr>
          <td>{nodeLabelById(link.source)}</td>
          <td>{nodeLabelById(link.target)}</td>
          <td>{fmtValue(link.value)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
