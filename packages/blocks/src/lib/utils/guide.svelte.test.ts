import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalStorageAdapter,
  GuideController,
  type GuideNavigationSource,
  type GuideOverlayStackLike,
  type GuideStorageAdapter,
  type GuideTour
} from './guide.svelte';

// ─── Test doubles (the test env is `node` — no DOM, window, or CSS) ──────────

/** Minimal HTMLElement stand-in tracking attribute toggles + scrollIntoView calls. */
function mockElement(): HTMLElement & {
  has(name: string): boolean;
  scrollCalls: ScrollIntoViewOptions[];
} {
  const attrs = new Set<string>();
  const scrollCalls: ScrollIntoViewOptions[] = [];
  return {
    setAttribute: (name: string) => attrs.add(name),
    removeAttribute: (name: string) => attrs.delete(name),
    scrollIntoView: (opts: ScrollIntoViewOptions) => scrollCalls.push(opts),
    has: (name: string) => attrs.has(name),
    scrollCalls
  } as unknown as HTMLElement & {
    has(name: string): boolean;
    scrollCalls: ScrollIntoViewOptions[];
  };
}

function makeStorage(initial: string[] = []) {
  const store = { ids: [...initial] };
  const adapter: GuideStorageAdapter = {
    load: () => [...store.ids],
    save: (next) => {
      store.ids = [...next];
    }
  };
  return { adapter, store };
}

/** Async-load storage double: `load()` returns a Promise you settle explicitly,
 *  `save` writes through to a live `store`, so tests can assert the *persisted*
 *  payload (not just the in-memory set). */
function makeAsyncStorage(initial: string[] = []) {
  const store = { ids: [...initial] };
  let resolveLoad!: (ids: string[]) => void;
  const load = vi.fn(
    () =>
      new Promise<string[]>((r) => {
        resolveLoad = r;
      })
  );
  const save = vi.fn((next: string[]) => {
    store.ids = [...next];
  });
  return {
    adapter: { load, save } as GuideStorageAdapter,
    store,
    save,
    /** Resolve the pending load and flush the `.then` merge + reconciliation. */
    settle: async (ids: string[]) => {
      resolveLoad(ids);
      await Promise.resolve();
    }
  };
}

function makeOverlayStack(): GuideOverlayStackLike & {
  entries: string[];
  pushForeign(id: string): void;
  closeTop(): void;
} {
  const entries: string[] = [];
  const closers = new Map<string, () => void>();
  return {
    entries,
    register(id, close) {
      entries.push(id);
      closers.set(id, close);
      return () => {
        const i = entries.indexOf(id);
        if (i >= 0) entries.splice(i, 1);
        closers.delete(id);
      };
    },
    isTop(id) {
      return entries[entries.length - 1] === id;
    },
    get depth() {
      return entries.length;
    },
    pushForeign(id) {
      entries.push(id);
    },
    /** Invoke the top entry's registered close callback (mirrors a real close-top/Escape). */
    closeTop() {
      const id = entries[entries.length - 1];
      if (id !== undefined) closers.get(id)?.();
    }
  };
}

/** Controller wired with all dependencies mocked and DEV warnings off by default. */
function makeController(opts: { storage?: GuideStorageAdapter; dev?: boolean } = {}) {
  const overlay = makeOverlayStack();
  const ctrl = new GuideController({
    storage: opts.storage,
    overlayStack: overlay,
    dev: opts.dev ?? false
  });
  return { ctrl, overlay };
}

/** A controllable {@link GuideNavigationSource} whose `emit` simulates a real navigation. */
function makeNavigationSource(initialPath = '/start') {
  let path = initialPath;
  const subs = new Set<(p: string) => void>();
  const source: GuideNavigationSource = {
    current: () => path,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    }
  };
  return {
    source,
    /** Move to a new path and notify subscribers (like the Navigation API / popstate firing). */
    emit(next: string) {
      path = next;
      for (const cb of [...subs]) cb(next); // snapshot: a subscriber may unsubscribe mid-emit
    },
    get path() {
      return path;
    },
    get subscriberCount() {
      return subs.size;
    }
  };
}

/** Controller wired for cross-route tests: a mock nav source + a (by default present) navigate hook. */
function makeRouteController(
  opts: { initialPath?: string; dev?: boolean; withNavigate?: boolean } = {}
) {
  const overlay = makeOverlayStack();
  const nav = makeNavigationSource(opts.initialPath ?? '/start');
  const navigate = vi.fn((_route: string) => {});
  const ctrl = new GuideController({
    overlayStack: overlay,
    dev: opts.dev ?? false,
    navigate: opts.withNavigate === false ? undefined : navigate,
    navigationSource: nav.source
  });
  return { ctrl, overlay, nav, navigate };
}

const tour = (steps: GuideTour['steps'], extra: Partial<GuideTour> = {}): GuideTour => ({
  id: 'demo',
  steps,
  ...extra
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Target registry ─────────────────────────────────────────────────────────

describe('GuideController — target registry', () => {
  it('registers and resolves a target via the registry', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('save', el, { label: 'Save', article: 'saving' });
    expect(ctrl.resolveTarget('save')).toBe(el);
    expect(ctrl.getTopicMeta('save')).toEqual({ label: 'Save', article: 'saving' });
  });

  it('the cleanup from registerTarget unregisters the element', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    const cleanup = ctrl.registerTarget('save', el);
    cleanup();
    expect(ctrl.resolveTarget('save')).toBeNull();
  });

  it('target() returns an attachment whose return value unregisters', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    const attach = ctrl.target('save');
    const cleanup = attach(el) as () => void;
    expect(ctrl.resolveTarget('save')).toBe(el);
    cleanup();
    expect(ctrl.resolveTarget('save')).toBeNull();
  });

  it('warns on a duplicate id in DEV and overwrites', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeController({ dev: true });
    const a = mockElement();
    const b = mockElement();
    ctrl.registerTarget('dup', a);
    ctrl.registerTarget('dup', b);
    expect(warn).toHaveBeenCalledOnce();
    expect(ctrl.resolveTarget('dup')).toBe(b);
  });

  it('does not warn on duplicates when DEV is off', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeController({ dev: false });
    ctrl.registerTarget('dup', mockElement());
    ctrl.registerTarget('dup', mockElement());
    expect(warn).not.toHaveBeenCalled();
  });

  it('resolveTarget returns null for an unknown id (no DOM fallback in node)', () => {
    const { ctrl } = makeController();
    expect(ctrl.resolveTarget('missing')).toBeNull();
  });

  it('unregistering a stale element does not remove a newer registration', () => {
    const { ctrl } = makeController();
    const a = mockElement();
    const b = mockElement();
    ctrl.registerTarget('x', a);
    ctrl.registerTarget('x', b);
    ctrl.unregisterTarget('x', a); // a is no longer current — must be a no-op
    expect(ctrl.resolveTarget('x')).toBe(b);
  });
});

