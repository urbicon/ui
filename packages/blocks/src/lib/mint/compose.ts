import { mintRegistry } from './registry';
import type { CompositeConfig, Mint } from './types';

/**
 * Compose multiple mints into one
 */
export function composeMints(...mints: Array<Mint | string>): Mint {
  return {
    init(el, config) {
      const instances: Mint[] = [];

      mints.forEach((mint) => {
        if (typeof mint === 'string') {
          const factory = mintRegistry.get(mint);
          if (factory) {
            const instance = factory(config);
            instance.init(el, config);
            instances.push(instance);
          }
        } else {
          mint.init(el, config);
          instances.push(mint);
        }
      });

      this.destroy = () => {
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
  registry.register('composite', createCompositeMint);
}
