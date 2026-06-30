import type { Snippet } from 'svelte';
import type {
  GuideController,
  GuideDirection,
  GuideStorageAdapter,
  GuideTour,
  Placement
} from '$lib/utils';
import type {
  GuideArticleSlots,
  GuideBeaconSlots,
  GuideBeaconVariants,
  GuideHintSlots,
  GuideMarkerSlots,
  GuideMarkerVariants,
  GuideMentionSlots,
  GuidePanelSlots,
  GuidePanelVariants,
  GuideRefSlots,
  GuideTourSlots
} from './guide.variants';

/**
 * @description Root provider for the Guide help system. Instantiates a `GuideController`
 * and shares it via context with all Guide surfaces (Panel, Marker, Mention, Hint, Tour).
 * Place once near the app root. The context is optional — a surface used without a provider
 * renders inert rather than throwing.
 * @tag overlay
 * @tag feedback
 * @related GuidePanel
 * @related GuideMarker
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <script>
 *   import { GuideProvider, GuideController } from '@urbicon-ui/blocks';
 *   const guide = new GuideController();
 * </script>
 *
 * <GuideProvider controller={guide}>
 *   <App />
 * </GuideProvider>
 *
 * <button onclick={() => guide.startTour(welcomeTour)}>Take the tour</button>
 * ```
 */
export interface GuideProviderProps {
  /** Persistence adapter for "seen" state (tours/hints). @default localStorage-backed adapter */
  storage?: GuideStorageAdapter;
  /**
   * Supply a pre-created `GuideController` for programmatic access from outside the provider
   * (start tours, open the panel, query `hasSeen`). When omitted, the provider creates one
   * internally and shares it via context. When supplied, `storage` is ignored.
   */
  controller?: GuideController;
  /** App subtree wired to the Guide context. */
  children: Snippet;
}

/**
 * @description Non-modal help panel for the Guide system. Slides in (default from the right)
 * without a backdrop or focus trap, so the app stays interactive behind it — this is what lets
 * a `GuideMention` highlight a UI element while the panel is open (D1). Visibility is driven by
 * the controller (`openPanel`/`closePanel`), not a local prop. Place `GuideArticle` children
 * inside: the panel shows a list of them, or the active article's content with a back button.
 * @tag overlay
 * @tag navigation
 * @related GuideProvider
 * @related GuideArticle
 * @related GuideMarker
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <GuidePanel title="Help">
 *   <GuideArticle id="saving" title="Saving your work">
 *     <p>Use the Save button to persist your changes.</p>
 *   </GuideArticle>
 * </GuidePanel>
 * ```
 */
export interface GuidePanelProps {
  /**
   * Stable DOM id for the panel root. `GuideMarker`s reference it via `aria-controls`.
   * @default auto-generated (`guide-panel-<id>`)
   */
  id?: string;
  /** Side the panel docks to. @default 'right' */
  placement?: GuidePanelVariants['placement'];
  /** Panel width. @default 'md' */
  size?: GuidePanelVariants['size'];
  /** Heading shown when no article is open. @default i18n `guide.openHelp` */
  title?: string;
  /**
   * Render a filter input above the article index that matches article titles
   * (case-insensitive). Off by default. Pairs with article grouping — filtered
   * results keep their section headers and empty sections disappear.
   * @default false
   */
  searchable?: boolean;
  /** Close the panel when Escape is pressed. @default true */
  closeOnEscape?: boolean;
  /** Optional footer content. */
  footer?: Snippet;
  /** `GuideArticle` children and any custom content. */
  children?: Snippet;
  /** Additional classes on the panel root. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuidePanelSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuidePanel: {...} }}>`. */
  preset?: string;
}

/**
 * @description A single help article inside a `GuidePanel`. Registers itself in the panel's
 * list (by `title`) and renders its content only when it is the active article
 * (`controller.activeArticle === id`). Use `GuideMention` inside to link back to UI elements.
 * @tag display
 * @related GuidePanel
 * @related GuideMention
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <GuideArticle id="seats" title="Seats & billing">
 *   <p>Each <GuideMention for="seat-count">seat</GuideMention> is one team member.</p>
 * </GuideArticle>
 * ```
 */