// ─── Tour state machine ────────────────────────────────────────────────────

describe('GuideController — tour state machine', () => {
  it('starts a tour and exposes step metadata', () => {
    const { ctrl } = makeController();
    const ok = ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }, { title: 'C' }]));
    expect(ok).toBe(true);
    expect(ctrl.isTourActive).toBe(true);
    expect(ctrl.stepCount).toBe(3);
    expect(ctrl.stepIndex).toBe(0);
    expect(ctrl.currentStep?.title).toBe('A');
    expect(ctrl.isFirstStep).toBe(true);
    expect(ctrl.isLastStep).toBe(false);
  });

  it('navigates forward and backward with clamping', () => {
    const { ctrl } = makeController();
    ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }]));
    ctrl.prev(); // no-op on first
    expect(ctrl.stepIndex).toBe(0);
    ctrl.next();
    expect(ctrl.stepIndex).toBe(1);
    expect(ctrl.isLastStep).toBe(true);
    ctrl.prev();
    expect(ctrl.stepIndex).toBe(0);
  });

  it('next() on the last step finishes the tour', () => {
    const { ctrl } = makeController();
    ctrl.startTour(tour([{ title: 'only' }]));
    expect(ctrl.isLastStep).toBe(true);
    ctrl.next();
    expect(ctrl.isTourActive).toBe(false);
    expect(ctrl.currentStep).toBeNull();
  });

  it('does not start a tour with no steps and warns in DEV', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeController({ dev: true });
    expect(ctrl.startTour(tour([]))).toBe(false);
    expect(ctrl.isTourActive).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('registers in the overlay stack while active and unregisters on finish', () => {
    const { ctrl, overlay } = makeController();
    ctrl.startTour(tour([{ title: 'A' }]));
    expect(overlay.entries).toHaveLength(1);
    ctrl.finish();
    expect(overlay.entries).toHaveLength(0);
  });

  it('paused is true when a foreign overlay stacks on top', () => {
    const { ctrl, overlay } = makeController();
    ctrl.startTour(tour([{ title: 'A' }]));
    expect(ctrl.paused).toBe(false);
    overlay.pushForeign('foreign-dialog');
    expect(ctrl.paused).toBe(true);
  });

  it('overlayDepth reflects the stack size (hints hide while > 0)', () => {
    const { ctrl, overlay } = makeController();
    expect(ctrl.overlayDepth).toBe(0);
    overlay.pushForeign('foreign-dialog');
    expect(ctrl.overlayDepth).toBe(1);
    ctrl.startTour(tour([{ title: 'A' }]));
    expect(ctrl.overlayDepth).toBe(2);
  });

  it('starting a tour while one is active does not leak the previous overlay entry', () => {
    const { ctrl, overlay } = makeController();
    ctrl.startTour(tour([{ title: 'A' }], { id: 'first' }));
    expect(overlay.entries).toHaveLength(1);
    ctrl.startTour(tour([{ title: 'B' }], { id: 'second' }));
    expect(overlay.entries).toHaveLength(1); // old entry torn down, not leaked
    expect(ctrl.activeTour?.id).toBe('second');
    expect(ctrl.paused).toBe(false); // the new tour is top of the stack
  });
});

// ─── Analytics hooks (onStep / onComplete / onSkip) ──────────────────────────

describe('GuideController — analytics hooks', () => {
  it('fires onStep on start with the full payload (via "start", tour by reference)', () => {
    const { ctrl } = makeController();
    const onStep = vi.fn();
    const stepA = { title: 'A' };
    const t = tour([stepA, { title: 'B' }], { onStep });
    ctrl.startTour(t);
    expect(onStep).toHaveBeenCalledTimes(1);
    const event = onStep.mock.calls[0][0];
    expect(event).toMatchObject({ index: 0, step: stepA, total: 2, via: 'start' });
    expect(event.tour).toBe(t); // same object → ergonomic for a shared, tour-keyed handler
  });

  it('fires onStep again on next/prev with the matching direction + index', () => {
    const { ctrl } = makeController();
    const onStep = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }, { title: 'C' }], { onStep }));
    onStep.mockClear(); // drop the start event
    ctrl.next();
    expect(onStep).toHaveBeenLastCalledWith(expect.objectContaining({ index: 1, via: 'next' }));
    ctrl.prev();
    expect(onStep).toHaveBeenLastCalledWith(expect.objectContaining({ index: 0, via: 'prev' }));
  });

  it('does not fire onStep for a no-op prev() on the first step', () => {
    const { ctrl } = makeController();
    const onStep = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }], { onStep }));
    onStep.mockClear();
    ctrl.prev(); // first step → no-op
    expect(onStep).not.toHaveBeenCalled();
  });

  it('fires onComplete (not onSkip) on finish(), with the last-step snapshot', () => {
    const { ctrl } = makeController();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    const stepB = { title: 'B' };
    ctrl.startTour(tour([{ title: 'A' }, stepB], { onComplete, onSkip }));
    ctrl.next(); // → last step
    ctrl.finish();
    expect(onSkip).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenLastCalledWith(
      expect.objectContaining({ index: 1, step: stepB, total: 2 })
    );
  });

  it('fires onComplete when next() advances past the last step', () => {
    const { ctrl } = makeController();
    const onComplete = vi.fn();
    ctrl.startTour(tour([{ title: 'only' }], { onComplete }));
    ctrl.next(); // last step → finish()
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires onSkip (not onComplete) with the drop-off index', () => {
    const { ctrl } = makeController();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }, { title: 'C' }], { onComplete, onSkip }));
    ctrl.next(); // dropped off at index 1
    ctrl.skip();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenLastCalledWith(expect.objectContaining({ index: 1, total: 3 }));
  });

  it('fires onSkip when the overlay stack closes the tour (registered close → skip)', () => {
    const { ctrl, overlay } = makeController();
    const onSkip = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }], { onSkip }));
    // A stack-level close (Escape / closeAll) invokes the tour's registered `() => skip()`.
    overlay.closeTop();
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(ctrl.isTourActive).toBe(false);
  });

  it('a throwing onStep does not abort tour setup (state + overlay intact)', () => {
    const { ctrl, overlay } = makeController();
    let calls = 0;
    const onStep = vi.fn(() => {
      if (++calls === 1) throw new Error('step boom'); // throw on the start step
    });
    expect(() => ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }], { onStep }))).not.toThrow();
    expect(ctrl.isTourActive).toBe(true);
    expect(overlay.entries).toHaveLength(1); // overlay entry still registered
    expect(() => ctrl.next()).not.toThrow();
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('is silent when startTour replaces a running tour (no onSkip for the dropped one)', () => {
    const { ctrl } = makeController();
    const onSkip = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }], { id: 'first', onSkip }));
    ctrl.startTour(tour([{ title: 'B' }], { id: 'second' }));
    expect(onSkip).not.toHaveBeenCalled(); // silent replacement, like stopTour
  });

  it('fires onComplete even when once is false (analytics independent of persistence)', () => {
    const { ctrl } = makeController();
    const onComplete = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }], { once: false, onComplete }));
    ctrl.finish();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(ctrl.hasSeen('demo')).toBe(false); // not persisted, but the hook still fired
  });

  it('is silent on stopTour (programmatic teardown fires no analytics)', () => {
    const { ctrl } = makeController();
    const onStep = vi.fn();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    ctrl.startTour(tour([{ title: 'A' }], { onStep, onComplete, onSkip }));
    onStep.mockClear(); // ignore the start step
    ctrl.stopTour();
    expect(onStep).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('a throwing callback does not corrupt teardown (overlay released, no re-throw)', () => {
    const { ctrl, overlay } = makeController();
    const onComplete = vi.fn(() => {
      throw new Error('analytics boom');
    });
    ctrl.startTour(tour([{ title: 'A' }], { onComplete }));
    expect(() => ctrl.finish()).not.toThrow();
    expect(ctrl.isTourActive).toBe(false);
    expect(overlay.entries).toHaveLength(0); // overlay entry still released
    expect(ctrl.hasSeen('demo')).toBe(true); // still marked seen
  });

  it('warns in DEV when a callback throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeController({ dev: true });
    ctrl.startTour(
      tour([{ title: 'A' }], {
        onComplete: () => {
          throw new Error('boom');
        }
      })
    );
    ctrl.finish();
    expect(warn).toHaveBeenCalled();
  });
});

