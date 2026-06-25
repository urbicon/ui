import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
