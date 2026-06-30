import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Placement } from './floating';
import { overlayStack } from './overlay-stack.svelte';

/**
 * Guide system — the headless engine. The full design lives in docs/GUIDE.md.
 *
 * @module
 */

const BROWSER = typeof window !== 'undefined';

/** Which link directions a topic supports (D3/§4). `both` when omitted. */
export type GuideDirection = 'to-guide' | 'to-ui' | 'both';

/** Metadata attached to a registered target via `target(id, meta)`. */
export interface GuideTopicMeta {
  /** Human-readable label, e.g. "Save button". */
  label?: string;
  /** Article id this topic links to (Direction A: Marker → Panel). */
  article?: string;
  /** Enabled link directions. @default 'both' */
  direction?: GuideDirection;
}

/** A single step of a guided tour. */
export interface GuideStep {
  /** `data-guide` id of the element to anchor to. Omit for a centered, target-less step. */
  target?: string;
  /** Step heading. */
  title?: string;
  /** Step body text. */
  body?: string;
  /** Preferred bubble placement relative to the target (Phase 6). */
  placement?: Placement;
  /** Whether the highlighted element stays interactive during a spotlight step (Phase 6). */
  interactive?: boolean;
  /**
   * How the step advances. `'user'` — the footer's Next button (and ArrowRight) work as
   * usual. `'action'` — learning-by-doing: Next is rendered disabled (`aria-disabled`,
   * with a screen-reader hint) and ArrowRight is inert; the app advances imperatively via
   * `controller.next()` once the user performed the real action (usually combined with
   * `interactive: true` so the spotlit target stays usable). Back and Skip stay available.
   * The gate lives purely in the `Guide` renderer — the engine's `next()` is never blocked.
   * @default 'user'
   */
  advance?: 'user' | 'action';
}

/**
 * Payload for {@link GuideTour.onStep} — fired when a step becomes the active one.
 */
export interface GuideStepEvent {
  /** The tour the step belongs to (handy for a shared handler keyed by `tour.id`). */
  tour: GuideTour;
  /** Zero-based index of the now-active step. */
  index: number;
  /** The now-active step. */
  step: GuideStep;
  /** Total number of steps in the tour. */
  total: number;
  /** How the step became active: initial `startTour`, or a `next`/`prev` navigation. */
  via: 'start' | 'next' | 'prev';
}

/**
 * Payload for {@link GuideTour.onComplete} and {@link GuideTour.onSkip} — a snapshot of
 * where the tour ended (e.g. the step a user skipped from, for drop-off analytics).
 */
export interface GuideEndEvent {
  /** The tour that ended. */
  tour: GuideTour;
  /** Index of the step that was active when the tour ended. */
  index: number;
  /** The step active at the end (`null` only for an empty tour, which never starts). */
  step: GuideStep | null;
  /** Total number of steps in the tour. */
  total: number;
}

/** A guided tour definition. */
export interface GuideTour {
  /** Unique id — used for "seen" persistence. */
  id: string;
  /** Ordered steps. */
  steps: GuideStep[];
  /** Skip automatically once completed/dismissed. @default true */
  once?: boolean;
  /**
   * Fired when a step becomes active — once on `startTour` (`via: 'start'`) and again on
   * every `next`/`prev`. This is where most onboarding analytics live (the step-by-step
   * funnel). A throw here is swallowed (DEV-warned) so analytics can't corrupt tour state.
   */
  onStep?: (event: GuideStepEvent) => void;
  /** Fired when the tour is completed — via `finish()`, or `next()` on the last step. */
  onComplete?: (event: GuideEndEvent) => void;
  /**
   * Fired when the tour is dismissed before completing — via `skip()`, Escape, or a foreign
   * overlay closing it. `event.index` is where the user dropped off. Deliberately **not** fired
   * by `stopTour()` (programmatic teardown such as a route change), which stays analytics-silent.
   */
  onSkip?: (event: GuideEndEvent) => void;
}