// ─── Persistence / "seen" ─────────────────────────────────────────────────

describe('GuideController — persistence', () => {
  it('marks a finished tour as seen and persists it', () => {
    const { adapter, store } = makeStorage();
    const ctrl = new GuideController({
      storage: adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });
    ctrl.startTour(tour([{ title: 'A' }]));
    ctrl.finish();
    expect(ctrl.hasSeen('demo')).toBe(true);
    expect(store.ids).toContain('demo');
  });

  it('marks a skipped tour as seen too (never nag)', () => {
    const { ctrl } = makeController();
    ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }]));
    ctrl.skip();
    expect(ctrl.hasSeen('demo')).toBe(true);
  });

  it('does not re-start a seen tour unless once is false', () => {
    const { adapter } = makeStorage(['demo']);
    const ctrl = new GuideController({
      storage: adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });
    expect(ctrl.startTour(tour([{ title: 'A' }]))).toBe(false);
    expect(ctrl.startTour(tour([{ title: 'A' }], { once: false }))).toBe(true);
  });

  it('does not persist seen state for once:false tours', () => {
    const { adapter, store } = makeStorage();
    const ctrl = new GuideController({
      storage: adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });
    ctrl.startTour(tour([{ title: 'A' }], { once: false }));
    ctrl.finish();
    expect(store.ids).not.toContain('demo');
  });

  it('stopTour tears down without marking seen, releasing the overlay entry + highlight', () => {
    const { ctrl, overlay } = makeController();
    const el = mockElement();
    ctrl.registerTarget('s', el);
    ctrl.startTour(tour([{ target: 's', title: 'A' }]));
    expect(ctrl.isTourActive).toBe(true);
    expect(overlay.entries).toHaveLength(1);
    ctrl.stopTour();
    expect(ctrl.isTourActive).toBe(false);
    expect(overlay.entries).toHaveLength(0); // overlay-stack entry released
    expect(el.has('data-guide-highlight')).toBe(false); // ring cleared
    expect(ctrl.hasSeen('demo')).toBe(false); // NOT marked seen → can show again
  });

  it('resetSeen forgets one id or all', () => {
    const { adapter, store } = makeStorage(['a', 'b']);
    const ctrl = new GuideController({
      storage: adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });
    ctrl.resetSeen('a');
    expect(ctrl.hasSeen('a')).toBe(false);
    expect(ctrl.hasSeen('b')).toBe(true);
    expect(store.ids).toEqual(['b']);
    ctrl.resetSeen();
    expect(ctrl.seenIds).toEqual([]);
  });
});

// ─── Highlight ───────────────────────────────────────────────────────────

