import type { MicroInteractionConfig, Mint, MintFactory } from './types';

/**
 * Micro-interaction engine + the statically-shipped default effect (scale).
 *
 * This module split is load-bearing for tree-shaking: everything in this file
 * ships statically with components that import `scaleMint` (Button's mint
 * default), while the per-effect registrations stay in
 * `./micro-interactions.ts`, which is only reachable through the
 * demand-loaded `./presets.ts` chunk. Rollup assigns a shared module's whole
 * used-export-set to the chunk that statically owns it — if the registrations
 * lived in this file, `registerMicroInteractions` (used by the lazy presets
 * chunk) would be pulled into every Button consumer's initial bundle again.
 * Add future statically-defaulted effects here (or in their own module),
 * never in `micro-interactions.ts`.
 */

/**
 * Check if user prefers reduced motion
 * @internal Shared with ./micro-interactions.ts; not part of the public API.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Generic micro-interaction factory
 */
export function createMicroInteraction(
  className: string,
  defaultConfig: MicroInteractionConfig = {}
): Mint<MicroInteractionConfig> {
  return {
    init(el, config = {}) {
      // Merge default config with provided config
      const finalConfig = { ...defaultConfig, ...config };

      // Skip if disabled or prefers reduced motion
      if (finalConfig.disabled || prefersReducedMotion()) return;

      const trigger = finalConfig.trigger || 'hover';
      const duration = finalConfig.duration || 200;
      const delay = finalConfig.delay || 0;

      // Determine event based on trigger
      const eventMap = {
        hover: 'mouseenter',
        click: 'click',
        focus: 'focus',
        load: 'load'
      };
      const event = eventMap[trigger] || 'mouseenter';

      const handler = () => {
        // Skip if this specific animation is already running
        const animatingAttr = `data-animating-${className}`;
        if (el.getAttribute(animatingAttr) === 'true') return;

        // Apply delay if specified
        const applyAnimation = () => {
          el.setAttribute(animatingAttr, 'true');

          // Add dynamic styles if intensity is specified
          if (finalConfig.intensity && className.includes('scale')) {
            el.style.setProperty('--scale-intensity', finalConfig.intensity.toString());
          }

          el.classList.add(className);

          const cleanup = () => {
            el.classList.remove(className);
            el.removeAttribute(animatingAttr);
            el.style.removeProperty('--scale-intensity');
            el.removeEventListener('animationend', cleanup);
            el.removeEventListener('transitionend', cleanup);
          };

          el.addEventListener('animationend', cleanup, { once: true });
          el.addEventListener('transitionend', cleanup, { once: true });

          // Fallback timeout
          setTimeout(cleanup, duration + 50);
        };

        if (delay > 0) {
          setTimeout(applyAnimation, delay);
        } else {
          applyAnimation();
        }
      };

      // Special handling for load trigger
      if (trigger === 'load') {
        // Execute immediately if element is already loaded
        requestAnimationFrame(() => handler());
      } else {
        el.addEventListener(event, handler, { passive: true });
      }

      // Store cleanup function
      this.destroy = () => {
        if (event !== 'load') {
          el.removeEventListener(event, handler);
        }
      };
    }
  };
}

/**
 * The `scale` micro-interaction factory, exported standalone so components
 * whose mint *default* is `'scale'` (Button) can import it directly and pass
 * it as a fallback: `mintRegistry.apply(el, mint, { scale: scaleMint })`.
 * That is the `resolveIcon` tree-shaking pattern — the default effect ships
 * with the component; the rest of the built-in set stays demand-loaded.
 * `registerDefaultMints()` registers this same factory, so the registry path
 * and the fallback path are behaviour-identical.
 */
export const scaleMint: MintFactory<MicroInteractionConfig> = (config) =>
  createMicroInteraction('blocks-mint-scale', {
    trigger: 'hover',
    duration: 200,
    ...config
  });
