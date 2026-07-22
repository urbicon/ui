import { loadBuiltinMints, mintRegistry } from './registry';
import type { CompositeConfig, Mint } from './types';

/**
 * Compose multiple mints into one.
 *
 * String members resolve like `mintRegistry.apply` does: a registry entry
 * (consumer override or loaded built-in) applies synchronously; unresolved
 * names demand-load the built-in set once and init after the load (skipped if
 * the composite was destroyed in the meantime). A name that is still unknown
 * after the load warns loudly instead of silently dropping the effect.
 */
export function composeMints(...mints: Array<Mint | string>): Mint {
  return {
    init(el, config) {
      const instances: Mint[] = [];
      let disposed = false;

      const applyInstance = (instance: Mint) => {
        instance.init(el, config);
        instances.push(instance);
      };

      const unresolved: string[] = [];

      mints.forEach((mint) => {
        if (typeof mint === 'string') {
          const factory = mintRegistry.get(mint);
          if (factory) {
            applyInstance(factory(config));
          } else {
            unresolved.push(mint);
          }
        } else {
          applyInstance(mint);
        }
      });

      if (unresolved.length > 0) {
        void loadBuiltinMints().then(() => {
          if (disposed) return;
          unresolved.forEach((name) => {
            const factory = mintRegistry.get(name);
            if (!factory) {
              console.warn(`[composeMints] Unknown mint: ${name}`);
              return;
            }
            applyInstance(factory(config));
          });
        });
      }

      this.destroy = () => {
        disposed = true;
        instances.forEach((instance) => {
          instance.destroy?.(el);
        });
      };
    }
  };
}

/**
 * Create a composite mint that applies multiple mints
 */
export function createCompositeMint(): Mint<CompositeConfig> {
  return {
    init(el, config) {
      if (!config?.mints) return;

      const cleanup = mintRegistry.apply(
        el,
        config.mints as Parameters<typeof mintRegistry.apply>[1]
      );

      this.destroy = cleanup;
    }
  };
}

/**
 * Register the composite mint.
 * Called by registerDefaultMints() - not at module level.
 */
export function registerComposite(registry: typeof mintRegistry): void {
  registry.registerBuiltin('composite', createCompositeMint);
}
