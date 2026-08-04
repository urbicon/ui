// @vitest-environment jsdom
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollSpy } from './scroll-spy.svelte';

// Covers the 2026-08 move from `observe()` + `$effect` to `createSubscriber`.
//
// The contract that changed is *when the listener exists*: it used to be
// whenever a call site remembered to write `$effect(() => spy.observe())`, and
// is now "for as long as somebody reads `active`". That is the property worth
// testing — plus the sticky latch and the SSR guard, both of which are easy to
// lose in a rewrite.

let addSpy: ReturnType<typeof vi.spyOn>;
let removeSpy: ReturnType<typeof vi.spyOn>;

const scrollCalls = (calls: unknown[][]) => calls.filter((call) => call[0] === 'scroll').length;

/** Registered scroll listeners minus removed ones. */
const liveScrollListeners = () =>
  scrollCalls(addSpy.mock.calls as unknown[][]) - scrollCalls(removeSpy.mock.calls as unknown[][]);

/** Places `id` at `top` px so the 30%-of-viewport rule is decidable. */
function section(id: string, top: number) {
  const el = document.createElement('div');
  el.id = id;
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  addSpy = vi.spyOn(window, 'addEventListener');
  removeSpy = vi.spyOn(window, 'removeEventListener');
  window.innerHeight = 1000; // trigger line = 300
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ScrollSpy — the listener follows the readers', () => {
  it('attaches no listener while nobody reads `active`', () => {
    const cleanup = $effect.root(() => {
      const spy = new ScrollSpy(() => ['a']);
      $effect(() => {
        // deliberately reads something else
        void spy;
      });
    });
    flushSync();
    expect(liveScrollListeners()).toBe(0);
    cleanup();
  });

  it('attaches once an effect reads `active`, and detaches when it is destroyed', () => {
    section('a', 100);
    const cleanup = $effect.root(() => {
      const spy = new ScrollSpy(() => ['a']);
      $effect(() => {
        void spy.active;
      });
    });
    flushSync();
    expect(liveScrollListeners()).toBe(1);

    cleanup();
    flushSync();
    expect(liveScrollListeners()).toBe(0);
  });

  it('two readers share ONE listener', () => {
    section('a', 100);
    const cleanup = $effect.root(() => {
      const spy = new ScrollSpy(() => ['a']);
      $effect(() => void spy.active);
      $effect(() => void spy.active);
    });
    flushSync();
    expect(liveScrollListeners()).toBe(1);
    cleanup();
  });
});

describe('ScrollSpy — which section is active', () => {
  it('the last section above the trigger line wins', () => {
    section('a', 100);
    section('b', 200);
    section('c', 800); // below the 300 line
    const spy = new ScrollSpy(() => ['a', 'b', 'c']);
    expect(spy.active).toBe('b');
  });

  it('sticks at the last match when everything moves below the line', () => {
    const a = section('a', 100);
    const spy = new ScrollSpy(() => ['a']);
    expect(spy.active).toBe('a');

    a.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
    expect(spy.active).toBe('a'); // latched, not reset to ''
  });

  it('is empty before any section crosses the line', () => {
    section('a', 900);
    const spy = new ScrollSpy(() => ['a']);
    expect(spy.active).toBe('');
  });

  it('tracks a reactive id list without the call site voiding it', () => {
    section('a', 100);
    section('b', 200);
    const cleanup = $effect.root(() => {
      let ids = $state<string[]>(['a']);
      const spy = new ScrollSpy(() => ids);
      const seen: string[] = [];
      $effect(() => {
        seen.push(spy.active);
      });
      flushSync();
      expect(seen).toEqual(['a']);

      ids = ['a', 'b'];
      flushSync();
      expect(seen).toEqual(['a', 'b']);
    });
    cleanup();
  });
});

describe('ScrollSpy — SSR', () => {
  it('reading `active` without a DOM neither throws nor listens', () => {
    const doc = globalThis.document;
    // @ts-expect-error deliberately removing the DOM to model the server
    delete globalThis.document;
    try {
      const spy = new ScrollSpy(() => ['a']);
      expect(spy.active).toBe('');
      expect(liveScrollListeners()).toBe(0);
    } finally {
      globalThis.document = doc;
    }
  });
});
