import type { mintRegistry } from './registry';
import type { MicroInteractionConfig, Mint } from './types';

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
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
 * Register all default micro-interaction mints.
 * Called by registerDefaultMints() - not at module level.
 */
export function registerMicroInteractions(registry: typeof mintRegistry): void {
  registry.register('scale', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-scale', {
      trigger: 'hover',
      duration: 200,
      ...config
    })
  );

  registry.register('translate', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-translate', {
      trigger: 'hover',
      duration: 200,
      ...config
    })
  );

  registry.register('rotate', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-rotate', {
      trigger: 'hover',
      duration: 200,
      ...config
    })
  );

  registry.register('glow', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-glow', {
      trigger: 'hover',
      duration: 300,
      ...config
    })
  );

  registry.register('bounce', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-bounce', {
      trigger: 'click',
      duration: 600,
      ...config
    })
  );

  registry.register('pulse', (config?: MicroInteractionConfig) => ({
    init(el, inputConfig = {}) {
      const finalConfig = { trigger: 'hover', ...config, ...inputConfig };

      if (finalConfig.disabled || prefersReducedMotion()) return;

      const trigger = finalConfig.trigger || 'hover';

      if (trigger === 'hover') {
        let isHovering = false;

        const startPulse = () => {
          if (!isHovering) {
            isHovering = true;
            el.classList.add('blocks-mint-pulse');
          }
        };

        const stopPulse = () => {
          if (isHovering) {
            isHovering = false;
            el.classList.remove('blocks-mint-pulse');
          }
        };

        el.addEventListener('mouseenter', startPulse, { passive: true });
        el.addEventListener('mouseleave', stopPulse, { passive: true });

        this.destroy = () => {
          el.removeEventListener('mouseenter', startPulse);
          el.removeEventListener('mouseleave', stopPulse);
          stopPulse();
        };
      } else {
        const standardPulse = createMicroInteraction('blocks-mint-pulse', {
          trigger: trigger as MicroInteractionConfig['trigger'],
          duration: 1000,
          ...config
        });
        return standardPulse.init(el, inputConfig);
      }
    }
  }));

  registry.register('shake', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-shake', {
      trigger: 'click',
      duration: 500,
      ...config
    })
  );

  registry.register('wiggle', (config?: MicroInteractionConfig) =>
    createMicroInteraction('blocks-mint-wiggle', {
      trigger: 'hover',
      duration: 500,
      ...config
    })
  );
}
