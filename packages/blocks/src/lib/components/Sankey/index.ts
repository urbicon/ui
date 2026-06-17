import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SankeyLaidOutLink, SankeyLaidOutNode } from '$lib/internal/sankey/layout';
import type { SankeyVariants } from './sankey.variants';

export type SankeyIntent = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

/** Input node of the Sankey component. */
export interface SankeyNode {
  /** Unique ID — referenced by `links.source`/`links.target`. */
  id: string;
  /** Display label rendered at the node. */
  label: string;
  /** Overrides the default intent from the component palette. */
  intent?: SankeyIntent;
  /** Arbitrary metadata for tooltip/snippets. */
  meta?: Record<string, unknown>;
}

/** Input link of the Sankey component. */
export interface SankeyLink {
  /** ID of the source node (must exist in nodes). */
  source: string;
  /** ID of the target node. */
  target: string;
  /** Numeric value — determines the path width. */
  value: number;
  /** Overrides the default intent (default: intent of the source node). */
  intent?: SankeyIntent;
  /** Arbitrary metadata. */
  meta?: Record<string, unknown>;
}

/** Node computed by the layout — passed through to custom snippets. */
export type SankeyLaidOutNodeWithMeta = SankeyLaidOutNode & {
  meta?: Record<string, unknown>;
};
export type SankeyLaidOutLinkWithMeta = SankeyLaidOutLink & {
  meta?: Record<string, unknown>;
};

/**
 * @description Flow diagram (Sankey) for visualizing multi-stage data or value
 * pipelines. Nodes are split into layers; paths are rendered as cubic Bezier
 * curves with value-proportional width. The layout algorithm is embedded (no
 * d3-sankey dependency, ISC license attributed).
 *
 * Hovering/focusing a node or path highlights the connected paths and
 * neighboring nodes. A ResizeObserver adapts the width responsively. An
 * sr-only table provides a screen-reader fallback with source/target/value.
 *
 * @tag display
 * @tag data
 *
 * @example
 * ```svelte
 * <Sankey
 *   nodes={[
 *     { id: 'gas',  label: 'Gas',     intent: 'primary' },
 *     { id: 'pot',  label: 'Pool',    intent: 'neutral' },
 *     { id: 'heat', label: 'Heating', intent: 'success' }
 *   ]}
 *   links={[
 *     { source: 'gas', target: 'pot',  value: 220609 },
 *     { source: 'pot', target: 'heat', value: 220609 }
 *   ]}
 *   formatValue={(v) => formatCurrency(v)}
 *   height={400}
 * />
 * ```
 */
export interface SankeyProps
  extends Omit<SankeyVariants, never>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Node list. */
  nodes: SankeyNode[];
  /** Link list. */
  links: SankeyLink[];

  /** Format function for values (tooltip + sr-only table). */
  formatValue?: (value: number) => string;

  /** Format function for percentages (tooltip). */
  formatPercent?: (percent: number) => string;

  /** Default intent for nodes without their own `intent`. @default 'neutral' */
  intent?: SankeyIntent;

  /** Layer alignment. @default 'justify' */
  nodeAlign?: 'left' | 'right' | 'center' | 'justify';

  /** Pixel width of a node. @default 24 */
  nodeWidth?: number;

  /** Vertical gap between nodes within a layer. @default 16 */
  nodePadding?: number;

  /** Number of relaxation iterations in the layout. @default 6 */
  iterations?: number;

  /**
   * Height of the diagram. Accepts a fixed pixel number or `'auto'`.
   *
   * `'auto'` scales with the node count: roughly `nodes.length × (12 + nodePadding)`,
   * clamped to `[280, 800]`. Useful when the number of nodes varies at
   * runtime and a fixed pixel value would be too small or too large.
   *
   * @default 400
   */
  height?: number | 'auto';

  /**
   * Optional fixed width. Default: derived from the container via
   * ResizeObserver. Set a value only if you need SSR-stable layouts and are
   * willing to give up responsiveness.
   */
  width?: number;

  /** Hover highlight (paths + connected nodes). @default true */
  highlightOnHover?: boolean;

  /**
   * Persistently display values next to node labels (instead of only in the
   * hover tooltip). Useful for print, PDF attachments, static screenshots,
   * or tenant- and client-facing statements where hovering is not possible.
   * Uses `formatValue` for formatting.
   * @default false
   */
  showValues?: boolean;

  /** Hover opacity of the non-focused paths. @default 0.25 */
  dimmedOpacity?: number;

  /** Stroke opacity of the highlighted paths. @default 0.7 */
  highlightedOpacity?: number;

  /** Default stroke opacity of paths without hover. @default 0.45 */
  defaultOpacity?: number;

  /** Click callback for a node. */
  onNodeClick?: (node: SankeyLaidOutNodeWithMeta) => void;

  /** Click callback for a path. */
  onLinkClick?: (link: SankeyLaidOutLinkWithMeta) => void;

  /** Extra classes merged onto the wrapper. */
  class?: string;

  /** Remove default classes. */
  unstyled?: boolean;

  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<
      | 'wrapper'
      | 'svg'
      | 'node'
      | 'nodeRect'
      | 'nodeLabel'
      | 'nodeValue'
      | 'link'
      | 'tooltip'
      | 'tooltipLabel'
      | 'tooltipDetail',
      string
    >
  >;

  /** Preset name. */
  preset?: string;

  /** Custom snippet for node content (inside the SVG, instead of the label). */
  nodeContent?: Snippet<[node: SankeyLaidOutNodeWithMeta]>;

  /** Custom snippet for path rendering (instead of the default cubic Bezier). */
  linkContent?: Snippet<[link: SankeyLaidOutLinkWithMeta]>;

  /** Custom tooltip content for node or path. */
  tooltip?: Snippet<
    [datum: SankeyLaidOutNodeWithMeta | SankeyLaidOutLinkWithMeta, kind: 'node' | 'link']
  >;
}

export { default as Sankey } from './Sankey.svelte';
export { type SankeyVariants, sankeyVariants } from './sankey.variants';
