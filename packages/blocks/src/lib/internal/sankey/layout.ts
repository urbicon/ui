// Sankey layout — pure TypeScript port, no d3 dependency.
//
// Adapted from d3-sankey by Mike Bostock (ISC License).
// https://github.com/d3/d3-sankey
// Copyright 2015–present Mike Bostock. ISC License.
//
// This file implements the standard Sankey algorithm:
//   1. Assign nodes to layers (longest path from source)
//   2. Distribute layers horizontally
//   3. Place nodes within a layer vertically, proportional to their value
//   4. Run relaxation iterations to minimize crossings
//   5. Resolve collisions within a layer
//   6. Compute link endpoints, generate Bézier curves
//
// Deliberately kept minimal — no drag/drop, no cycle detection (beyond a
// simple heuristic that warns on direct self-edges).

export interface SankeyInputNode {
  id: string;
}

export interface SankeyInputLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyLaidOutNode<TNodeMeta = unknown> {
  id: string;
  meta?: TNodeMeta;
  /** Layer index (0 = leftmost). */
  layer: number;
  /** Left pixel coordinate (X0). */
  x0: number;
  /** Right pixel coordinate (X1 = X0 + nodeWidth). */
  x1: number;
  /** Top pixel coordinate. */
  y0: number;
  /** Bottom pixel coordinate. */
  y1: number;
  /** Effective node value (max(Σ incoming, Σ outgoing)). */
  value: number;
  sourceLinks: SankeyLaidOutLink[];
  targetLinks: SankeyLaidOutLink[];
}

export interface SankeyLaidOutLink<TLinkMeta = unknown> {
  source: SankeyLaidOutNode;
  target: SankeyLaidOutNode;
  value: number;
  meta?: TLinkMeta;
  /** Y coordinate at the source node (midpoint of the link height). */
  y0: number;
  /** Y coordinate at the target node. */
  y1: number;
  /** Pixel width of the link (proportional to value). */
  width: number;
  /** Index (for stable ordering / iteration). */
  index: number;
}

export interface SankeyLayoutOptions {
  /** Total width of the layout area in pixels. */
  width: number;
  /** Total height of the layout area in pixels. */
  height: number;
  /** Width of a node. @default 24 */
  nodeWidth?: number;
  /** Vertical spacing between nodes within a layer. @default 8 */
  nodePadding?: number;
  /** Number of relaxation iterations. @default 6 */
  iterations?: number;
  /** Layer alignment. @default 'justify' */
  nodeAlign?: 'left' | 'right' | 'center' | 'justify';
}

export interface SankeyLayoutResult {
  nodes: SankeyLaidOutNode[];
  links: SankeyLaidOutLink[];
}

const DEFAULT_NODE_WIDTH = 24;
const DEFAULT_NODE_PADDING = 8;
const DEFAULT_ITERATIONS = 6;

