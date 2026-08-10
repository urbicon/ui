import { registerComposite } from './compose';
import { registerMicroInteractions } from './micro-interactions';
import { mintRegistry } from './registry';
import { registerRipple } from './ripple';

let defaultMintsRegistered = false;

/**
 * Register all default mints (scale, translate, rotate, glow, bounce, pulse, shake, ripple, composite).
 * Safe to call multiple times – subsequent calls are no-ops.
 *
 * All registrations go through `registerBuiltin` (register-if-absent), so a
 * consumer `register()` override for a built-in name ALWAYS survives — no
 * matter whether the override ran before this call or while the demand-load
 * that triggers it was still in flight.
 */
export function registerDefaultMints(): void {
  if (defaultMintsRegistered) return;
  defaultMintsRegistered = true;

  registerMicroInteractions(mintRegistry);
  registerRipple(mintRegistry);
  registerComposite(mintRegistry);
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
