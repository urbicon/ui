import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLocalStorageAdapter,
  GuideController,
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
