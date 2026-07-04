import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the auto-bootstrap contract: applying a mint must register the built-in
 * set on demand, so a consumer never has to call `registerDefaultMints()` by hand.
 * Button defaults to `mint="scale"`, so without this every button in a downstream
 * app would log "Unknown mint: scale" and get no hover animation.
 *
 * The blocks package runs vitest in the `node` environment (no DOM). Stubbing
 * `window.matchMedia` to report reduced motion makes each micro-interaction's
 * `init()` early-return before it touches the element, so a bare object stands in
 * for the HTMLElement — we only assert on registration, not on the DOM effect.
 */
describe('mintRegistry auto-bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers the built-in mints lazily on the first apply()', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mintRegistry } = await import('./registry');

    // Registration is lazy: a freshly loaded module has not registered anything.
    expect(mintRegistry.has('scale')).toBe(false);

    mintRegistry.apply({} as HTMLElement, 'scale');

    expect(mintRegistry.has('scale')).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still warns loudly on a genuinely unknown mint name', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mintRegistry } = await import('./registry');

    mintRegistry.apply({} as HTMLElement, 'not-a-real-mint');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown mint: not-a-real-mint'));
  });

  it('registerDefaultMints() registers the full built-in set', async () => {
    const { mintRegistry } = await import('./registry');
    const { registerDefaultMints } = await import('./presets');

    registerDefaultMints();

    for (const name of [
      'scale',
      'translate',
      'rotate',
      'glow',
      'bounce',
      'pulse',
      'shake',
      'wiggle',
      'ripple',
      'composite'
    ]) {
      expect(mintRegistry.has(name)).toBe(true);
    }
  });
});