export function computeSankeyLayout(
  inputNodes: ReadonlyArray<SankeyInputNode & { meta?: unknown }>,
  inputLinks: ReadonlyArray<SankeyInputLink & { meta?: unknown }>,
  options: SankeyLayoutOptions
): SankeyLayoutResult {
  const {
    width,
    height,
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodePadding = DEFAULT_NODE_PADDING,
    iterations = DEFAULT_ITERATIONS,
    nodeAlign = 'justify'
  } = options;

  // ─── 1. Build internal node + link data ───────────────────────────────
  const nodes: SankeyLaidOutNode[] = inputNodes.map((n) => ({
    id: n.id,
    meta: n.meta,
    layer: 0,
    x0: 0,
    x1: 0,
    y0: 0,
    y1: 0,
    value: 0,
    sourceLinks: [],
    targetLinks: []
  }));
  const nodeById = new Map<string, SankeyLaidOutNode>();
  for (const n of nodes) nodeById.set(n.id, n);

  const links: SankeyLaidOutLink[] = [];
  inputLinks.forEach((l, i) => {
    const source = nodeById.get(l.source);
    const target = nodeById.get(l.target);
    if (!source || !target) {
      // Unknown ID — link is dropped; the caller can validate beforehand
      return;
    }
    if (source === target) {
      // Self-edge — not meaningful in a Sankey diagram
      console.warn(`[Sankey] self-loop at node "${l.source}" — link ignored.`);
      return;
    }
    const link: SankeyLaidOutLink = {
      source,
      target,
      value: l.value,
      meta: l.meta,
      width: 0,
      y0: 0,
      y1: 0,
      index: i
    };
    links.push(link);
    source.sourceLinks.push(link);
    target.targetLinks.push(link);
  });

  // Compute the effective node value: max(Σ incoming, Σ outgoing)
  for (const n of nodes) {
    const incoming = n.targetLinks.reduce((s, l) => s + l.value, 0);
    const outgoing = n.sourceLinks.reduce((s, l) => s + l.value, 0);
    n.value = Math.max(incoming, outgoing);
  }

  // ─── 2. Layer assignment via longest path from source ───────────────
  // Pruning via `node.layer >= depth` instead of a separate visited set:
  // if the node already sits at >= depth, the current path is no longer
  // than one already visited, and all children are already at least at
  // depth+1 — no re-recursion needed. For a longer path
  // (depth > node.layer) the layer depth is updated AND propagated further
  // into the children.
  const recursion = new Set<string>();
  let cycleDetected = false;
  const reached = new Set<string>();

  function assignLayerDFS(node: SankeyLaidOutNode, depth: number) {
    if (recursion.has(node.id)) {
      cycleDetected = true;
      return;
    }
    if (reached.has(node.id) && node.layer >= depth) return;
    node.layer = Math.max(node.layer, depth);
    reached.add(node.id);
    recursion.add(node.id);
    for (const link of node.sourceLinks) {
      assignLayerDFS(link.target, depth + 1);
    }
    recursion.delete(node.id);
  }

  // First from actual sources
  for (const n of nodes) {
    if (n.targetLinks.length === 0) assignLayerDFS(n, 0);
  }
  // Then any remaining nodes (e.g. nodes inside cycles that have no
  // pure source predecessor)
  for (const n of nodes) {
    if (!reached.has(n.id)) assignLayerDFS(n, 0);
  }
  if (cycleDetected) {
    console.warn(
      '[Sankey] cycle detected — layout renders linearly, but crossing-free routing is not guaranteed.'
    );
  }

  const maxLayer = Math.max(0, ...nodes.map((n) => n.layer));

  // Move sinks (no outgoing) to the right end for right/justify alignment
  if (nodeAlign === 'right' || nodeAlign === 'justify') {
    for (const n of nodes) {
      if (n.sourceLinks.length === 0) n.layer = maxLayer;
    }
  } else if (nodeAlign === 'left') {
    // Nothing to do; sources are on the left, sinks stay where they are
  } else if (nodeAlign === 'center') {
    // Nodes with neither incoming NOR outgoing go in the middle
    const midLayer = Math.floor(maxLayer / 2);
    for (const n of nodes) {
      if (n.targetLinks.length === 0 && n.sourceLinks.length === 0) n.layer = midLayer;
    }
  }

  // ─── 3. Horizontal positioning (X0/X1) ───────────────────────────────
  const layerCount = maxLayer + 1;
  const layerSpacing = layerCount > 1 ? (width - nodeWidth) / (layerCount - 1) : 0;
  for (const n of nodes) {
    n.x0 = layerCount > 1 ? n.layer * layerSpacing : (width - nodeWidth) / 2;
    n.x1 = n.x0 + nodeWidth;
  }

  // ─── 4. Vertical initialization ──────────────────────────────────────
  const layers: SankeyLaidOutNode[][] = Array.from({ length: layerCount }, () => []);
  for (const n of nodes) layers[n.layer]?.push(n);

  // Scale all values so the densest layer fits into the available height
  let maxLayerValue = 0;
  for (const layer of layers) {
    const layerValueSum = layer.reduce((s, n) => s + n.value, 0);
    if (layerValueSum > maxLayerValue) maxLayerValue = layerValueSum;
  }
  if (maxLayerValue === 0 || nodes.length === 0) {
    // Empty graph or all nodes have value=0 — bail out with empty output
    return { nodes, links };
  }

  // Vertical scale: pixels per unit-of-value
  const maxLayerNodeCount = Math.max(...layers.map((l) => l.length));
  const totalPaddingHeight = (maxLayerNodeCount - 1) * nodePadding;
  const availableHeight = Math.max(0, height - totalPaddingHeight);
  const ky = availableHeight / maxLayerValue;

  // Initial vertical position (stacked from the top)
  for (const layer of layers) {
    let y = 0;
    for (const n of layer) {
      n.y0 = y;
      n.y1 = y + n.value * ky;
      y = n.y1 + nodePadding;
    }
  }

  // Link widths = value * ky
  for (const link of links) {
    link.width = link.value * ky;
  }

  // ─── 5. Relaxation iterations ────────────────────────────────────────
  for (let i = 0; i < iterations; i++) {
    relaxRightToLeft(layers);
    resolveCollisions(layers, height, nodePadding);
    relaxLeftToRight(layers);
    resolveCollisions(layers, height, nodePadding);
  }

  // ─── 6. Compute link endpoints ───────────────────────────────────────
  // For each source: stack the outgoing links in order
  // For each target: stack the incoming links in order
  for (const n of nodes) {
    n.sourceLinks.sort((a, b) => a.target.y0 - b.target.y0);
    n.targetLinks.sort((a, b) => a.source.y0 - b.source.y0);
  }
  for (const n of nodes) {
    let y0 = n.y0;
    let y1 = n.y0;
    for (const link of n.sourceLinks) {
      link.y0 = y0 + link.width / 2;
      y0 += link.width;
    }
    for (const link of n.targetLinks) {
      link.y1 = y1 + link.width / 2;
      y1 += link.width;
    }
  }

  return { nodes, links };
}

