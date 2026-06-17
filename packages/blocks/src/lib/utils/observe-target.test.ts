import { describe, expect, it } from 'vitest';
import { observeTargetResolution } from './observe-target';

describe('observeTargetResolution', () => {
  it('returns a callable no-op disconnect when there is no DOM (SSR / node)', () => {
    // The test env is `node` (no document / MutationObserver), so the watcher cannot attach.
    // It must degrade to a safe no-op rather than throw, and never invoke onChange. The real
    // appear/disappear behaviour is exercised by the Playwright suite against a live DOM.
    let calls = 0;
    const disconnect = observeTargetResolution(
      () => null,
      () => calls++
    );
    expect(typeof disconnect).toBe('function');
    expect(() => disconnect()).not.toThrow();
    expect(calls).toBe(0);
  });
});