describe('GuideController — highlight', () => {
  it('sets and clears the data-guide-highlight attribute', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('save', el);
    ctrl.highlight('save');
    expect(ctrl.highlightedId).toBe('save');
    expect(el.has('data-guide-highlight')).toBe(true);
    ctrl.clearHighlight();
    expect(ctrl.highlightedId).toBeNull();
    expect(el.has('data-guide-highlight')).toBe(false);
  });

  it('moves the highlight attribute when switching targets', () => {
    const { ctrl } = makeController();
    const a = mockElement();
    const b = mockElement();
    ctrl.registerTarget('a', a);
    ctrl.registerTarget('b', b);
    ctrl.highlight('a');
    ctrl.highlight('b');
    expect(a.has('data-guide-highlight')).toBe(false);
    expect(b.has('data-guide-highlight')).toBe(true);
  });

  it('highlighting an unresolved id is a no-op and warns in DEV', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeController({ dev: true });
    ctrl.highlight('ghost');
    expect(ctrl.highlightedId).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('unregistering the highlighted target clears the highlight and drops the attribute', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('save', el);
    ctrl.highlight('save');
    ctrl.unregisterTarget('save', el);
    expect(ctrl.highlightedId).toBeNull();
    // The attribute must be removed even though the element is no longer in the
    // registry and carries no data-guide attribute (purely programmatic target).
    expect(el.has('data-guide-highlight')).toBe(false);
  });

  it('a tour step highlights its target automatically', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('step-1', el);
    ctrl.startTour(tour([{ target: 'step-1', title: 'A' }]));
    expect(ctrl.highlightedId).toBe('step-1');
    expect(el.has('data-guide-highlight')).toBe(true);
    ctrl.finish();
    expect(el.has('data-guide-highlight')).toBe(false);
  });

  it('reapplyStepHighlight lands the ring + scroll when a lazy target registers after the step began', () => {
    const { ctrl } = makeController();
    // The step targets an element not registered (nor in the DOM) yet — a lazy render.
    ctrl.startTour(tour([{ target: 'late', title: 'A' }]));
    expect(ctrl.highlightedId).toBeNull(); // nothing to highlight at start
    const el = mockElement();
    ctrl.registerTarget('late', el); // element renders after the step began
    ctrl.reapplyStepHighlight(); // surface observed it appear → re-applies
    expect(ctrl.highlightedId).toBe('late');
    expect(el.has('data-guide-highlight')).toBe(true);
    expect(el.scrollCalls).toHaveLength(1); // tour steps scroll their target into view
  });

  it('reapplyStepHighlight clears the ring when the step target has gone (graceful fallback)', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('gone', el);
    ctrl.startTour(tour([{ target: 'gone', title: 'A' }]));
    expect(ctrl.highlightedId).toBe('gone');
    // Drop the registration without going through unregisterTarget's auto-clear, mimicking a
    // DOM-fallback target that vanished from the document — reapply must resolve to nothing.
    ctrl.unregisterTarget('gone', el);
    ctrl.reapplyStepHighlight();
    expect(ctrl.highlightedId).toBeNull();
    expect(el.has('data-guide-highlight')).toBe(false);
  });

  it('reapplyStepHighlight is a no-op when no tour is active', () => {
    const { ctrl } = makeController();
    expect(() => ctrl.reapplyStepHighlight()).not.toThrow();
    expect(ctrl.highlightedId).toBeNull();
  });

  it('a tour scrolls each step target into view (unlike a bare highlight)', () => {
    const { ctrl } = makeController();
    const a = mockElement();
    const b = mockElement();
    ctrl.registerTarget('s-a', a);
    ctrl.registerTarget('s-b', b);
    ctrl.startTour(tour([{ target: 's-a' }, { target: 's-b' }]));
    expect(a.scrollCalls).toHaveLength(1); // scrolled on start
    ctrl.next();
    expect(b.scrollCalls).toHaveLength(1); // scrolled on advance
    ctrl.prev();
    expect(a.scrollCalls).toHaveLength(2); // and again on going back
  });

  it('a targetless tour step clears the highlight without scrolling', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('s-a', el);
    ctrl.startTour(tour([{ target: 's-a' }, { title: 'centered, no target' }]));
    expect(ctrl.highlightedId).toBe('s-a');
    ctrl.next();
    expect(ctrl.highlightedId).toBeNull(); // centered step → no highlight
    expect(el.has('data-guide-highlight')).toBe(false);
  });

  it('scrolls the target into view only when { scroll: true } (Direction B)', () => {
    const { ctrl } = makeController();
    const el = mockElement();
    ctrl.registerTarget('save', el);
    ctrl.highlight('save');
    expect(el.scrollCalls).toHaveLength(0);
    ctrl.highlight('save', { scroll: true });
    expect(el.scrollCalls).toHaveLength(1);
    // No matchMedia in the node env → not reduced → smooth scroll.
    expect(el.scrollCalls[0]).toMatchObject({ behavior: 'smooth', block: 'nearest' });
  });
});

// ─── Direction resolution (§4.3) ─────────────────────────────────────────

describe('GuideController — resolveDirection', () => {
  it('defaults to "both" for an unregistered or meta-less topic', () => {
    const { ctrl } = makeController();
    expect(ctrl.resolveDirection('ghost')).toBe('both');
    ctrl.registerTarget('plain', mockElement());
    expect(ctrl.resolveDirection('plain')).toBe('both');
  });

  it('reads the registered topic direction', () => {
    const { ctrl } = makeController();
    ctrl.registerTarget('a', mockElement(), { direction: 'to-ui' });
    expect(ctrl.resolveDirection('a')).toBe('to-ui');
  });

  it('lets a surface override win over the topic meta', () => {
    const { ctrl } = makeController();
    ctrl.registerTarget('a', mockElement(), { direction: 'to-ui' });
    expect(ctrl.resolveDirection('a', 'to-guide')).toBe('to-guide');
  });
});

// ─── Panel state ─────────────────────────────────────────────────────────

describe('GuideController — panel state', () => {
  it('opens and closes the panel, optionally setting an article', () => {
    const { ctrl } = makeController();
    expect(ctrl.panelOpen).toBe(false);
    ctrl.openPanel('saving');
    expect(ctrl.panelOpen).toBe(true);
    expect(ctrl.activeArticle).toBe('saving');
    ctrl.closePanel();
    expect(ctrl.panelOpen).toBe(false);
    expect(ctrl.activeArticle).toBe('saving'); // article persists across close
  });

  it('publishes and releases the panel id (aria-controls target)', () => {
    const { ctrl } = makeController();
    expect(ctrl.panelId).toBeNull();
    const release = ctrl.registerPanel('guide-panel-1');
    expect(ctrl.panelId).toBe('guide-panel-1');
    release();
    expect(ctrl.panelId).toBeNull();
  });

  it('a stale release does not clobber a newer panel id', () => {
    const { ctrl } = makeController();
    const releaseOld = ctrl.registerPanel('panel-a');
    ctrl.registerPanel('panel-b');
    releaseOld(); // the old panel unmounts after a new one mounted
    expect(ctrl.panelId).toBe('panel-b');
  });
});

// ─── Default storage adapter (SSR-safe) ──────────────────────────────────

describe('createLocalStorageAdapter', () => {
  it('is SSR-safe: load returns [] and save is a no-op without window', () => {
    const adapter = createLocalStorageAdapter();
    expect(adapter.load()).toEqual([]);
    expect(() => adapter.save(['x'])).not.toThrow();
  });
});

// ─── Cross-route touring (GuideStep.route + navigate hook) ───────────────────

