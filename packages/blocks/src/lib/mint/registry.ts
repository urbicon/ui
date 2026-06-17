import type { Mint, MintConfig, MintFactory, MintProp } from './types';

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

  /** Get a mint factory by name */
  get(name: string): MintFactory | undefined {
    return this.mints.get(name);
  }

  /** Check if a mint is registered */
  has(name: string): boolean {
    return this.mints.has(name);
  }

  /** Apply mints to an element using polymorphic input */
  apply(el: HTMLElement, mint: MintProp): () => void {
    const mintDefinitions = this.normalizeMintProp(mint);
    const elementMints = new Map<string, Mint>();
    const cleanupFunctions: Array<() => void> = [];

    mintDefinitions.forEach((mintDef) => {
      const name = typeof mintDef === 'string' ? mintDef : mintDef.name;
      const config = typeof mintDef === 'object' ? mintDef.config : undefined;

      const factory = this.get(name);
      if (!factory) {
        console.warn(`[MintRegistry] Unknown mint: ${name}`);
        return;
      }

      const mintInstance = factory(config);
      mintInstance.init(el, config);
      elementMints.set(name, mintInstance);

      // Create cleanup function
      const cleanup = () => {
        mintInstance.destroy?.(el);
        elementMints.delete(name);
      };
      cleanupFunctions.push(cleanup);
    });

    this.instances.set(el, elementMints);

    // Return combined cleanup function
    return () => {
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
