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
  /**
   * Optional route this step lives on — declarative cross-route touring. When set and different
   * from the current location, the controller calls its injected `navigate` hook to go there
   * **before** the spotlight, then re-anchors once the target appears on the new page (via the
   * surface's existing `reapplyStepHighlight`). Such a tour-internal navigation keeps the tour
   * running; a *foreign* navigation (the user leaving on their own) still stops it. Compared
   * against `window.location.pathname` by default, so use a normalized path (no query/hash);
   * inject a {@link GuideControllerOptions.navigationSource} for a custom router or base path.
   * A `route` step with no `navigate` hook wired logs a DEV warning and stays put (no crash).
   * @see GuideControllerOptions.navigate
   */
  route?: string;
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

/**
 * Source of the current route and navigation notifications the controller needs for cross-route
 * tours (injectable for tests and custom routers). The default {@link createBrowserNavigationSource}
 * reads `window.location.pathname` and subscribes via the Navigation API, falling back to `popstate`.
 */
export interface GuideNavigationSource {
  /** The current path, compared against a step's `route` (e.g. `"/expenses"`). `''` on the server. */
  current(): string;
  /**
   * Subscribe to navigations; `onNavigate` receives the new path. Returns an unsubscribe. The
   * controller subscribes only while a tour with at least one `route` step is active, so a tour
   * that never declares a route observes no navigation (preserving the manual-`goto` recipe).
   */
  subscribe(onNavigate: (path: string) => void): () => void;
}

/** Options for {@link GuideController}; every dependency is injectable for testing. */
export interface GuideControllerOptions {
  /** Persistence adapter. @default localStorage-backed adapter */
  storage?: GuideStorageAdapter;
  /** Overlay stack to integrate with. @default the shared `overlayStack` singleton */
  overlayStack?: GuideOverlayStackLike;
  /**
   * Navigation hook for declarative cross-route tours. When a step's `route` differs from the
   * current location, the controller calls this to navigate there before spotlighting the step.
   * Framework-agnostic by injection — a SvelteKit consumer wires `(route) => goto(route)`. May be
   * sync or async; a thrown/rejected navigation is swallowed (DEV-warned). A `route` step with no
   * hook wired logs a DEV warning and stays on the current route (no crash). @default undefined
   */
  navigate?: (route: string) => void | Promise<void>;
  /**
   * Source for the current path + navigation events, used to decide whether a step's `route`
   * needs navigating and to tell a tour-internal navigation from a foreign one (which stops the
   * tour). @default a browser source reading `window.location.pathname` and listening via the
   * Navigation API. Where that API is unavailable it falls back to `popstate` (back/forward only,
   * not `pushState`), so a foreign *forward* navigation may go unobserved — inject a router-backed
   * source (SvelteKit: `afterNavigate` + the `page` store; see docs/GUIDE.md §9) for reliable
   * detection, or to handle a configured base path / custom router.
   */
  navigationSource?: GuideNavigationSource;
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

/** Minimal slice of the Navigation API we feature-detect (avoids depending on lib DOM types). */
interface NavigateEventLike {
  readonly destination?: { readonly url?: string };
  readonly downloadRequest?: string | null;
}
interface NavigationLike {
  addEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
  removeEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
}

/**
 * The default {@link GuideNavigationSource}: reads `window.location.pathname` and observes SPA
 * navigations through the Navigation API when available — catching link clicks, programmatic
 * navigation (`goto`), and back/forward — falling back to `popstate` (back/forward only) where it
 * is not. SSR-safe: `current()` returns `''` and `subscribe()` is a no-op without a `window`.
 */
export function createBrowserNavigationSource(): GuideNavigationSource {
  let warnedFallback = false;
  return {
    current() {
      return BROWSER ? window.location.pathname : '';
    },
    subscribe(onNavigate) {
      if (!BROWSER) return () => {};
      const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
      if (nav && typeof nav.addEventListener === 'function') {
        const handler = (event: NavigateEventLike) => {
          if (event.downloadRequest != null) return; // a download is not a route change
          const url = event.destination?.url;
          if (typeof url !== 'string') return;
          let path: string;
          try {
            path = new URL(url).pathname;
          } catch {
            return; // opaque/cross-origin destination — not a same-app route
          }
          onNavigate(path);
        };
        nav.addEventListener('navigate', handler);
        return () => nav.removeEventListener('navigate', handler);
      }
      // `popstate` only catches back/forward, not `pushState` (a SvelteKit `goto` / intercepted
      // link click), so a foreign *forward* navigation goes unobserved and the tour won't stop.
      // Warn once so a degraded-detection browser is diagnosable; inject a router-backed
      // navigationSource for reliable detection (docs/GUIDE.md §9).
      if (import.meta.env?.DEV && !warnedFallback) {
        warnedFallback = true;
        console.warn(
          '[Guide] the Navigation API is unavailable; cross-route foreign-navigation detection falls back to popstate and will miss pushState navigations (link clicks, goto). Inject a router-backed navigationSource for reliable detection — see docs/GUIDE.md §9.'
        );
      }
      const onPop = () => onNavigate(window.location.pathname);
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }
  };
}

/** DEV-only: grace period for a navigated-to `route` step's target before warning it never showed. */
const ROUTE_TARGET_TIMEOUT_MS = 4000;

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