describe('GuideController — cross-route touring', () => {
  it('does not navigate when the first step is already on its route', () => {
    const { ctrl, navigate } = makeRouteController({ initialPath: '/dash' });
    const el = mockElement();
    ctrl.registerTarget('a', el);
    ctrl.startTour(tour([{ target: 'a', route: '/dash', title: 'A' }]));
    expect(navigate).not.toHaveBeenCalled();
    expect(ctrl.highlightedId).toBe('a'); // target on the current route is spotlit immediately
  });

  it('navigates forward across a route and lands the target once it appears', () => {
    const { ctrl, nav, navigate } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash', title: 'A' },
        { target: 'b', route: '/expenses', title: 'B' }
      ])
    );
    expect(navigate).not.toHaveBeenCalled(); // step 0 already on /dash
    ctrl.next(); // step 1 → /expenses
    expect(navigate).toHaveBeenCalledWith('/expenses');
    expect(ctrl.isTourActive).toBe(true);
    expect(ctrl.highlightedId).toBeNull(); // target absent during the navigation gap

    nav.emit('/expenses'); // the tour-internal navigation lands → keeps running
    expect(ctrl.isTourActive).toBe(true);

    const elB = mockElement();
    ctrl.registerTarget('b', elB); // target renders on the new page
    ctrl.reapplyStepHighlight(); // the surface observed it appear
    expect(ctrl.highlightedId).toBe('b');
    expect(elB.has('data-guide-highlight')).toBe(true);
  });

  it('navigates back across a route on prev() (symmetric)', () => {
    const { ctrl, nav, navigate } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next();
    nav.emit('/expenses');
    navigate.mockClear();

    ctrl.prev(); // back to step 0 (/dash)
    expect(navigate).toHaveBeenCalledWith('/dash');
    expect(ctrl.isTourActive).toBe(true);
  });

  it('reapplyStepHighlight does not re-trigger navigation', () => {
    const { ctrl, nav, navigate } = makeRouteController({ initialPath: '/dash' });
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next();
    nav.emit('/expenses');
    navigate.mockClear();
    ctrl.reapplyStepHighlight(); // the surface re-anchors — must not navigate again
    expect(navigate).not.toHaveBeenCalled();
  });

  it('stops the tour on a foreign navigation, analytics-silent', () => {
    const onSkip = vi.fn();
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour(
        [
          { target: 'a', route: '/dash' },
          { target: 'b', route: '/expenses' }
        ],
        { onSkip }
      )
    );
    expect(ctrl.isTourActive).toBe(true);
    expect(nav.subscriberCount).toBe(1);

    nav.emit('/somewhere-else'); // the user navigates away on their own
    expect(ctrl.isTourActive).toBe(false);
    expect(onSkip).not.toHaveBeenCalled(); // stopTour is analytics-silent
    expect(nav.subscriberCount).toBe(0); // and the navigation subscription is released
  });

  it('lets a foreign navigation win over a pending tour navigation (youngest gesture wins)', () => {
    const { ctrl, nav, navigate } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next(); // tour navigates to /expenses (expectedRoute set), not yet landed
    expect(navigate).toHaveBeenCalledWith('/expenses');
    nav.emit('/settings'); // user navigates elsewhere before /expenses lands
    expect(ctrl.isTourActive).toBe(false);
  });

  it('ignores a navigation event that does not change the path (hash/query update)', () => {
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(tour([{ target: 'a', route: '/dash' }]));
    nav.emit('/dash'); // same pathname → not a route change → must NOT stop the tour
    expect(ctrl.isTourActive).toBe(true);
  });

  it('DEV-warns (not silently) when a tour navigation lands on an unrelated path, then stops', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash', dev: true });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    warn.mockClear();
    ctrl.next(); // navigates toward /expenses
    nav.emit('/login'); // an unrelated landing (e.g. an auth-guard redirect), not a normalized form
    // The mismatch is surfaced (a genuine off-route landing is not a silent teardown)…
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('but landed on "/login"'));
    expect(ctrl.isTourActive).toBe(false); // …and the strict stop is kept for unrelated paths
  });

  it('stays diagnosable across a redirect chain where the first event already matched', () => {
    // A redirecting / multi-hop source (the Navigation API emitting one event per hop) fires the
    // expected path FIRST, then the redirect target. The matching first event must not clear the
    // expectation, or the second (mismatched) event would stop the tour silently. (Regression for
    // the cross-route logic review.)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash', dev: true });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' } // target 'b' never registers → never settles
      ])
    );
    warn.mockClear();
    ctrl.next(); // navigates toward /expenses
    nav.emit('/expenses'); // hop 1: the tour's navigation landed (matches) — keeps running
    expect(ctrl.isTourActive).toBe(true);
    nav.emit('/expenses/summary'); // hop 2: a redirect to a different path
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('but landed on "/expenses/summary"'));
    expect(ctrl.isTourActive).toBe(false); // stopped — but diagnosable, not silent
  });

  it('clears the expectation once the navigated-to target settles (later foreign nav is a plain stop)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash', dev: true });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next();
    nav.emit('/expenses'); // navigation lands…
    ctrl.registerTarget('b', mockElement());
    ctrl.reapplyStepHighlight(); // …and the target settles → expectation cleared
    warn.mockClear();
    nav.emit('/reports'); // a later foreign nav: a plain stop, no "navigated toward" mis-frame
    expect(ctrl.isTourActive).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('clears the expectation for a targetless route step on landing (no misleading later warning)', () => {
    // A targetless `route` step (a centered "intro to the new route" bubble) has no target to settle
    // on, so the expectation must clear on landing — otherwise a later foreign nav would misfire the
    // "navigated toward …" warning. The mid-test `isTourActive` assertion also guards against a fix
    // that clears too early and mis-reads the tour's OWN navigation as foreign. (Final cross-route review.)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeRouteController({ initialPath: '/home', dev: true });
    ctrl.startTour(tour([{ route: '/billing', title: 'Welcome to billing' }])); // route, no target
    nav.emit('/billing'); // the tour's own navigation lands…
    expect(ctrl.isTourActive).toBe(true); // …and is NOT mistaken for a foreign navigation
    warn.mockClear();
    nav.emit('/settings'); // a later foreign nav: stops, with NO misleading "navigated toward" warning
    expect(ctrl.isTourActive).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('subscribes to navigation only for tours that declare a route', () => {
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.startTour(tour([{ title: 'no route' }])); // no step.route → no subscription
    expect(nav.subscriberCount).toBe(0);
    ctrl.finish();

    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(tour([{ target: 'a', route: '/dash' }], { id: 'route-tour' }));
    expect(nav.subscriberCount).toBe(1); // a route tour subscribes
    ctrl.finish();
    expect(nav.subscriberCount).toBe(0); // and unsubscribes on end
  });

  it('warns in DEV and stays put when a route step has no navigate hook', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeRouteController({ initialPath: '/home', dev: true, withNavigate: false });
    expect(() => ctrl.startTour(tour([{ target: 'a', route: '/dash', title: 'A' }]))).not.toThrow();
    expect(ctrl.isTourActive).toBe(true); // the tour still runs, just doesn't navigate
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no navigate hook'));
  });

  it('does not warn "target not found" during the navigation gap', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeRouteController({ initialPath: '/dash', dev: true });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    warn.mockClear();
    ctrl.next(); // navigating to /expenses; target 'b' is off-route — must not warn yet
    expect(warn).not.toHaveBeenCalled();
  });

  it('swallows a navigate hook that throws synchronously (DEV-warned), no crash', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nav = makeNavigationSource('/dash');
    const navigate = vi.fn(() => {
      throw new Error('nav boom');
    });
    const ctrl = new GuideController({
      overlayStack: makeOverlayStack(),
      dev: true,
      navigate,
      navigationSource: nav.source
    });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    expect(() => ctrl.next()).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[Guide] navigate hook threw:', expect.any(Error));
    expect(ctrl.isTourActive).toBe(true); // step still active, it just didn't navigate
  });

  it('swallows a navigate hook that rejects (DEV-warned)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const nav = makeNavigationSource('/dash');
    const navigate = vi.fn(() => Promise.reject(new Error('nav boom')));
    const ctrl = new GuideController({
      overlayStack: makeOverlayStack(),
      dev: true,
      navigate,
      navigationSource: nav.source
    });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    expect(() => ctrl.next()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0)); // flush the rejection microtask
    expect(warn).toHaveBeenCalledWith('[Guide] navigate hook rejected:', expect.any(Error));
  });

  it('treats a non-route tour as before: no subscription, manual onStep navigation is its own', () => {
    // A tour with no step.route never subscribes, so a consumer navigating in onStep (the
    // manual-goto recipe) is not seen as a foreign navigation that would stop the tour.
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.startTour(tour([{ title: 'A' }, { title: 'B' }]));
    nav.emit('/the-consumers-own-goto'); // ignored — no subscription was set up
    expect(ctrl.isTourActive).toBe(true);
  });
});

