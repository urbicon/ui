import { createMicroInteraction, scaleMint } from './engine';
import type { mintRegistry } from './registry';
import type { MicroInteractionConfig } from './types';

/**
 * Built-in micro-interaction registrations.
 *
 * The generic engine (`createMicroInteraction`) and the statically-shipped
 * default (`scaleMint`) live in `./engine.ts` — this module must contain ONLY
 * registration code, because it is reachable exclusively through the
 * demand-loaded `./presets.ts` chunk. Anything defined here would otherwise
 * be dragged back into every component's initial bundle once a statically
 * imported module shared it (Rollup assigns a shared module's whole
 * used-export-set to the chunk that statically owns it).
 */

/**
 * Register all default micro-interaction mints.
 * Called by registerDefaultMints() - not at module level.
 */
export function registerMicroInteractions(registry: typeof mintRegistry): void {
  registry.registerBuiltin('scale', scaleMint);

  registry.registerBuiltin('translate', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-translate',
      {
        trigger: 'hover',
        duration: 200,
        ...config
      },
      { via: 'transition', properties: ['transform'] }
    )
  );

  registry.registerBuiltin('rotate', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-rotate',
      {
        trigger: 'hover',
        duration: 200,
        ...config
      },
      { via: 'transition', properties: ['transform'] }
    )
  );

  registry.registerBuiltin('glow', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-glow',
      {
        trigger: 'hover',
        duration: 300,
        ...config
      },
      { via: 'transition', properties: ['box-shadow'] }
    )
  );

  registry.registerBuiltin('bounce', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-bounce',
      {
        trigger: 'click',
        duration: 600,
        ...config
      },
      { via: 'animation' }
    )
  );

  // pulse needed a hand-written hold-while-hovering special case before the
  // engine's held-trigger model existed; now it is a plain registration. On
  // hover the engine holds the class (the infinite animation runs until the
  // pointer leaves); on click/focus/load it runs once and settles at the
  // iteration boundary — `animationend` never fires on an infinite animation,
  // and the fallback timeout used to strip the class mid-cycle.
  registry.registerBuiltin('pulse', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-pulse',
      {
        trigger: 'hover',
        duration: 1000,
        ...config
      },
      { via: 'animation-iteration' }
    )
  );

  registry.registerBuiltin('shake', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-shake',
      {
        trigger: 'click',
        duration: 500,
        ...config
      },
      { via: 'animation' }
    )
  );

  registry.registerBuiltin('wiggle', (config?: MicroInteractionConfig) =>
    createMicroInteraction(
      'blocks-mint-wiggle',
      {
        trigger: 'hover',
        duration: 500,
        ...config
      },
      { via: 'animation' }
    )
  );
}
