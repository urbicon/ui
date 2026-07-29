import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { JourneyTimelineSlots, JourneyTimelineVariants } from './journey-timeline.variants';

/** Lifecycle status of a journey node — drives marker colour and title tone. */
export type JourneyStatus = 'complete' | 'active' | 'pending' | 'attention' | 'blocked' | 'skipped';

/** A single node (waypoint) on a {@link JourneyTimelineProps | JourneyTimeline}. */
export interface JourneyNode {
  /** Stable unique identifier — used as the focus key and for `{#each}` keying. */
  id: string;
  /** Node title, always visible next to the marker. */
  title: string;
  /**
   * Lifecycle status. Maps to a semantic dot marker + title tone:
   * `complete` (success), `active` (primary, ringed), `pending` (hollow),
   * `attention` (warning — worth a look, does not block), `blocked` (danger),
   * `skipped` (muted). The status is also announced through a visually-hidden
   * label.
   */
  status: JourneyStatus;
  /** Short context line shown below the title. */
  subtitle?: string;
  /**
   * Label on the chronicle axis (the meta rail left of the markers) — a time,
   * date, version, actor…. The rail renders as soon as any node provides `meta`
   * (or the `meta` snippet is set). Vertical orientation renders it as a
   * right-aligned column; horizontal as a date row above the spine.
   */
  meta?: string;
  /**
   * Line style of the connector *leaving* this node — lets the connector carry
   * meaning (e.g. solid = ride, dashed/dotted = transfer, walk, gap in the
   * record). @default 'solid'
   */
  connector?: 'solid' | 'dashed' | 'dotted';
  /**
   * Label for the segment between this node and the next (a duration, transport
   * mode, "3 days in transit"…). Rendered along the connector; ignored on the
   * last node.
   */
  segmentLabel?: string;
  /**
   * When `false`, the node is a pure waypoint: it renders marker + labels but
   * cannot receive focus, shows no detail, and is skipped by keyboard navigation.
   * @default true
   */
  focusable?: boolean;
}

/**
 * @summary The record of what happened, in order — shipments, audits, itineraries.
 * @description Retrospective chronicle timeline (focus + context): an ordered
 * record of what happened / where things stand — shipment tracking, audit
 * trails, travel logs, billing runs. Exactly one focusable node is in focus and
 * shows rich detail (`node` snippet); the rest stay quiet, compact context
 * rows. The chronicle axis is first-class: per-node `meta` (time/date/actor)
 * renders on a meta rail, connectors carry meaning (`solid | dashed | dotted`)
 * and `segmentLabel` annotates the stretch between nodes. Rows extend without
 * forking the layout: a `marker` snippet puts glyphs inside the status dots, a
 * `trailing` snippet adds badges/help/actions beside each header (outside the
 * button — safe for interactive elements), and the `attention` status flags
 * optional-but-noteworthy rows. Detail placement is configurable:
 * `detail="inline"` expands in place (vertical default); `detail="panel"`
 * renders a stable readout beside (wide) or docked below (narrow) the rail —
 * horizontal always uses the panel. Use `Stepper` for a prospective
 * wizard/progress indicator and `Tab` for switching between peer views;
 * JourneyTimeline is read-only observation of a sequence, not process control
 * or navigation.
 *
 * @tag navigation
 * @tag display
 * @related Stepper
 * @related Tab
 * @related Accordion
 * @stability beta
 *
 * @example Vertical chronicle with inline detail
 * ```svelte
 * <script lang="ts">
 *   import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';
 *   const run: JourneyNode[] = [
 *     { id: 'readings', title: 'Meter readings', status: 'complete', meta: '3 Jun', segmentLabel: '2 days · validation' },
 *     { id: 'validate', title: 'Validation', status: 'complete', meta: '5 Jun', connector: 'dashed', segmentLabel: 'manual review' },
 *     { id: 'statement', title: 'Statements', status: 'active', meta: '6 Jun' },
 *     { id: 'dispatch', title: 'Dispatch', status: 'pending' }
 *   ];
 *   let focusId = $state('statement');
 * </script>
 *
 * <JourneyTimeline items={run} bind:focusId>
 *   {#snippet node(item)}
 *     <p>Details for {item.title}…</p>
 *   {/snippet}
 * </JourneyTimeline>
 * ```
 *
 * @example Horizontal lifecycle — detail renders in the shared panel
 * ```svelte
 * <JourneyTimeline items={phases} orientation="horizontal" onFocusChange={(id) => track(id)}>
 *   {#snippet node(item)}
 *     <PhaseSummary phase={item.id} />
 *   {/snippet}
 * </JourneyTimeline>
 * ```
 */
export interface JourneyTimelineProps
  extends Pick<JourneyTimelineVariants, 'orientation' | 'size'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The ordered journey nodes. */
  items: JourneyNode[];
  /** Layout direction. @default 'vertical' */
  orientation?: 'vertical' | 'horizontal';
  /** Marker + label scale. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Where the focused node's detail renders. `inline` expands in place inside
   * the rail; `panel` renders a stable readout — beside the rail on wide
   * viewports, docked to the viewport bottom on narrow ones. Horizontal
   * orientation always uses the panel and ignores `inline` (DEV warning).
   * @default 'inline' (vertical) / 'panel' (horizontal)
   * @summary Whether the focused step opens in place or in a side panel.
   */
  detail?: 'inline' | 'panel';
  /**
   * The focused node id. Supports `bind:focusId`. When omitted the component is
   * uncontrolled and falls back to `defaultFocusId`, then the first `active`
   * node, then the first focusable node.
   */
  focusId?: string;
  /** Initial focused node id in uncontrolled mode. Ignored once `focusId` is bound. */
  defaultFocusId?: string;
  /** Fires when the focused node changes (click or keyboard). */
  onFocusChange?: (id: string) => void;
  /** Renders the detail of the focused node. Receives the focused `JourneyNode`. */
  node?: Snippet<[JourneyNode]>;
  /**
   * Rich override for the meta rail — receives each `JourneyNode` and replaces
   * the plain `item.meta` text (e.g. planned + actual time with a Badge).
   */
  meta?: Snippet<[JourneyNode]>;
  /**
   * Custom content *inside* each status dot — a glyph, count or icon. The dot
   * keeps its status colour, shape and size contract (scale it via
   * `slotClasses.marker`, e.g. `size-5`). Markers stay decorative
   * (`aria-hidden`); the status is still announced through the hidden label.
   */
  marker?: Snippet<[JourneyNode]>;
  /**
   * End-of-row content beside each node's header — status badges, a help
   * affordance, quick actions. Renders *outside* the trigger button (a sibling
   * in the header row), so interactive elements are valid HTML and activating
   * them never moves the focused node. Right-aligned in vertical orientation,
   * appended to the label pill in horizontal.
   */
  trailing?: Snippet<[JourneyNode]>;
  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv() classes. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: base | rail | node | metaColumn | meta |
   * markerColumn | marker | connector | content | card | header | trigger |
   * trailing | labelGroup | title | subtitle | segment | detail | detailInner |
   * detailContent | panel
   */
  slotClasses?: Partial<Record<JourneyTimelineSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ JourneyTimeline: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as JourneyTimeline } from './JourneyTimeline.svelte';
export {
  type JourneyTimelineVariants,
  journeyTimelineVariants
} from './journey-timeline.variants';
