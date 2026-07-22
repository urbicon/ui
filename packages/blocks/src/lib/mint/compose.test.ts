import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards composeMints' string-member resolution after the tree-shaking split:
 * string members must resolve through the same demand-load as
 * `mintRegistry.apply` (previously the auto-bootstrap in apply() made the
 * built-ins available synchronously; a plain `registry.get()` would now be a
 * silent no-op for any built-in name that was never loaded).
 *
 * Node environment (no DOM): `window.matchMedia` is stubbed to report
 * "no reduced motion" where a real effect init is asserted (it then attaches
 * its trigger listener on the element stub), and to report reduced motion
 * where only registration is asserted.
 */
describe('composeMints string resolution', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const elementStub = () =>
    ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as HTMLElement;

  it('demand-loads built-ins for string members and inits them after the load', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const { composeMints } = await import('./compose');
    const { mintRegistry } = await import('./registry');

    const el = elementStub();
    composeMints('glow').init(el);

    // Not yet registered — nothing applied synchronously.
    expect(el.addEventListener).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mintRegistry.has('glow')).toBe(true);
    });
    await vi.waitFor(() => {
      // The glow micro-interaction attached its hover trigger — the effect
      // genuinely arrived, it was not silently dropped.
      expect(el.addEventListener).toHaveBeenCalledWith('mouseenter', expect.any(Function), {
        passive: true
      });
    });
  });

  it('warns loudly on a composite member that stays unknown after the load', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { composeMints } = await import('./compose');

    composeMints('not-a-real-mint').init({} as HTMLElement);

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown mint: not-a-real-mint')
      );
    });
  });

  it('does not late-init string members after the composite was destroyed', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    const { composeMints } = await import('./compose');
    const { mintRegistry } = await import('./registry');

    const el = elementStub();
    const composite = composeMints('glow');
    composite.init(el);
    composite.destroy?.(el);

    await vi.waitFor(() => {
      expect(mintRegistry.has('glow')).toBe(true); // load finished anyway
    });
    expect(el.addEventListener).not.toHaveBeenCalled();
  });
});
