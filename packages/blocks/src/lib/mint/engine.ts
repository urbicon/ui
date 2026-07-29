import type { MicroInteractionConfig, Mint, MintFactory, MintSettleSignal } from './types';

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
 * Generic micro-interaction factory.
 *
 * `settles` names the CSS mechanism the class drives (see MintSettleSignal).
 * Omitting it leaves the fallback timeout as the only cleanup — always safe,
 * just less precise than the effect's own end event.
 */
export function createMicroInteraction(
  className: string,
  defaultConfig: MicroInteractionConfig = {},
  settles?: MintSettleSignal
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
      const settleEvent =
        settles && (settles.via === 'animation' ? 'animationend' : 'transitionend');

      // A click on a <label>'s text toggles the control that label owns, so a
      // click-triggered mint has to hear it there — the box is what animates,
      // but it was never the whole click surface (Checkbox/RadioGroup/Toggle
      // put the mint on the box, the click target is the enclosing label).
      // Hover and focus deliberately stay on the element itself: `glow` on a
      // checkbox box must not light up because the pointer is 80 px away on
      // the label text. No-op for elements without a label ancestor.
      const listenOn = trigger === 'click' ? (el.closest('label') ?? el) : el;

      // Tracks the in-flight run so destroy() can end it — an element
      // unmounting mid-animation must not leave its class behind.
      let endCurrentRun: (() => void) | undefined;

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

          let fallbackTimer: ReturnType<typeof setTimeout>;

          // Svelte owns the `class` attribute and rewrites it WHOLE on every
          // re-render — an imperatively added class does not survive that. The
          // effect is invisible in the common case and total in the one that
          // matters: a click-mint on a control whose click changes its own
          // state (Checkbox, Toggle, RadioGroup) was stripped 0.7 ms in, by the
          // very render its own click caused. Measured: the class attribute
          // grew 446 → 461 chars (the checked variant's classes) while the mint
          // class vanished; the cleanup had not run (`data-animating` was still
          // set). So for the length of a run the engine puts its class back.
          // Guarded on absence, so our own re-add can't loop.
          const classGuard = new MutationObserver(() => {
            if (!el.classList.contains(className)) el.classList.add(className);
          });
          classGuard.observe(el, { attributeFilter: ['class'] });

          const cleanup = () => {
            classGuard.disconnect();
            el.classList.remove(className);
            el.removeAttribute(animatingAttr);
            el.style.removeProperty('--scale-intensity');
            clearTimeout(fallbackTimer);
            if (settleEvent) el.removeEventListener(settleEvent, onSettle);
            endCurrentRun = undefined;
          };

          // Only OUR class's own end event counts. Both event types bubble, so
          // without the target guard a child's transition (an icon, a spinner)
          // ends the parent's mint; without the name/property guard the host's
          // own transitions do (the ~20 ms kill described on MintSettleSignal).
          const onSettle = (settleEventObject: Event) => {
            if (settleEventObject.target !== el) return;
            if (
              settles?.via === 'animation' &&
              (settleEventObject as AnimationEvent).animationName !== className
            ) {
              return;
            }
            if (
              settles?.via === 'transition' &&
              !settles.properties.includes((settleEventObject as TransitionEvent).propertyName)
            ) {
              return;
            }
            cleanup();
          };

          if (settleEvent) el.addEventListener(settleEvent, onSettle);

          // Fallback timeout. Cleared by cleanup() — a stale timer that
          // outlives its own run would strip the NEXT run's class.
          fallbackTimer = setTimeout(cleanup, duration + 50);
          endCurrentRun = cleanup;
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
        listenOn.addEventListener(event, handler, { passive: true });
      }

      // Store cleanup function
      this.destroy = () => {
        if (event !== 'load') {
          listenOn.removeEventListener(event, handler);
        }
        endCurrentRun?.();
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
  createMicroInteraction(
    'blocks-mint-scale',
    {
      trigger: 'hover',
      duration: 200,
      ...config
    },
    { via: 'transition', properties: ['transform'] }
  );