function weightedSourceCenter(node: SankeyLaidOutNode): number {
  if (node.targetLinks.length === 0) return centerY(node);
  let weighted = 0;
  let totalWeight = 0;
  for (const link of node.targetLinks) {
    weighted += centerY(link.source) * link.value;
    totalWeight += link.value;
  }
  return totalWeight > 0 ? weighted / totalWeight : centerY(node);
}

function weightedTargetCenter(node: SankeyLaidOutNode): number {
  if (node.sourceLinks.length === 0) return centerY(node);
  let weighted = 0;
  let totalWeight = 0;
  for (const link of node.sourceLinks) {
    weighted += centerY(link.target) * link.value;
    totalWeight += link.value;
  }
  return totalWeight > 0 ? weighted / totalWeight : centerY(node);
}

function centerY(node: SankeyLaidOutNode): number {
  return (node.y0 + node.y1) / 2;
}

function relaxLeftToRight(layers: SankeyLaidOutNode[][]) {
  // Skip leftmost — nothing to relax
  for (let i = 1; i < layers.length; i++) {
    const layer = layers[i];
    for (const node of layer) {
      const target = weightedSourceCenter(node);
      const current = centerY(node);
      const dy = target - current;
      node.y0 += dy;
      node.y1 += dy;
    }
  }
}

function relaxRightToLeft(layers: SankeyLaidOutNode[][]) {
  for (let i = layers.length - 2; i >= 0; i--) {
    const layer = layers[i];
    for (const node of layer) {
      const target = weightedTargetCenter(node);
      const current = centerY(node);
      const dy = target - current;
      node.y0 += dy;
      node.y1 += dy;
    }
  }
}

function resolveCollisions(layers: SankeyLaidOutNode[][], height: number, nodePadding: number) {
  for (const layer of layers) {
    if (layer.length === 0) continue;

    layer.sort((a, b) => a.y0 - b.y0);

    // Top → Bottom: push down on overlap
    let y = 0;
    for (const node of layer) {
      const dy = y - node.y0;
      if (dy > 0) {
        node.y0 += dy;
        node.y1 += dy;
      }
      y = node.y1 + nodePadding;
    }

    // Bottom → Top: compensate upward if extending past the height
    let bottom = height;
    for (let i = layer.length - 1; i >= 0; i--) {
      const node = layer[i];
      const dy = node.y1 - bottom;
      if (dy > 0) {
        node.y0 -= dy;
        node.y1 -= dy;
      }
      bottom = node.y0 - nodePadding;
    }
  }
}

/**
 * Generate a cubic Bézier path between the source and target endpoints of a
 * Sankey link. The control points sit at half the X distance, producing the
 * characteristic S-curve.
 */
export function sankeyLinkPath(link: SankeyLaidOutLink): string {
  const x0 = link.source.x1;
  const x1 = link.target.x0;
  const y0 = link.y0;
  const y1 = link.y1;
  const xi = (x0 + x1) / 2;
  return `M${x0},${y0}C${xi},${y0} ${xi},${y1} ${x1},${y1}`;
}