  // ── Cross-route touring ─────────────────────────────────
  readonly #navigate?: (route: string) => void | Promise<void>;
  readonly #navSource: GuideNavigationSource;
  /** The path a tour-internal navigation is heading to; distinguishes our own nav from a foreign one. */
  #expectedRoute: string | null = null;
  /** Last path the tour is known to be on — set at start, updated on each handled navigation. */
  #knownPath = '';
  /** Unsubscribe from the navigation source; non-null only while a route-using tour runs. */
  #navUnsub: (() => void) | null = null;
  /** DEV-only timer that warns when a navigated-to step's target never appears. */
  #routeTargetTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.#navigate = options.navigate;
    this.#navSource = options.navigationSource ?? createBrowserNavigationSource();
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
    // Observe navigation only for tours that declare a step route. This keeps the manual-`goto`
    // recipe (consumer navigates in `onStep`, no `step.route`) untouched, where a navigation is
    // the consumer's own and must NOT be read as a foreign one that stops the tour.
    this.#knownPath = this.#navSource.current();
    if (tour.steps.some((s) => typeof s.route === 'string')) {
      this.#navUnsub = this.#navSource.subscribe((path) => this.#onLocationChange(path));
    }
    this.#activateStep('start');
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
    this.#activateStep('next');
  }

  /** Go back one step. No-op on the first step. */
  prev(): void {
    if (!this.#activeTour || this.isFirstStep) return;
    this.#stepIndex -= 1;
    this.#activateStep('prev');
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

  // ─── Cross-route touring ──────────────────────────────────────────────────

  /**
   * Make the now-current step active: trigger its cross-route navigation (if any), apply the
   * highlight, then fire `onStep`. Shared by `startTour`/`next`/`prev`, so every entry point
   * navigates symmetrically — including `prev()` stepping back across a route boundary.
   */
  #activateStep(via: GuideStepEvent['via']): void {
    this.#clearRouteTargetWarning();
    this.#maybeNavigate();
    this.#applyStepHighlight();
    this.#emitStep(via);
  }

  /**
   * If the active step lives on a different route, navigate there via the injected hook and record
   * it as the `expectedRoute`, so the resulting navigation is recognized as the tour's own rather
   * than a foreign one. Already on the route → nothing to do. No hook wired → DEV warning, stay put.
   */
  #maybeNavigate(): void {
    // Each step starts with a clean slate — no navigation is pending until we trigger one below.
    // (A step that doesn't navigate must not inherit the previous step's `expectedRoute`.)
    this.#expectedRoute = null;
    const route = this.currentStep?.route;
    if (route == null) return;
    if (route === this.#navSource.current()) return;
    if (!this.#navigate) {
      if (this.#dev) {
        console.warn(
          `[Guide] tour "${this.#activeTour?.id}" step ${this.#stepIndex}: step has route "${route}" but no navigate hook was provided to the GuideController — staying on the current route.`
        );
      }
      return;
    }
    this.#expectedRoute = route;
    this.#scheduleRouteTargetWarning();
    try {
      const result = this.#navigate(route);
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((err: unknown) => {
          if (this.#dev) console.warn('[Guide] navigate hook rejected:', err);
          this.#abortPendingNavigation(route);
        });
      }
    } catch (err) {
      if (this.#dev) console.warn('[Guide] navigate hook threw:', err);
      this.#abortPendingNavigation(route);
    }
  }

  /**
   * Roll back the bookkeeping for a navigation that failed (hook threw/rejected) — but only if it
   * is still the pending one, so a newer step's navigation (the user clicked Next while this hook
   * was in flight) is never clobbered by a late rejection. Clears the now-meaningless "target never
   * appeared" timer too, so it can't later fire a misleading warning for a navigation that never ran.
   */
  #abortPendingNavigation(route: string): void {
    if (this.#expectedRoute !== route) return;
    this.#expectedRoute = null;
    this.#clearRouteTargetWarning();
  }

  /**
   * React to a navigation observed while a route-using tour runs. A navigation matching the pending
   * `expectedRoute` is the tour's own → clear the flag and keep running (the ring lands via the
   * surface's `reapplyStepHighlight`). Any other navigation is foreign — the user left, or a
   * youngest-gesture-wins race — and tears the tour down, analytics-silent (`stopTour`).
   */
  #onLocationChange(path: string): void {
    if (!this.#activeTour) return;
    if (path === this.#knownPath) return; // no pathname change (e.g. a hash/query update) — ignore
    this.#knownPath = path;
    if (this.#expectedRoute !== null && path === this.#expectedRoute) {
      // The tour's own navigation landed — keep running. For a *targeted* step, keep `#expectedRoute`
      // set until the target settles (`#applyStepHighlight`) so a redirecting / multi-hop source (the
      // Navigation API emitting one event per hop) firing a *second* event for the redirect target is
      // still recognized as a mismatch (and DEV-warned) instead of silently stopping. A *targetless*
      // route step has no target to wait for — it is settled on landing, so clear now; otherwise a
      // later foreign navigation would misfire the "navigated toward …" warning. (`#maybeNavigate`
      // also resets it on the next step. Clearing here can't move into `#applyStepHighlight`, which
      // runs synchronously in `#activateStep` before the nav lands — it would mis-read our own nav.)
      if (this.currentStep?.target == null) this.#expectedRoute = null;
      return;
    }
    // Any other navigation stops the tour (analytics-silent). When one was pending, a landed path
    // that doesn't match is most often a normalized `step.route` (trailing slash, base/locale
    // prefix) rather than a genuine foreign nav — so surface it instead of a silent teardown on a
    // one-character mismatch. (The strict stop is kept either way: better than running on a wrong page.)
    if (this.#dev && this.#expectedRoute !== null) {
      console.warn(
        `[Guide] tour "${this.#activeTour?.id}" navigated toward "${this.#expectedRoute}" but landed on "${path}" — stopping as a foreign navigation. If "${path}" is just a normalized form of the step's route (trailing slash, base/locale prefix), set step.route to the router's actual path.`
      );
    }
    this.#expectedRoute = null;
    this.stopTour();
  }

  /**
   * DEV-only: after navigating for a `route` step, warn if its target never appears so the spotlight
   * can't land (the step still renders, centered over the scrim — it never hangs). Browser-gated, so
   * no timer is ever scheduled under SSR or in node tests.
   */
  #scheduleRouteTargetWarning(): void {
    if (!this.#dev || !BROWSER) return;
    const step = this.currentStep;
    if (!step?.target) return;
    this.#clearRouteTargetWarning();
    const index = this.#stepIndex;
    const targetId = step.target;
    const route = step.route;
    this.#routeTargetTimer = setTimeout(() => {
      this.#routeTargetTimer = null;
      if (this.#stepIndex === index && !this.resolveTarget(targetId)) {
        console.warn(
          `[Guide] tour "${this.#activeTour?.id}" step ${index}: navigated to "${route}" but target "${targetId}" never appeared — showing the step without a spotlight ring.`
        );
      }
    }, ROUTE_TARGET_TIMEOUT_MS);
  }

  /** Cancel a pending route-target warning (target appeared, the step changed, or teardown). */
  #clearRouteTargetWarning(): void {
    if (this.#routeTargetTimer !== null) {
      clearTimeout(this.#routeTargetTimer);
      this.#routeTargetTimer = null;
    }
  }

  #endTour(): void {
    const tour = this.#activeTour;
    this.#teardownTour();
    // Both skip and finish mark the tour seen — "helpful, not intrusive": never nag.
    // (The skip/complete distinction itself lives in skip()/finish(), which fire the
    // matching analytics callback around this shared teardown.)
    if (tour && tour.once !== false) this.markSeen(tour.id);
  }

  /** Reset all tour state and release the overlay-stack + navigation registrations. No persistence. */
  #teardownTour(): void {
    this.#clearRouteTargetWarning();
    this.#navUnsub?.();
    this.#navUnsub = null;
    this.#expectedRoute = null;
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
      this.#clearRouteTargetWarning(); // target landed → no "never appeared" warning needed
      this.#expectedRoute = null; // the navigated-to target resolved → navigation fully settled
    } else {
      this.clearHighlight();
      // A step bound to another route legitimately has no target on the current page — during the
      // navigation gap, or when no navigate hook is wired — so don't warn "not found" there; the
      // missing-hook and never-appeared paths own those diagnostics instead.
      const offRoute = step.route != null && step.route !== this.#navSource.current();
      if (this.#dev && !offRoute) {
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
