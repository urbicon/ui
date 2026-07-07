import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `lockBodyScroll` hands out per-acquisition ownership over a module-global
 * refcount: each call returns an idempotent release, and only that release can
 * decrement the holder's share. The node environment has no DOM, so a minimal
 * `document.body.style` stub is installed before a fresh (dynamic) import —
 * which also resets the module-level count between tests.
 */
describe('lockBodyScroll', () => {
  let bodyStyle: { overflow: string };

  beforeEach(() => {
    vi.resetModules();
    bodyStyle = { overflow: 'auto' };
    vi.stubGlobal('document', { body: { style: bodyStyle } });
  });
  afterEach(() => vi.unstubAllGlobals());

  async function load() {
    return (await import('./overlay')).lockBodyScroll;
  }

  it('hides body overflow on acquire and restores the saved value on release', async () => {
    const lock = await load();
    const release = lock();
    expect(bodyStyle.overflow).toBe('hidden');
    release();
    expect(bodyStyle.overflow).toBe('auto');
  });

  it('keeps the body locked until every holder has released', async () => {
    const lock = await load();
    const releaseA = lock();
    const releaseB = lock();
    releaseA();
    expect(bodyStyle.overflow).toBe('hidden');
    releaseB();
    expect(bodyStyle.overflow).toBe('auto');
  });

  it("releasing twice is a no-op and cannot free another holder's lock", async () => {
    const lock = await load();
    const releaseA = lock();
    const releaseB = lock();
    releaseA();
    releaseA();
    releaseA();
    expect(bodyStyle.overflow).toBe('hidden');
    releaseB();
    expect(bodyStyle.overflow).toBe('auto');
  });

  it('a fresh acquire after full release re-saves the current overflow', async () => {
    const lock = await load();
    lock()();
    bodyStyle.overflow = 'scroll';
    const release = lock();
    expect(bodyStyle.overflow).toBe('hidden');
    release();
    expect(bodyStyle.overflow).toBe('scroll');
  });

  it('returns a no-op release on the server, where document is undefined', async () => {
    vi.stubGlobal('document', undefined);
    vi.resetModules();
    const lock = (await import('./overlay')).lockBodyScroll;
    expect(() => lock()()).not.toThrow();
  });
});

/**
 * `isAnchoredInModalDialog` is a thin DOM probe (`el.closest('dialog')` +
 * `:modal`). The Vitest environment is `node` (no DOM), and the function's
 * module-level `isBrowser = typeof document !== 'undefined'` guard short-circuits
 * when `document` is absent. So we stub a minimal `document` BEFORE a fresh
 * (dynamic) import evaluates that guard, and pass element stubs with controlled
 * `closest`/`matches` to exercise every branch without a real DOM.
 */
describe('isAnchoredInModalDialog', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('document', {});
  });
  afterEach(() => vi.unstubAllGlobals());

  async function load() {
    return (await import('./overlay')).isAnchoredInModalDialog;
  }

  /** An element whose `closest('dialog')` resolves to `dialog`. */
  function anchorIn(dialog: unknown): HTMLElement {
    return {
      closest: (sel: string) => (sel === 'dialog' ? dialog : null)
    } as unknown as HTMLElement;
  }
  /** A `<dialog>` stub whose `:modal` match returns (or throws) per `modal`. */
  function dialogStub(modal: boolean | (() => boolean)): unknown {
    return { matches: typeof modal === 'function' ? modal : () => modal };
  }

  it('returns false for null / undefined anchors (SSR / pre-bind:this / teardown)', async () => {
    const fn = await load();
    expect(fn(null)).toBe(false);
    expect(fn(undefined)).toBe(false);
  });

  it('returns false when there is no <dialog> ancestor', async () => {
    const fn = await load();
    expect(fn(anchorIn(null))).toBe(false);
  });

  it('returns true inside an OPEN modal <dialog>', async () => {
    const fn = await load();
    expect(fn(anchorIn(dialogStub(true)))).toBe(true);
  });

  it('returns false inside a non-modal <dialog> (opened via show())', async () => {
    const fn = await load();
    expect(fn(anchorIn(dialogStub(false)))).toBe(false);
  });

  it('returns false when matches(":modal") throws (pre-Popover-API engine)', async () => {
    const fn = await load();
    const throwing = dialogStub(() => {
      throw new SyntaxError("':modal' is not a valid selector");
    });
    expect(fn(anchorIn(throwing))).toBe(false);
  });

  it('returns false on the server, where document is undefined', async () => {
    vi.stubGlobal('document', undefined);
    vi.resetModules();
    const fn = (await import('./overlay')).isAnchoredInModalDialog;
    // Even with a would-be modal dialog ancestor, the isBrowser guard wins.
    expect(fn(anchorIn(dialogStub(true)))).toBe(false);
  });
});