/**
 * Persistence boundary for "seen" ids. The default is localStorage-backed, but a
 * consumer can inject a server-state adapter. Kept deliberately tiny.
 */
export interface GuideStorageAdapter {
  /** Returns the persisted set of seen/completed ids. */
  load(): string[];
  /** Persists the full set of seen/completed ids. */
  save(ids: string[]): void;
}

/** Minimal slice of the overlay stack the controller depends on (injectable for tests). */
export interface GuideOverlayStackLike {
  register(id: string, close: () => void): () => void;
  isTop(id: string): boolean;
  /** Number of modal overlays currently open — drives the non-modal hide (§3.4). */
  readonly depth: number;
}

/** Options for {@link GuideController}; every dependency is injectable for testing. */
export interface GuideControllerOptions {
  /** Persistence adapter. @default localStorage-backed adapter */
  storage?: GuideStorageAdapter;
  /** Overlay stack to integrate with. @default the shared `overlayStack` singleton */
  overlayStack?: GuideOverlayStackLike;
  /** Force DEV-mode warnings on/off. @default `import.meta.env?.DEV ?? false` */
  dev?: boolean;
}

interface RegisteredTarget {
  element: HTMLElement;
  meta: GuideTopicMeta;
}

const SEEN_STORAGE_KEY = 'urbicon_guide_seen_v1';

/**
 * The default {@link GuideStorageAdapter}: localStorage-backed, SSR-safe, and
 * resilient to private-mode / quota failures (mirrors `persistent-state`).
 */
export function createLocalStorageAdapter(key: string = SEEN_STORAGE_KEY): GuideStorageAdapter {
  return {
    load() {
      if (!BROWSER) return [];
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed.filter((x): x is string => typeof x === 'string')
          : [];
      } catch {
        return [];
      }
    },
    save(ids) {
      if (!BROWSER) return;
      try {
        window.localStorage.setItem(key, JSON.stringify(ids));
      } catch {
        /* private mode / quota exceeded — persistence is best-effort */
      }
    }
  };
}

let tourIdCounter = 0;

/** Opaque id for overlay-stack registration. Never SSR-rendered, so no hydration risk. */
function nextOverlayId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `guide-tour-${++tourIdCounter}`;
}

/**
 * Escape a value for a `[data-guide="…"]` selector. Only ever called inside a
 * `typeof document` guard, where `CSS.escape` exists; the string fallback is a
 * belt-and-suspenders path for exotic DOM-less-but-CSS-less environments.
 */
function escapeAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}

const HIGHLIGHT_ATTR = 'data-guide-highlight';

/**
 * Headless engine for the Guide system — the UI-free state machine behind every
 * Guide surface (Panel, Marker, Mention, Hint, Tour).
 *
 * One instance per `GuideProvider` (Phase 2) — *not* a singleton, so multiple scopes
 * can coexist and tests get a fresh instance. Modeled on `OverlayStack` (class with
 * `$state` + `untrack`).
 *
 * Responsibilities:
 * - **Target registry** — maps `data-guide` ids to live DOM elements, fed by the
 *   `target()` attachment and resolved with a `[data-guide="…"]` DOM fallback.
 * - **Tour state machine** — `startTour` / `next` / `prev` / `skip` / `finish`.
 * - **Highlight** — `highlight` / `clearHighlight`, shared by tour steps and the
 *   bidirectional Mention→UI link (Direction B). Toggles a `data-guide-highlight`
 *   attribute; the additive ring itself is pure CSS (token-driven, D5).
 * - **Panel state** — `openPanel` / `closePanel` (the UI lands in Phase 3).
 * - **Persistence** — `hasSeen` / `markSeen` via an injectable {@link GuideStorageAdapter}.
 * - **Analytics hooks** — fires the active tour's `onStep` / `onComplete` / `onSkip`
 *   callbacks (the actual business value of a tour) defensively, so a throwing
 *   consumer callback can never corrupt tour state or leak the overlay entry.
 * - **overlay-stack integration** — a running tour registers itself so it pauses
 *   when a foreign modal (Dialog/Drawer) stacks on top.
 *
 * @stability beta
 */