export interface GuideArticleProps {
  /** Unique article id — referenced by `GuideMarker` and `openPanel(id)`. */
  id: string;
  /** Title shown in the panel list and header. */
  title: string;
  /**
   * Optional section this article belongs to in the panel index. Articles that
   * share a `group` are rendered under one section header (sections appear in
   * the order their first article is defined); articles without a `group` stay
   * in an ungrouped block. When no article sets a `group`, the index is a flat
   * list — unchanged from today.
   */
  group?: string;
  /** Article body. */
  children?: Snippet;
  /** Additional classes on the article root. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuideArticleSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuideArticle: {...} }}>`. */
  preset?: string;
}

/**
 * @description Direction A of the bidirectional link (UI → Guide): a discreet "ⓘ" trigger
 * that sits on a UI element and opens the `GuidePanel` at the matching article. A real
 * `<button>` with `aria-controls`/`aria-expanded` — deliberately *not* a status `Badge`
 * (which is a non-interactive label, not a trigger). Renders inert without a `GuideProvider`,
 * or when the topic's direction excludes UI→Guide (`'to-ui'`).
 * @tag action
 * @tag feedback
 * @related GuidePanel
 * @related GuideMention
 * @related GuideProvider
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <h3>Billing <GuideMarker for="billing" article="billing-help" /></h3>
 * ```
 */
export interface GuideMarkerProps {
  /**
   * `data-guide` topic id this marker explains. Resolves the article (from topic meta) and
   * the link direction. Optional (unlike `GuideMention.for`) because `article` can stand
   * alone — supply one of the two. With neither, the marker opens the panel index.
   */
  for?: string;
  /** Article to open in the panel. Overrides the topic meta's `article`; falls back to `for`. */
  article?: string;
  /**
   * Override the topic's link direction. The marker is live unless this resolves to `'to-ui'`.
   * @default the topic's `direction`, or `'both'`
   */
  direction?: GuideDirection;
  /**
   * Accessible label for the icon button.
   * @default i18n `guide.infoAbout` (with the topic's label) or `guide.info`
   */
  label?: string;
  /** Icon size. @default 'md' */
  size?: GuideMarkerVariants['size'];
  /** Custom trigger content, replacing the default "ⓘ" icon. */
  children?: Snippet;
  /** Additional classes on the marker button. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuideMarkerSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuideMarker: {...} }}>`. */
  preset?: string;
}

/**
 * @description Direction B of the bidirectional link (Guide → UI): an inline reference inside a
 * `GuideArticle` that highlights the matching UI element on hover *and* focus (keyboard parity).
 * Additive `outline` ring, no scrim, no layout shift (D5); clicking also scrolls the element into
 * view (reduced-motion-aware). A real `<button>`; degrades to plain inline text without a
 * `GuideProvider` or when the topic's direction excludes Guide→UI (`'to-guide'`).
 * @tag navigation
 * @related GuideArticle
 * @related GuideMarker
 * @related GuidePanel
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <p>Click the <GuideMention for="save-button">Save button</GuideMention> to persist.</p>
 * ```
 */
export interface GuideMentionProps {
  /**
   * `data-guide` id of the UI element to highlight. Required (unlike `GuideMarker.for`):
   * a mention with no target has nothing to highlight.
   */
  for: string;
  /**
   * Override the topic's link direction. The mention is interactive unless this resolves to
   * `'to-guide'`.
   * @default the topic's `direction`, or `'both'`
   */
  direction?: GuideDirection;
  /** Scroll the target into view on click (reduced-motion-aware). @default true */
  scroll?: boolean;
  /** The mention text. */
  children?: Snippet;
  /** Additional classes on the mention. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuideMentionSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuideMention: {...} }}>`. */
  preset?: string;
}

/**
 * @description An inline article→article link inside a `GuideArticle` body — the
 * help-internal analogue of `GuideMention` (which links out to a UI element). A real
 * `<button>` that navigates the open `GuidePanel` to the target article via the
 * controller (`setArticle`). Degrades to plain inline text without a `GuideProvider`,
 * outside a `GuidePanel`, or for an unknown `article` id; keyboard/focus parity with
 * `GuideMention`.
 * @tag navigation
 * @related GuideArticle
 * @related GuidePanel
 * @related GuideMention
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <GuideArticle id="cost-pot" title="Cost pot">
 *   <p>The pot is split by the <GuideRef article="splitting">splitting method</GuideRef>.</p>
 * </GuideArticle>
 * ```
 */