// ─── Cross-route touring — synchronous (re-entrant) navigationSource (#41) ───────────────────────
//
// The recommended SvelteKit source (`afterNavigate` + the page store, GUIDE.md §9) reports the
// location change SYNCHRONOUSLY, re-entrant, inside the `goto` the navigate hook calls — so
// `#onLocationChange` runs *mid-`#maybeNavigate`*. The `path === expectedRoute` proxy alone misses
// the tour's own navigation the moment the router normalizes the path, tearing the tour down as
// foreign. A `#selfNavigating` re-entrancy guard recognizes it as our own regardless of the path.

describe('GuideController — synchronous navigationSource (re-entrancy, #41)', () => {
  /**
   * A controller whose `navigate` hook reports the new location SYNCHRONOUSLY (like SvelteKit's
   * `afterNavigate` firing inside `goto`). `transform` injects a router-normalized landing path
   * (trailing slash, base/locale prefix) — the exact shape that defeated the `path === expectedRoute`
   * proxy in #41.
   */
  function makeSyncController(
    opts: { initialPath?: string; dev?: boolean; transform?: (route: string) => string } = {}
  ) {
    const overlay = makeOverlayStack();
    const nav = makeNavigationSource(opts.initialPath ?? '/dash');
    const transform = opts.transform ?? ((r: string) => r);
    const navigate = vi.fn((route: string) => {
      nav.emit(transform(route)); // synchronous, re-entrant location report — fires while we navigate
    });
    const ctrl = new GuideController({
      overlayStack: overlay,
      dev: opts.dev ?? false,
      navigate,
      navigationSource: nav.source
    });
    return { ctrl, overlay, nav, navigate };
  }

  it('keeps the tour running and anchors the spotlight on a same-path sync report (AC #1/#4)', () => {
    const { ctrl, navigate } = makeSyncController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next(); // → /expenses; the hook re-enters #onLocationChange synchronously
    expect(navigate).toHaveBeenCalledWith('/expenses');
    expect(ctrl.isTourActive).toBe(true); // NOT torn down as a foreign navigation

    const elB = mockElement();
    ctrl.registerTarget('b', elB); // target appears on the new page…
    ctrl.reapplyStepHighlight();
    expect(ctrl.highlightedId).toBe('b'); // …and the spotlight still lands
    expect(elB.has('data-guide-highlight')).toBe(true);
  });

  it('keeps running when a sync source reports a router-normalized path (trailing slash) (AC #1)', () => {
    // The exact #41 failure: the normalized landing path made `path === expectedRoute` miss, so the
    // tour's OWN navigation was stopped as foreign (silently in PROD — `dev: false`, no warning).
    const { ctrl } = makeSyncController({ initialPath: '/dash', transform: (r) => `${r}/` });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next();
    expect(ctrl.isTourActive).toBe(true);
  });

  it('a sync normalized-path landing does not DEV-warn (recognized as own, not a foreign mismatch)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeSyncController({
      initialPath: '/dash',
      dev: true,
      transform: (r) => `${r}/`
    });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    warn.mockClear();
    ctrl.next(); // own navigation, normalized landing — no "navigated toward … but landed on …" warning
    expect(warn).not.toHaveBeenCalled();
    expect(ctrl.isTourActive).toBe(true);
  });

  it('still stops on a genuine foreign navigation with a sync source (AC #2)', () => {
    // A foreign navigation does NOT pass through our navigate hook, so `#selfNavigating` is false —
    // it must still be read as foreign and tear the tour down.
    const { ctrl, nav } = makeSyncController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    nav.emit('/somewhere-else'); // the user navigates away on their own
    expect(ctrl.isTourActive).toBe(false);
  });

  it('keeps running but DEV-warns on a synchronous redirect off the step route (not silent)', () => {
    // A synchronous source landing on an UNRELATED path during the navigate call (a redirect, e.g. an
    // auth guard → /login) is still causally the tour's own navigation, so the tour keeps running —
    // stopping would re-break the normalized #41 case the guard exists for. But unlike a normalized
    // landing it is surfaced in DEV (a targetless off-route bubble is otherwise invisible). Decision
    // pinned here: keep + DEV-warn, not a silent stop and not a silent run-on. (silent-failure review)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl } = makeSyncController({
      initialPath: '/dash',
      dev: true,
      transform: () => '/login'
    });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    warn.mockClear();
    ctrl.next(); // navigate('/expenses'); the source synchronously reports an unrelated '/login'
    expect(ctrl.isTourActive).toBe(true); // kept running as its own navigation, not a foreign stop
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('synchronously landed on "/login"'));
  });

  it('a targetless sync route step (normalized path) does not misfire the warning later (no regress)', () => {
    // Guards the integration: with a normalized landing path the `path === expectedRoute` proxy can't
    // match, so ONLY `#selfNavigating` recognizes the own navigation — and the targetless-step
    // `expectedRoute` clear must still run inside that branch, or a later foreign nav would misfire the
    // "navigated toward …" warning (regression for dea2641). The first assertion also fails (tour
    // already stopped) if the guard didn't recognize the normalized own-navigation at all.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeSyncController({
      initialPath: '/home',
      dev: true,
      transform: (r) => `${r}/`
    });
    ctrl.startTour(tour([{ route: '/billing', title: 'Welcome to billing' }])); // route, no target
    expect(ctrl.isTourActive).toBe(true); // own (sync, normalized) navigation is not mistaken for foreign
    warn.mockClear();
    nav.emit('/settings'); // a later foreign nav: stops, with NO misleading "navigated toward" warning
    expect(ctrl.isTourActive).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('the async (default-source) path is unchanged: a separate emit still matches via expectedRoute (AC #3)', () => {
    // When the report lands a tick AFTER the hook returns (the Navigation-API default source, or a
    // microtask-deferred one), `#selfNavigating` is already false and the normal `path === expectedRoute`
    // matching carries it — i.e. the guard is additive, not a replacement. `makeRouteController`'s hook
    // does nothing synchronously, so the `nav.emit` below models that later, non-re-entrant report.
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next(); // hook returns without reporting; #selfNavigating already reset
    expect(ctrl.isTourActive).toBe(true);
    nav.emit('/expenses'); // the report lands later → matched via expectedRoute, not #selfNavigating
    expect(ctrl.isTourActive).toBe(true);
  });
});