export class GuideController {
  /** Live DOM targets, keyed by `data-guide` id. Reactive so resolution updates. */
  readonly #targets = new SvelteMap<string, RegisteredTarget>();
  /** Persisted "seen" ids. */
  readonly #seen: SvelteSet<string>;

  readonly #storage: GuideStorageAdapter;
  readonly #overlayStack: GuideOverlayStackLike;
  readonly #dev: boolean;

  // ── Tour state ──────────────────────────────────────────
  #activeTour = $state<GuideTour | null>(null);
  #stepIndex = $state(0);
  // $state so the `paused` getter stays reactive even if the id is ever rotated
  // independently of #activeTour (today they always change in lockstep).
  #tourOverlayId = $state<string | null>(null);
  #tourUnregister: (() => void) | null = null;

  // ── Highlight (shared by tour steps + Mention→UI, Direction B) ──
  #highlightedId = $state<string | null>(null);

  // ── Panel state (UI in Phase 3) ─────────────────────────
  #panelOpen = $state(false);
  #activeArticle = $state<string | null>(null);
  // Live GuidePanel DOM id, published by the mounted panel so a GuideMarker can
  // wire `aria-controls` (Direction A). `null` until a panel mounts (e.g. SSR).
  #panelId = $state<string | null>(null);

  constructor(options: GuideControllerOptions = {}) {
    this.#storage = options.storage ?? createLocalStorageAdapter();
    this.#overlayStack = options.overlayStack ?? overlayStack;
    // `import.meta.env?.DEV` is `boolean | undefined` (undefined outside Vite);
    // `?? false` keeps `#dev` a strict boolean and means non-Vite consumers
    // simply get no dev warnings (rather than a crash).
    this.#dev = options.dev ?? import.meta.env?.DEV ?? false;
    this.#seen = new SvelteSet(this.#storage.load());
  }

  // ─── Target registry ──────────────────────────────────────────────────────

