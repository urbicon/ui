import type { Mint, MintConfig, MintFactory, MintProp } from './types';

/**
 * Statically-imported fallback factories, keyed by mint name.
 *
 * Components pass their *default* mint's factory here — Button imports
 * `scaleMint` directly and calls `mintRegistry.apply(el, mint, { scale:
 * scaleMint })` — so the default effect ships tree-shaken with the component
 * instead of dragging the whole built-in set (micro-interactions, the ripple
 * engine, compose, presets — ~3.9 KB min) into every consumer bundle. Same
 * precedence as `resolveIcon(name, fallback)`: a registry entry (consumer
 * override / loaded built-in) wins, the direct import is only the fallback.
 * See docs/ICON-DESIGN.md → "Icon resolution & tree-shaking".
 */
export type MintFallbacks = Readonly<Partial<Record<string, MintFactory>>>;

// Lazily loads + registers the built-in mints (scale, glow, ripple, …) the
// first time a name resolves neither from the registry nor from the caller's
// fallbacks. The dynamic import() keeps the built-in set out of the static
// module graph of every mint-consuming component — an app that only ever uses
// component defaults never loads it at all; an app that passes a dynamic mint
// name (mint="ripple", presets, composite) fetches it once on first use.
//
// The registry ↔ presets import is cyclic but inert: presets dereferences the
// registry binding only at call time, and this side is a dynamic import, so
// module initialisation completes cleanly regardless of load order.
let builtinsLoading: Promise<void> | undefined;

/**
 * @internal Shared with ./compose.ts so composite string members resolve
 * through the same demand-load; not part of the public API.
 */
export function loadBuiltinMints(): Promise<void> {
  builtinsLoading ??= import('./presets').then((presets) => {
    presets.registerDefaultMints();
  });
  return builtinsLoading;
}

class MintRegistry {
  private mints = new Map<string, MintFactory>();
  private instances = new WeakMap<HTMLElement, Map<string, Mint>>();

  /** Register a mint globally */
  register<TConfig extends MintConfig = MintConfig>(
    name: string,
    factory: MintFactory<TConfig>
  ): void {
    this.mints.set(name, factory as MintFactory);
  }

  /**
   * Register a built-in mint — only if the name is still free. Used by the
   * built-in set (`registerDefaultMints()` and the opt-in bundles) so the
   * demand-load NEVER clobbers a consumer override: a `register()` entry
   * survives regardless of whether it ran before or during the load. A later
   * explicit `register()` call still overrides as before.
   */
  registerBuiltin<TConfig extends MintConfig = MintConfig>(
    name: string,
    factory: MintFactory<TConfig>
  ): void {
    if (!this.mints.has(name)) {
      this.mints.set(name, factory as MintFactory);
    }
  }

  /** Get a mint factory by name */
  get(name: string): MintFactory | undefined {
    return this.mints.get(name);
  }

  /** Check if a mint is registered */
  has(name: string): boolean {
    return this.mints.has(name);
  }

  /**
   * Apply mints to an element using polymorphic input.
   *
   * Resolution order per name: registry entry (consumer `register()` override
   * or an already-loaded built-in) → `fallbacks` (statically imported by the
   * caller) → lazy-loaded built-in set. Names that resolve synchronously are
   * applied synchronously; unresolved names wait for the built-ins chunk
   * (one-time microtask + fetch). Events firing inside that fetch window are
   * NOT replayed — on a slow network, a click landing before a demand-loaded
   * click-triggered mint (ripple, shake) finished loading is lost for that
   * effect. Acceptable for decorative effects (documented contract, see
   * mint/README.md); consumers who need first-interaction guarantees register
   * the effect statically up front (`registerDefaultMints()`).
   */
  apply(el: HTMLElement, mint: MintProp, fallbacks?: MintFallbacks): () => void {
    const mintDefinitions = this.normalizeMintProp(mint);
    const elementMints = new Map<string, Mint>();
    const cleanupFunctions: Array<() => void> = [];
    let disposed = false;

    const applyOne = (name: string, config: MintConfig | undefined, factory: MintFactory) => {
      const mintInstance = factory(config);
      mintInstance.init(el, config);
      elementMints.set(name, mintInstance);

      cleanupFunctions.push(() => {
        mintInstance.destroy?.(el);
        elementMints.delete(name);
      });
    };

    const unresolved: Array<{ name: string; config?: MintConfig }> = [];

    mintDefinitions.forEach((mintDef) => {
      const name = typeof mintDef === 'string' ? mintDef : mintDef.name;
      const config = typeof mintDef === 'object' ? mintDef.config : undefined;

      const factory = this.get(name) ?? fallbacks?.[name];
      if (factory) {
        applyOne(name, config, factory);
      } else {
        unresolved.push({ name, config });
      }
    });

    if (unresolved.length > 0) {
      void loadBuiltinMints().then(() => {
        if (disposed) return;
        unresolved.forEach(({ name, config }) => {
          const factory = this.get(name) ?? fallbacks?.[name];
          if (!factory) {
            console.warn(`[MintRegistry] Unknown mint: ${name}`);
            return;
          }
          applyOne(name, config, factory);
        });
      });
    }

    this.instances.set(el, elementMints);

    // Return combined cleanup function
    return () => {
      disposed = true;
      cleanupFunctions.forEach((fn) => {
        fn();
      });
      this.instances.delete(el);
    };
  }

  /** Normalize polymorphic mint prop to consistent format */
  private normalizeMintProp(mint: MintProp): Array<string | { name: string; config?: MintConfig }> {
    if (typeof mint === 'string') {
      return [mint];
    }

    if (Array.isArray(mint)) {
      return mint;
    }

    if (mint && typeof mint === 'object' && 'name' in mint && typeof mint.name === 'string') {
      return [mint];
    }

    return [];
  }

  /** Update mint config for an element */
  update(el: HTMLElement, name: string, config: MintConfig): void {
    const elementMints = this.instances.get(el);
    const mint = elementMints?.get(name);

    if (mint?.update) {
      mint.update(el, config);
    }
  }

  /** List all registered mint names */
  list(): string[] {
    return Array.from(this.mints.keys());
  }

  /** Clear all mints */
  clear(): void {
    this.mints.clear();
  }
}

// Singleton instance
export const mintRegistry = new MintRegistry();
