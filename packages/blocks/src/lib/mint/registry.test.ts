import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the mint resolution contract after the resolveIcon-style tree-shaking
 * split (registry no longer statically imports the built-in effects):
 *
 * 1. Auto-bootstrap: applying an unregistered built-in name must demand-load
 *    and register the built-in set, so a consumer never has to call
 *    `registerDefaultMints()` by hand — `<Button mint="ripple">` keeps working.
 *    The load is async now (dynamic import), hence the `vi.waitFor` polling.
 * 2. Fallback path: a statically-imported factory passed via the third
 *    `apply()` argument (Button passes `{ scale: scaleMint }`) applies
 *    synchronously WITHOUT touching or loading the built-in set.
 * 3. Precedence: a registry entry (consumer `register()` override) wins over
 *    the caller's fallback — same order as `resolveIcon(name, fallback)`.
 *
 * The blocks package runs vitest in the `node` environment (no DOM). Stubbing
 * `window.matchMedia` to report reduced motion makes each micro-interaction's
 * `init()` early-return before it touches the element, so a bare object stands
 * in for the HTMLElement — we only assert on registration/resolution, not on
 * the DOM effect.
 */
describe('mintRegistry resolution', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registerDefaultMints registers exactly the BUILTIN_MINT_NAMES set', async () => {
    // The MintName union derives from BUILTIN_MINT_NAMES; this is the drift
    // guard in the other direction — the constant against the real registry.
    const { mintRegistry } = await import('./registry');
    const { registerDefaultMints } = await import('./presets');
    const { BUILTIN_MINT_NAMES } = await import('./types');

    registerDefaultMints();

    expect([...mintRegistry.list()].sort()).toEqual([...BUILTIN_MINT_NAMES].sort());
  });

  it('demand-loads and registers the built-in mints on the first unresolved apply()', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mintRegistry } = await import('./registry');

    // Registration is lazy: a freshly loaded module has not registered anything.
    expect(mintRegistry.has('scale')).toBe(false);

    mintRegistry.apply({} as HTMLElement, 'scale');

    // The built-in set arrives via dynamic import — async by design.
    await vi.waitFor(() => {
      expect(mintRegistry.has('scale')).toBe(true);
    });
    expect(mintRegistry.has('ripple')).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still warns loudly on a genuinely unknown mint name', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mintRegistry } = await import('./registry');

    mintRegistry.apply({} as HTMLElement, 'not-a-real-mint');

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown mint: not-a-real-mint')
      );
    });
  });

  it('applies a statically-imported fallback synchronously, without loading the built-ins', async () => {
    const { mintRegistry } = await import('./registry');

    const init = vi.fn();
    const fallbackFactory = vi.fn(() => ({ init }));
    const el = {} as HTMLElement;

    const cleanup = mintRegistry.apply(el, 'scale', { scale: fallbackFactory });

    // Synchronous: the default path must not wait for any chunk.
    expect(fallbackFactory).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(el, undefined);

    // The fallback resolution must NOT trigger the built-in demand-load —
    // that is the whole point of the tree-shaking split.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mintRegistry.has('scale')).toBe(false);

    cleanup();
  });

  it('demand-loading the built-ins never clobbers an override registered BEFORE the load', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const { mintRegistry } = await import('./registry');

    const overrideInit = vi.fn();
    const override = () => ({ init: overrideInit });
    mintRegistry.register('glow', override);

    // Trigger the demand-load via an unrelated built-in name.
    mintRegistry.apply({} as HTMLElement, 'translate');
    await vi.waitFor(() => {
      expect(mintRegistry.has('translate')).toBe(true);
    });

    // registerDefaultMints ran — the consumer's 'glow' must have survived.
    expect(mintRegistry.get('glow')).toBe(override);
    mintRegistry.apply({} as HTMLElement, 'glow');
    expect(overrideInit).toHaveBeenCalledTimes(1);
  });

  it('keeps an override registered WHILE the built-in load is in flight', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const { mintRegistry } = await import('./registry');

    const overrideInit = vi.fn();
    const override = () => ({ init: overrideInit });

    // 'glow' is unknown → queued behind the demand-load …
    mintRegistry.apply({} as HTMLElement, 'glow');
    // … and the consumer registers an override during the fetch window.
    mintRegistry.register('glow', override);

    await vi.waitFor(() => {
      expect(mintRegistry.has('translate')).toBe(true); // built-ins load finished
    });
    // The load must not have clobbered the entry, and the queued application
    // must have resolved to the override, not the built-in.
    expect(mintRegistry.get('glow')).toBe(override);
    expect(overrideInit).toHaveBeenCalledTimes(1);
  });

  it('lets a registered override win over the caller fallback (resolveIcon precedence)', async () => {
    const { mintRegistry } = await import('./registry');

    const overrideInit = vi.fn();
    const fallbackInit = vi.fn();
    mintRegistry.register('scale', () => ({ init: overrideInit }));

    mintRegistry.apply({} as HTMLElement, 'scale', { scale: () => ({ init: fallbackInit }) });

    expect(overrideInit).toHaveBeenCalledTimes(1);
    expect(fallbackInit).not.toHaveBeenCalled();
  });

  it('does not late-apply a demand-loaded mint after cleanup ran', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { mintRegistry } = await import('./registry');

    const init = vi.fn();
    // 'late-mint' is unknown at apply time → queued behind the built-ins load.
    const cleanup = mintRegistry.apply({} as HTMLElement, 'late-mint');
    cleanup();
    // Registered while the load is in flight: without the disposed guard the
    // late pass would init an effect on an element that already unmounted.
    mintRegistry.register('late-mint', () => ({ init }));

    await vi.waitFor(() => {
      expect(mintRegistry.has('scale')).toBe(true); // built-ins load finished
    });
    expect(init).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('mixes synchronous fallback application with demand-loaded names in one apply()', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const { mintRegistry } = await import('./registry');

    const fallbackInit = vi.fn();

    mintRegistry.apply({} as HTMLElement, ['scale', 'glow'], {
      scale: () => ({ init: fallbackInit })
    });

    // 'scale' resolves from the fallback synchronously …
    expect(fallbackInit).toHaveBeenCalledTimes(1);
    // … while 'glow' arrives with the demand-loaded built-in set.
    await vi.waitFor(() => {
      expect(mintRegistry.has('glow')).toBe(true);
    });
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
