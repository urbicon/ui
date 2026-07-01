import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { JourneyTimelineSlots, JourneyTimelineVariants } from './journey-timeline.variants';

/** Lifecycle status of a journey node — drives marker colour and glyph. */
export type JourneyStatus = 'complete' | 'active' | 'pending' | 'blocked' | 'skipped';

/** A single node (waypoint) on a {@link JourneyTimelineProps | JourneyTimeline}. */
export interface JourneyNode {
  /** Stable unique identifier — used as the focus key and for `{#each}` keying. */
  id: string;
  /** Node title, always visible next to the marker. */
  title: string;
  /**
   * Lifecycle status. Maps to a semantic marker colour + glyph:
   * `complete` (success ✓), `active` (primary ◉), `pending` (empty circle),
   * `blocked` (danger ⊘), `skipped` (muted −).
   */
  status: JourneyStatus;
  /** Short status line shown below the title while collapsed. */
  subtitle?: string;
  /**
   * When `false`, the node is a pure waypoint: it renders a marker + labels but
   * cannot receive focus, does not expand, and is skipped by keyboard navigation.
   * @default true
   */
  focusable?: boolean;
}

/**
 * @description Connected timeline whose markers *are* the progress indicator and
 * where exactly one focusable node expands to reveal rich per-step detail (the
 * "journey" / travel-log pattern). Data-driven via `items`; the focused node's
 * body is rendered through the `node` snippet. For a compact progress indicator
 * without a detail container use `Stepper`; for peer views without sequence use
 * `Tab`.
 *
 * @tag navigation
 * @tag display
 * @related Stepper
 * @related Tab
 * @related Accordion
 * @stability beta
 *
 * @example Vertical journey with inline detail
 * ```svelte
 * <script lang="ts">
 *   import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';
 *   const stages: JourneyNode[] = [
 *     { id: 'draft', title: 'Draft', status: 'complete', subtitle: 'Sent 3 Jun' },
 *     { id: 'review', title: 'Review', status: 'active', subtitle: 'In progress' },
 *     { id: 'approve', title: 'Approval', status: 'pending' }
 *   ];
 *   let focusId = $state('review');
 * </script>
 *
 * <JourneyTimeline items={stages} bind:focusId>
 *   {#snippet node(item)}
 *     <p>Details for {item.title}…</p>
 *   {/snippet}
 * </JourneyTimeline>
 * ```
 *
 * @example Horizontal lifecycle with a shared detail panel + scroll-spy off
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
  /** Layout direction. Vertical expands detail inline; horizontal into a panel below the rail. @default 'vertical' */
  orientation?: 'vertical' | 'horizontal';
  /** Marker + label scale. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /**
   * The expanded (focused) node id. Supports `bind:focusId`. When omitted the
   * component is uncontrolled and falls back to `defaultFocusId`, then the first
   * `active` node, then the first focusable node.
   */
  focusId?: string;
  /** Initial focused node id in uncontrolled mode. Ignored once `focusId` is bound. */
  defaultFocusId?: string;
  /**
   * When `true`, the focus follows the node scrolled to the top of the viewport
   * (the travel-log feel), driven by an IntersectionObserver. Reduced-motion safe.
   * @default false
   */
  scrollSpy?: boolean;
  /** Fires when the focused node changes (click, keyboard, or scroll-spy). */
  onFocusChange?: (id: string) => void;
  /** Renders the body of the focused node. Receives the focused `JourneyNode`. */
  node?: Snippet<[JourneyNode]>;
  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv() classes. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: base | rail | node | trigger | marker |
   * connectorColumn | connector | labelGroup | title | subtitle | body | detail |
   * detailInner | detailContent | panel
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