// ─── Cross-route touring — async false-stop hardening (post-#41 debt (a)+(b)) ────────────────────
//
// `#selfNavigating` (the #41 fix) only covers reports that arrive SYNCHRONOUSLY during the
// `#navigate()` call. With an asynchronous source (the default Navigation-API one, or a
// tick-deferred custom router) the report lands after the flag is reset, so recognizing the tour's
// own navigation falls to path matching — which used to be exact-only. Two latent false-stops
// followed (archived in docs/archive/2026-07/CR-guide-cross-route-followups.md):
//   (a) a router-normalized landing (`/expenses/`, `/de/expenses`) for a raw `step.route` failed
//       the exact match → the tour's OWN navigation stopped it as foreign (the async form of #41);
//       likewise a late report of a navigation superseded by a rapid next()/prev() (epoch race).
//   (b) two consecutive same-route targetless steps under a normalizing router re-navigate without
//       the pathname changing, so the `#knownPath` early-return skipped the targetless
//       `#expectedRoute` clear — arming a misleading "navigated toward …" DEV warning later.

describe('GuideController — async navigationSource false-stop hardening (debt (a)/(b))', () => {
  /** Sync-reporting controller whose router normalizes every landing with a trailing slash. */
  function makeSyncNormalizingController(opts: { initialPath: string; dev?: boolean }) {
    const nav = makeNavigationSource(opts.initialPath);
    const navigate = vi.fn((route: string) => nav.emit(`${route}/`));
    const ctrl = new GuideController({
      overlayStack: makeOverlayStack(),
      dev: opts.dev ?? false,
      navigate,
      navigationSource: nav.source
    });
    return { ctrl, nav, navigate };
  }

  it('(a) keeps running when an async source reports a router-normalized landing (trailing slash)', () => {
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next(); // navigate('/expenses'); the hook reports nothing synchronously
    nav.emit('/expenses/'); // the report lands a tick later, router-normalized
    expect(ctrl.isTourActive).toBe(true); // the tour's OWN navigation must not stop it

    const elB = mockElement();
    ctrl.registerTarget('b', elB); // target renders on the new page…
    ctrl.reapplyStepHighlight();
    expect(ctrl.highlightedId).toBe('b'); // …and the spotlight still lands
  });

  it('(a) keeps running when an async source reports a base/locale-prefixed landing', () => {
    const { ctrl, nav } = makeRouteController({ initialPath: '/de/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/de/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    ctrl.next();
    nav.emit('/de/expenses'); // the router prefixes the locale segment
    expect(ctrl.isTourActive).toBe(true);
  });

  it('(a) DEV-warns (advisory, heuristic match) on an async normalized landing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash', dev: true });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/expenses' }
      ])
    );
    warn.mockClear();
    ctrl.next();
    nav.emit('/expenses/');
    expect(ctrl.isTourActive).toBe(true);
    // Unlike the sync (causal) path, the async match is a heuristic — surface it so the consumer
    // can make step.route exact.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('keeping the tour running'));
  });

  it('(a) does not stop when a superseded own navigation reports late (rapid double-next)', () => {
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/reports' },
        { target: 'c', route: '/expenses' }
      ])
    );
    ctrl.next(); // navigate('/reports') — in flight
    ctrl.next(); // the user advances again before it lands → navigate('/expenses')
    nav.emit('/reports'); // the superseded navigation lands late — causally the tour's own
    expect(ctrl.isTourActive).toBe(true); // must NOT be read as a foreign navigation
    nav.emit('/expenses'); // the current navigation lands
    expect(ctrl.isTourActive).toBe(true);
    nav.emit('/somewhere-else'); // a genuine foreign navigation still stops
    expect(ctrl.isTourActive).toBe(false);
  });

  it('(a) a foreign visit to a superseded route after the current navigation landed still stops', () => {
    const { ctrl, nav } = makeRouteController({ initialPath: '/dash' });
    ctrl.registerTarget('a', mockElement());
    ctrl.startTour(
      tour([
        { target: 'a', route: '/dash' },
        { target: 'b', route: '/reports' },
        { target: 'c', route: '/expenses' }
      ])
    );
    ctrl.next();
    ctrl.next(); // '/reports' superseded, '/expenses' pending
    nav.emit('/expenses'); // the current navigation lands → the superseded epoch is over
    ctrl.registerTarget('c', mockElement());
    ctrl.reapplyStepHighlight(); // target settles
    nav.emit('/reports'); // the user going BACK to the superseded route is foreign now
    expect(ctrl.isTourActive).toBe(false);
  });

  it('(b, sync) consecutive same-route targetless steps do not arm a misleading foreign-nav warning', () => {
    // Step 1 lands normalized ('/expenses/'), so step 2's re-navigation to the same logical route
    // reports a path equal to #knownPath — the early return used to skip the targetless
    // #expectedRoute clear, arming a later "navigated toward …" mis-frame on a genuine foreign nav.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeSyncNormalizingController({ initialPath: '/home', dev: true });
    ctrl.startTour(
      tour([
        { route: '/expenses', title: 'Intro' },
        { route: '/expenses', title: 'More' } // same logical route, still targetless
      ])
    );
    expect(ctrl.isTourActive).toBe(true); // step 1's own (sync, normalized) landing kept it running
    ctrl.next(); // step 2 re-navigates; the sync report equals #knownPath
    expect(ctrl.isTourActive).toBe(true);
    warn.mockClear();
    nav.emit('/settings'); // foreign: stops, with NO misleading "navigated toward" warning
    expect(ctrl.isTourActive).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('(b) skips the redundant goto when already on the logical route (normalizing router)', () => {
    // The pre-navigation compare normalizes like the async own-vs-foreign path, so a step whose
    // route matches the current path up to a trailing slash (or locale prefix) does not re-navigate.
    // The old exact compare re-issued a goto to the same logical route, which a normalizing router
    // no-op's without emitting a report — arming a targetless expectation until the next step.
    const { ctrl, navigate } = makeSyncNormalizingController({ initialPath: '/home' });
    ctrl.startTour(
      tour([
        { route: '/expenses', title: 'Intro' }, // step 1: /home → /expenses (router lands /expenses/)
        { route: '/expenses', title: 'More' } // step 2: same logical route → no re-navigation
      ])
    );
    expect(navigate).toHaveBeenCalledTimes(1); // only step 1 navigated
    ctrl.next();
    expect(navigate).toHaveBeenCalledTimes(1); // step 2 recognized '/expenses/' as '/expenses'
    expect(ctrl.isTourActive).toBe(true);
  });

  it('(b, async) a same-path normalized landing clears a targetless expectation on the early-return path', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ctrl, nav } = makeRouteController({ initialPath: '/home', dev: true });
    ctrl.startTour(
      tour([
        { route: '/expenses', title: 'Intro' },
        { route: '/expenses', title: 'More' }
      ])
    );
    nav.emit('/expenses/'); // step 1's landing, normalized → kept via (a); #knownPath '/expenses/'
    expect(ctrl.isTourActive).toBe(true);
    ctrl.next(); // step 2 re-navigates (route ≠ the source's normalized current) — expectation pending
    nav.emit('/expenses/'); // its landing report — the pathname does not change (=== #knownPath)
    warn.mockClear();
    nav.emit('/settings'); // foreign: stops, with NO misleading "navigated toward" warning
    expect(ctrl.isTourActive).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

// Async storage adapter (CR-4). `load()` may return a Promise for a DB-/remote-
// backed seen-state. The set starts empty and unions the resolved ids in when
// the promise settles; a rejection fails open (tour stays unseen, no crash).
describe('GuideController — async storage adapter (CR-4)', () => {
  it('starts empty and merges the resolved ids for an async load', async () => {
    let resolve!: (ids: string[]) => void;
    const load = vi.fn(
      () =>
        new Promise<string[]>((r) => {
          resolve = r;
        })
    );
    const { ctrl } = makeController({ storage: { load, save: vi.fn() } });

    // Before the store answers the set is empty — the tour is startable.
    expect(ctrl.hasSeen('welcome')).toBe(false);

    resolve(['welcome']);
    await Promise.resolve(); // flush the .then merge
    expect(ctrl.hasSeen('welcome')).toBe(true);
  });

  it('unions resolved ids with ones marked seen while the load was pending', async () => {
    let resolve!: (ids: string[]) => void;
    const load = vi.fn(
      () =>
        new Promise<string[]>((r) => {
          resolve = r;
        })
    );
    const { ctrl } = makeController({ storage: { load, save: vi.fn() } });

    ctrl.markSeen('local'); // marked before the store answered
    resolve(['remote']);
    await Promise.resolve();

    expect(ctrl.hasSeen('local')).toBe(true);
    expect(ctrl.hasSeen('remote')).toBe(true);
  });

  it('fails open when the async load rejects (no crash, tour stays unseen)', async () => {
    const load = vi.fn(() => Promise.reject(new Error('db down')));
    const { ctrl } = makeController({ storage: { load, save: vi.fn() }, dev: false });
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.hasSeen('welcome')).toBe(false);
  });

  // Persistence reconciliation across the async-load window: writes during the
  // window must NOT save immediately (that would clobber the not-yet-loaded
  // remote store) and must be reconciled into the persisted union on settle.
  it('defers the write during the load window, then persists the merged union', async () => {
    const s = makeAsyncStorage();
    const ctrl = new GuideController({
      storage: s.adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });

    ctrl.markSeen('local'); // written before the store answered
    expect(s.save).not.toHaveBeenCalled(); // must not clobber the remote store yet

    await s.settle(['remote']);
    expect(ctrl.hasSeen('local')).toBe(true);
    expect(ctrl.hasSeen('remote')).toBe(true);
    expect(s.save).toHaveBeenCalledTimes(1);
    // The bug persisted only ['local'], dropping 'remote'. It must be the union.
    expect([...s.store.ids].sort()).toEqual(['local', 'remote']);
  });

  it('does not resurrect an id forgotten during the load window when the merge runs', async () => {
    const s = makeAsyncStorage();
    const ctrl = new GuideController({
      storage: s.adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });

    ctrl.resetSeen('stale'); // forget before the store answered — remote still has it
    await s.settle(['stale', 'keep']);

    expect(ctrl.hasSeen('stale')).toBe(false); // the forget wins over the merge
    expect(ctrl.hasSeen('keep')).toBe(true);
    expect([...s.store.ids]).toEqual(['keep']); // and is what's persisted
  });

  it('drops the whole remote set when resetSeen() clears all during the load window', async () => {
    const s = makeAsyncStorage();
    const ctrl = new GuideController({
      storage: s.adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });

    ctrl.markSeen('local');
    ctrl.resetSeen(); // clear-all before the store answered
    await s.settle(['remote-a', 'remote-b']);

    expect(ctrl.seenIds).toEqual([]); // clear-all supersedes the loaded set
    expect(s.store.ids).toEqual([]);
  });

  it('leaves the store untouched when nothing is written during the load window', async () => {
    const s = makeAsyncStorage();
    const ctrl = new GuideController({
      storage: s.adapter,
      overlayStack: makeOverlayStack(),
      dev: false
    });

    await s.settle(['a', 'b']); // pure load, no writes
    expect(ctrl.hasSeen('a')).toBe(true);
    expect(s.save).not.toHaveBeenCalled(); // no write-amplification of what we just read
  });
});
