import type { mintRegistry } from './registry';
import type { Mint, RippleConfig } from './types';

/**
 * Material Design inspired ripple effect
 */
export function createRippleMint(defaultConfig: RippleConfig = {}): Mint<RippleConfig> {
  return {
    init(el, config = {}) {
      // Merge configs
      const finalConfig = { ...defaultConfig, ...config };

      if (finalConfig.disabled) return;

      // Ensure position context
      const position = window.getComputedStyle(el).position;
      if (position === 'static') {
        el.style.position = 'relative';
      }

      // Ensure overflow hidden
      el.style.overflow = 'hidden';

      const handleRipple = (event: MouseEvent) => {
        // Respect prefers-reduced-motion at click time so the user can
        // toggle the OS setting without re-mounting components.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // Throttle ripples
        if (el.querySelector('.blocks-mint-ripple')) return;

        const rect = el.getBoundingClientRect();
        const size = finalConfig.size || Math.max(rect.width, rect.height) * 2;
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'blocks-mint-ripple';
        ripple.style.cssText = `
          position: absolute;
          border-radius: 50%;
          background: ${finalConfig.color || 'currentColor'};
          opacity: ${finalConfig.opacity || 0.2};
          pointer-events: none;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          transform: scale(0);
          will-change: transform, opacity;
        `;

        el.appendChild(ripple);

        // Use Web Animations API for better performance
        const animation = ripple.animate(
          [
            { transform: 'scale(0)', opacity: finalConfig.opacity || 0.2 },
            { transform: 'scale(1)', opacity: 0 }
          ],
          {
            duration: finalConfig.duration || 600,
            easing: finalConfig.easing || 'cubic-bezier(0.4, 0, 0.2, 1)', // matches --blocks-ease-confident
            fill: 'forwards'
          }
        );

        animation.addEventListener('finish', () => {
          ripple.remove();
        });
      };

      el.addEventListener('click', handleRipple, { passive: true });

      this.destroy = () => {
        el.removeEventListener('click', handleRipple);
      };
    }
  };
}

/**
 * Register the ripple mint.
 * Called by registerDefaultMints() - not at module level.
 */
export function registerRipple(registry: typeof mintRegistry): void {
  registry.register('ripple', createRippleMint);
}