export interface GuideRefProps {
  /** Id of the `GuideArticle` to navigate to. Inert (plain text) for an unknown id. */
  article: string;
  /** The link text. */
  children?: Snippet;
  /** Additional classes on the ref. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuideRefSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuideRef: {...} }}>`. */
  preset?: string;
}

/**
 * @description A contextual, non-blocking hint anchored to a `data-guide` element via
 * `floating.ts` (flip/shift/arrow), rendered in the native popover top-layer. Waits at the
 * right element rather than interrupting: shows on mount (or when `open` for `trigger="manual"`),
 * persists "seen" so it appears once (`once`), and steps aside while a foreign modal or guided
 * tour is open. Dismissable; announces itself via `aria-live`. Renders inert without a provider.
 * @tag overlay
 * @tag feedback
 * @related GuideProvider
 * @related GuideMarker
 * @related GuidePanel
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <button data-guide="export">Export</button>
 *
 * <GuideHint for="export" title="New: scheduled exports">
 *   You can now export on a schedule from here.
 * </GuideHint>
 * ```
 */
export interface GuideHintProps {
  /** `data-guide` id of the element to anchor to. Required — a hint with no anchor has nothing to point at. */
  for: string;
  /**
   * Persistence key for the "seen once" state, decoupled from the anchor (this is *not* a DOM id —
   * the popover gets none). Override only to track two hints on one element independently, or to keep
   * a stable key across a renamed anchor.
   * @default the `for` id
   */
  seenId?: string;
  /**
   * Manual visibility for `trigger="manual"` (the on-route / on-condition strategy). Ignored for
   * `trigger="mount"`. Re-raising it to `true` after a dismiss re-surfaces the hint (subject to `once`).
   * @default false
   */
  open?: boolean;
  /**
   * When the hint may appear: `'mount'` shows it as soon as it mounts; `'manual'` waits for
   * `open` to become `true` (the consumer's route/condition logic).
   * @default 'mount'
   */
  trigger?: 'mount' | 'manual';
  /**
   * When dismissed, persist a "seen" flag (via the controller's StorageAdapter) so the hint
   * does not reappear on later mounts. Mirrors the tour's "mark seen on end" rule — a hint
   * shown but never dismissed may show again. Set `false` to always show.
   * @default true
   */
  once?: boolean;
  /** Preferred placement relative to the target. @default 'bottom' */
  placement?: Placement;
  /** Render the pointer arrow. @default true */
  arrow?: boolean;
  /** Optional bold heading above the body. */
  title?: string;
  /** Hint body. */
  children?: Snippet;
  /** Called when the hint is dismissed (close button or Escape). */
  onDismiss?: () => void;
  /** Additional classes on the hint root. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuideHintSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuideHint: {...} }}>`. */
  preset?: string;
}

/**
 * @description The guided-tour renderer — the deliberately opt-in, intrusive Guide surface
 * (§6, low priority). Renders the active tour the controller drives (`startTour`/`next`/`prev`/
 * `skip`/`finish`): a spotlight that dims everything but a cut-out hole over the current step's
 * target (the one *subtractive* Guide treatment, D5) plus an anchored bubble with the step
 * title, body, dot progress, and Back / Next / Skip controls. Mount once inside `GuideProvider`;
 * it renders nothing until a tour starts. Top-layer (native popover), so it clears app stacking
 * contexts; it steps aside (pauses) when a foreign modal stacks above it. A step with no `target`
 * renders centered over a full scrim. Renders inert without a `GuideProvider`.
 * @tag overlay
 * @tag feedback
 * @related GuideProvider
 * @related GuideBeacon
 * @related GuideHint
 * @stability beta
 *
 * @example
 * ```svelte
 * <script>
 *   import { GuideProvider, Guide, GuideController } from '@urbicon-ui/blocks';
 *   const guide = new GuideController();
 *   const tour = {
 *     id: 'welcome',
 *     steps: [
 *       { target: 'save-button', title: 'Save', body: 'Persist your changes here.' },
 *       { target: 'filter-control', title: 'Filter', body: 'Narrow the list.', interactive: true }
 *     ]
 *   };
 * </script>
 *
 * <GuideProvider controller={guide}>
 *   <Guide />
 *   <button onclick={() => guide.startTour(tour)}>Take the tour</button>
 * </GuideProvider>
 * ```
 */