  /**
   * Register a DOM element under a `data-guide` id. Returns an unregister function —
   * use it as the cleanup of the `target()` attachment.
   */
  registerTarget(id: string, element: HTMLElement, meta: GuideTopicMeta = {}): () => void {
    const existing = untrack(() => this.#targets.get(id));
    if (existing && existing.element !== element && this.#dev) {
      console.warn(
        `[Guide] duplicate target id "${id}" — the previously registered element is being overwritten.`
      );
    }
    this.#targets.set(id, { element, meta });
    return () => this.unregisterTarget(id, element);
  }

  /** Remove a target. No-op if `element` is not the currently registered one. */
  unregisterTarget(id: string, element: HTMLElement): void {
    const current = untrack(() => this.#targets.get(id));
    if (current && current.element === element) {
      this.#targets.delete(id);
      // Clear via the element directly: once removed from the registry it is no longer
      // resolvable (a purely programmatic target carries no data-guide attribute), so
      // clearHighlight()/resolveTarget() could not reach it to drop the attribute.
      if (untrack(() => this.#highlightedId) === id) {
        element.removeAttribute(HIGHLIGHT_ATTR);
        this.#highlightedId = null;
      }
    }
  }

  /**
   * Svelte attachment that registers the host element as a guide target.
   *
   * @example
   * ```svelte
   * <button {@attach guide.target('save', { label: 'Save', article: 'saving' })}>Save</button>
   * ```
   */
  target(id: string, meta?: GuideTopicMeta): Attachment {
    return (element) => this.registerTarget(id, element as HTMLElement, meta);
  }

  /**
   * Resolve a `data-guide` id to its element: the programmatic registry first, then
   * a `[data-guide="…"]` DOM lookup as fallback. Returns `null` if unresolved.
   */
  resolveTarget(id: string): HTMLElement | null {
    const registered = this.#targets.get(id);
    if (registered) return registered.element;
    if (typeof document !== 'undefined') {
      return document.querySelector<HTMLElement>(`[data-guide="${escapeAttr(id)}"]`);
    }
    return null;
  }

  /** Metadata for a registered target, if any. */
  getTopicMeta(id: string): GuideTopicMeta | undefined {
    return this.#targets.get(id)?.meta;
  }

  /**
   * Effective link direction for a topic (§4.3). A surface-level `override` wins
   * over the topic's registered `direction`, which in turn defaults to `'both'`.
   * Surfaces derive their gating from this: a `GuideMarker` (UI→Guide) is live when
   * the result is not `'to-ui'`; a `GuideMention` (Guide→UI) when it is not `'to-guide'`.
   */
  resolveDirection(id: string, override?: GuideDirection): GuideDirection {
    return override ?? this.#targets.get(id)?.meta.direction ?? 'both';
  }

  // ─── Tour state machine ───────────────────────────────────────────────────

  get activeTour(): GuideTour | null {
    return this.#activeTour;
  }

  get isTourActive(): boolean {
    return this.#activeTour !== null;
  }

  get stepIndex(): number {
    return this.#stepIndex;
  }

  get currentStep(): GuideStep | null {
    return this.#activeTour?.steps[this.#stepIndex] ?? null;
  }

  get stepCount(): number {
    return this.#activeTour?.steps.length ?? 0;
  }

  get isFirstStep(): boolean {
    return this.#stepIndex === 0;
  }

  get isLastStep(): boolean {
    return this.#activeTour ? this.#stepIndex === this.#activeTour.steps.length - 1 : false;
  }

  /**
   * `true` when a foreign overlay (Dialog/Drawer) sits above the running tour — the
   * UI should hide/dim while paused. Derives from `overlayStack.isTop`, so it reacts
   * automatically as foreign overlays open and close.
   */
  get paused(): boolean {
    if (!this.#activeTour || this.#tourOverlayId === null) return false;
    return !this.#overlayStack.isTop(this.#tourOverlayId);
  }

  /**
   * Number of modal overlays currently stacked (Dialog/Drawer/Sidebar + an active
   * guided tour). Non-modal surfaces — notably `GuideHint` — hide while this is `> 0`,
   * the top-layer discipline from §3.4. Reactive via the injected overlay stack.
   */
  get overlayDepth(): number {
    return this.#overlayStack.depth;
  }

  /**
   * Start a tour. Returns `false` (and does nothing) when the tour was already seen
   * (and `once !== false`) or has no steps.
   */
  startTour(tour: GuideTour): boolean {
    if (tour.once !== false && this.hasSeen(tour.id)) return false;
    if (tour.steps.length === 0) {
      if (this.#dev) console.warn(`[Guide] tour "${tour.id}" has no steps — not started.`);
      return false;
    }
    // Tear down any tour already running so its overlay-stack entry never leaks.
    this.#teardownTour();
    this.#activeTour = tour;
    this.#stepIndex = 0;
    this.#tourOverlayId = nextOverlayId();
    this.#tourUnregister = this.#overlayStack.register(this.#tourOverlayId, () => this.skip());
    this.#applyStepHighlight();
    this.#emitStep('start');
    return true;
  }

  /** Advance to the next step, or finish the tour if on the last step. */
  next(): void {
    if (!this.#activeTour) return;
    if (this.isLastStep) {
      this.finish();
      return;
    }
    this.#stepIndex += 1;
    this.#applyStepHighlight();
    this.#emitStep('next');
  }

  /** Go back one step. No-op on the first step. */
  prev(): void {
    if (!this.#activeTour || this.isFirstStep) return;
    this.#stepIndex -= 1;
    this.#applyStepHighlight();
    this.#emitStep('prev');
  }

  /** Dismiss the tour without completing it — marks it seen, fires `onSkip`. */
  skip(): void {
    const tour = this.#activeTour;
    if (!tour) return;
    const event = this.#endEvent(tour);
    this.#endTour();
    this.#emit(tour.onSkip, event);
  }

  /** Complete the tour — marks it seen, fires `onComplete`. */
  finish(): void {
    const tour = this.#activeTour;
    if (!tour) return;
    const event = this.#endEvent(tour);
    this.#endTour();
    this.#emit(tour.onComplete, event);
  }

  /**
   * Tear a running tour down **without** marking it seen — for programmatic teardown such as
   * the `Guide` renderer unmounting mid-tour, a route change, or logout. Unlike `skip`/`finish`
   * (user-driven, "never nag" → seen), a stopped tour can surface again. Releases the
   * overlay-stack entry and clears the highlight ring; no-op if no tour is active.
   */
  stopTour(): void {
    if (this.#activeTour) this.#teardownTour();
  }

  /**
   * Re-apply the current step's highlight + scroll — for a surface that detected its
   * target resolving *after* the step began (a lazily rendered `data-guide` element) or
   * vanishing mid-step (removed / swapped by a route change). On step change the engine
   * highlights once; if the element wasn't in the DOM yet the ring couldn't land, so the
   * surface calls this once it observes the target appear (or disappear → ring clears).
   * No-op when no tour is active.
   */
  reapplyStepHighlight(): void {
    if (this.#activeTour) this.#applyStepHighlight();
  }

  #endTour(): void {
    const tour = this.#activeTour;
    this.#teardownTour();
    // Both skip and finish mark the tour seen — "helpful, not intrusive": never nag.
    // (The skip/complete distinction itself lives in skip()/finish(), which fire the
    // matching analytics callback around this shared teardown.)
    if (tour && tour.once !== false) this.markSeen(tour.id);
  }

  /** Reset all tour state and release the overlay-stack registration. No persistence. */
  #teardownTour(): void {
    this.clearHighlight();
    this.#tourUnregister?.();
    this.#tourUnregister = null;
    this.#tourOverlayId = null;
    this.#activeTour = null;
    this.#stepIndex = 0;
  }

  // ─── Analytics hooks (onStep / onComplete / onSkip) ───────────────────────

  /** Snapshot of the end-of-tour state for an `onComplete`/`onSkip` payload. */
  #endEvent(tour: GuideTour): GuideEndEvent {
    return { tour, index: this.#stepIndex, step: this.currentStep, total: tour.steps.length };
  }

  /** Fire the active tour's `onStep` for the current step (after highlight is applied). */
  #emitStep(via: GuideStepEvent['via']): void {
    const tour = this.#activeTour;
    const step = this.currentStep;
    if (!tour || !step) return;
    this.#emit(tour.onStep, { tour, index: this.#stepIndex, step, total: tour.steps.length, via });
  }

  /**
   * Invoke a consumer-supplied tour callback, swallowing throws (DEV-warned) so analytics
   * code can never corrupt tour state or leak the overlay-stack entry. Mirrors the
   * best-effort posture of the localStorage adapter.
   */
  #emit<E>(fn: ((event: E) => void) | undefined, event: E): void {
    if (!fn) return;
    try {
      fn(event);
    } catch (err) {
      if (this.#dev) console.warn('[Guide] a tour analytics callback threw:', err);
    }
  }

  #applyStepHighlight(): void {
    const step = this.currentStep;
    if (!step) return;
    if (!step.target) {
      this.clearHighlight();
      return;
    }
    if (this.resolveTarget(step.target)) {
      // Scroll the step target into view before the bubble anchors to it (§6.1/6.2).
      // Unlike Direction-B hover (which never scrolls), a tour drives the viewport —
      // the scroll is reduced-motion-aware inside `highlight`.
      this.highlight(step.target, { scroll: true });
    } else {
      this.clearHighlight();
      if (this.#dev) {
        console.warn(
          `[Guide] tour "${this.#activeTour?.id}" step ${this.#stepIndex}: target "${step.target}" not found in DOM.`
        );
      }
    }
  }

  // ─── Highlight (Direction B + tour steps) ─────────────────────────────────

  get highlightedId(): string | null {
    return this.#highlightedId;
  }

  /**
   * Highlight a target by id — toggles a `data-guide-highlight` attribute the CSS
   * ring hooks into (additive `outline`, never a scrim — D5). No-op + DEV warning
   * if the target is unresolved.
   *
   * @param options.scroll Scroll the target into view (Direction B click — D5).
   *   Honors `prefers-reduced-motion` (instant jump instead of smooth scroll).
   */
  highlight(id: string, options?: { scroll?: boolean }): void {
    const el = this.resolveTarget(id);
    if (!el) {
      if (this.#dev) console.warn(`[Guide] highlight target "${id}" not found in DOM.`);
      return;
    }
    if (this.#highlightedId && this.#highlightedId !== id) {
      this.resolveTarget(this.#highlightedId)?.removeAttribute(HIGHLIGHT_ATTR);
    }
    this.#highlightedId = id;
    el.setAttribute(HIGHLIGHT_ATTR, '');
    if (options?.scroll) this.#scrollIntoView(el);
  }

  /** Scroll an element into view, reduced-motion-aware. DOM-guarded for SSR/tests. */
  #scrollIntoView(el: HTMLElement): void {
    if (typeof el.scrollIntoView !== 'function') return;
    el.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: this.#prefersReducedMotion() ? 'auto' : 'smooth'
    });
  }

  /** One-shot reduced-motion read. SSR/test-safe (no `matchMedia` → not reduced). */
  #prefersReducedMotion(): boolean {
    if (!BROWSER || typeof window.matchMedia !== 'function') return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  /** Clear the current highlight. */
  clearHighlight(): void {
    if (this.#highlightedId) {
      this.resolveTarget(this.#highlightedId)?.removeAttribute(HIGHLIGHT_ATTR);
    }
    this.#highlightedId = null;
  }

  // ─── Panel state (UI in Phase 3) ──────────────────────────────────────────

  get panelOpen(): boolean {
    return this.#panelOpen;
  }

  get activeArticle(): string | null {
    return this.#activeArticle;
  }

  /** Open the help panel, optionally jumping to a specific article (Direction A). */
  openPanel(article?: string): void {
    this.#panelOpen = true;
    if (article !== undefined) this.#activeArticle = article;
  }

  /** Close the help panel. */
  closePanel(): void {
    this.#panelOpen = false;
  }

  /** Set the active article without changing the panel's open state. */
  setArticle(article: string | null): void {
    this.#activeArticle = article;
  }

  /** Live `GuidePanel` DOM id, or `null` when no panel is mounted. */
  get panelId(): string | null {
    return this.#panelId;
  }

  /**
   * Publish the mounted `GuidePanel`'s DOM id so `GuideMarker`s can target it via
   * `aria-controls`. Returns a cleanup that releases it. One panel per provider is
   * the norm; the most recent registration wins.
   */
  registerPanel(id: string): () => void {
    this.#panelId = id;
    return () => {
      if (untrack(() => this.#panelId) === id) this.#panelId = null;
    };
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /** Whether an id (tour, hint, …) has been seen. */
  hasSeen(id: string): boolean {
    return this.#seen.has(id);
  }

  /** Mark an id as seen and persist. */
  markSeen(id: string): void {
    if (this.#seen.has(id)) return;
    this.#seen.add(id);
    this.#storage.save([...this.#seen]);
  }

  /** Forget one id, or all of them when called without an argument. */
  resetSeen(id?: string): void {
    if (id === undefined) this.#seen.clear();
    else this.#seen.delete(id);
    this.#storage.save([...this.#seen]);
  }

  /** Snapshot of all seen ids. */
  get seenIds(): string[] {
    return [...this.#seen];
  }
}
