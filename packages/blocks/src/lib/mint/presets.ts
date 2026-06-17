import { registerComposite } from './compose';
import { registerMicroInteractions } from './micro-interactions';
import { mintRegistry } from './registry';
import { registerRipple } from './ripple';

let defaultMintsRegistered = false;

/**
 * Register all default mints (scale, translate, rotate, glow, bounce, pulse, shake, ripple, composite).
 * Safe to call multiple times – subsequent calls are no-ops.
 */
export function registerDefaultMints(): void {
  if (defaultMintsRegistered) return;
  defaultMintsRegistered = true;

  registerMicroInteractions(mintRegistry);
  registerRipple(mintRegistry);
  registerComposite(mintRegistry);
}

/**
 * Register playful mints bundle.
 *
 * `bounce`, `shake`, `pulse` and `wiggle` are part of `registerDefaultMints()`
 * (with `prefers-reduced-motion` awareness and proper cleanup). This function
 * is reserved for future playful-only mints; calling it is currently a no-op.
 */
export function registerPlayfulMints(): void {
  // Reserved for future playful-only mints.
}

/**
 * Register business mints bundle
 */
export function registerBusinessMints(): void {
  // Subtle mints for professional UIs
  mintRegistry.register('fade', () => ({
    init(el) {
      el.classList.add('blocks-mint-fade');
    }
  }));

  mintRegistry.register('slide', () => ({
    init(el) {
      el.classList.add('blocks-mint-slide');
    }
  }));
}

// Mint presets for common UI patterns
export const mintPresets = {
  'cta-primary': [
    { name: 'scale', config: { intensity: 1.05 } },
    { name: 'glow', config: { duration: 300 } }
  ],
  'interactive-card': [{ name: 'translate', config: { trigger: 'hover' } }, 'glow'],
  'playful-button': [{ name: 'bounce', config: { trigger: 'click' } }, 'ripple'],
  'subtle-hover': [{ name: 'scale', config: { intensity: 1.02, duration: 150 } }],
  'error-feedback': [{ name: 'shake', config: { trigger: 'click' } }]
} as const;