export interface GuideProps {
  /**
   * Padding in px between the step target and the spotlight hole edge. Also frames the
   * additive highlight ring the engine paints on the target. @default 8
   */
  padding?: number;
  /**
   * Spotlight hole corner radius in px. When omitted, it follows the target's own
   * border-radius (plus `padding`), clamped to the hole size. Set a number to force it.
   */
  radius?: number;
  /** Render the bubble's pointer arrow on anchored steps. @default true */
  arrow?: boolean;
  /** Preferred bubble placement when a step omits its own `placement`. @default 'bottom' */
  placement?: Placement;
  /** Additional classes on the bubble. */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Beyond the tour's own `tv()` slots, `skip` / `prev` / `next`
   * forward to the footer's nested `<Button>`s (which own their internal markup).
   */
  slotClasses?: Partial<Record<GuideTourSlots | 'skip' | 'prev' | 'next', string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ Guide: {...} }}>`. */
  preset?: string;
}

/**
 * @description A waiting, pulsing hotspot that invites the user into an opt-in guided tour (§6.3)
 * — the gentlest tour entry point, the opposite of an auto-starting tour. A real `<button>` the
 * consumer positions (inline, or absolutely over a feature corner); on activation it starts the
 * given `tour` and/or calls `onActivate`. Hides itself once that tour has been seen. The pulse
 * halts under `prefers-reduced-motion` (static dot). Renders inert without a `GuideProvider`.
 * @tag feedback
 * @tag action
 * @related Guide
 * @related GuideProvider
 * @related GuideHint
 * @stability beta
 * @standalone
 *
 * @example
 * ```svelte
 * <span class="relative">
 *   New feature
 *   <GuideBeacon class="absolute -right-3 -top-1" {tour} />
 * </span>
 * ```
 */
export interface GuideBeaconProps {
  /**
   * The tour to start when the beacon is activated. When set, the beacon also hides itself once
   * the tour has been seen (subject to `once`). Omit to drive everything from `onActivate`.
   */
  tour?: GuideTour;
  /** Called on activation (click / Enter / Space), after `tour` is started when both are set. */
  onActivate?: () => void;
  /**
   * Hide the beacon once its `tour` has been seen (and while that tour is running). Needs `tour`.
   * @default true
   */
  once?: boolean;
  /** Visual size of the hotspot. @default 'md' */
  size?: GuideBeaconVariants['size'];
  /**
   * Accessible label for the button.
   * @default i18n `guide.startTour`
   */
  label?: string;
  /** Additional classes on the beacon button (use for absolute positioning over a target). */
  class?: string;
  /** Strip all default styles. @default false */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<GuideBeaconSlots, string>>;
  /** Apply a named preset registered via `<BlocksProvider presets={{ GuideBeacon: {...} }}>`. */
  preset?: string;
}

export { default as Guide } from './Guide.svelte';
export { default as GuideArticle } from './GuideArticle.svelte';
export { default as GuideBeacon } from './GuideBeacon.svelte';
export { default as GuideHint } from './GuideHint.svelte';
export { default as GuideMarker } from './GuideMarker.svelte';
export { default as GuideMention } from './GuideMention.svelte';
export { default as GuidePanel } from './GuidePanel.svelte';
export { default as GuideProvider } from './GuideProvider.svelte';
export { default as GuideRef } from './GuideRef.svelte';
export {
  type GuideArticleVariants,
  type GuideBeaconVariants,
  type GuideHintVariants,
  type GuideMarkerVariants,
  type GuideMentionVariants,
  type GuidePanelVariants,
  type GuideRefVariants,
  type GuideTourVariants,
  guideArticleVariants,
  guideBeaconVariants,
  guideHintVariants,
  guideMarkerVariants,
  guideMentionVariants,
  guidePanelVariants,
  guideRefVariants,
  guideTourVariants
} from './guide.variants';
// Note: getGuideContext/setGuideContext are intentionally NOT re-exported here.
// They are an internal wiring seam — surfaces import them directly from
// './guide.context' (mirrors Tab/Icon, which keep their context helpers private).
