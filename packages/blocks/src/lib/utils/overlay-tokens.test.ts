import { quintOut } from 'svelte/easing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getOverlayMotion,
  maxTransitionDurationMs,
  OVERLAY_MOTION_DEFAULTS
} from './overlay-tokens';

describe('overlay-tokens', () => {
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalDocument = globalThis.document;

  const originalWindow = (globalThis as { window?: Window }).window;

  beforeEach(() => {
    // Stub window, document.documentElement + getComputedStyle so the module
    // runs through the "browser" path. Vitest is configured with the `node`
    // environment, so we synthesize the bits the module needs. Tests for the
    // SSR-safe path explicitly delete `window`.
    Object.defineProperty(globalThis, 'window', {
      value: {} as unknown as Window,
      configurable: true,
      writable: true
    });
    Object.defineProperty(globalThis, 'document', {
      value: { documentElement: {} as HTMLElement },
      configurable: true,
      writable: true
    });
    globalThis.getComputedStyle = vi.fn(
      () =>
        ({
          getPropertyValue: () => ''
        }) as unknown as CSSStyleDeclaration
    );
  });

  afterEach(() => {
    if (originalGetComputedStyle) globalThis.getComputedStyle = originalGetComputedStyle;
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        configurable: true,
        writable: true
      });
    }
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true
      });
    } else {
      // @ts-expect-error — restore "no window" state
      delete globalThis.window;
    }
  });

  it('returns defaults when no custom properties are set', () => {
    const motion = getOverlayMotion();
    expect(motion.enterDuration).toBe(OVERLAY_MOTION_DEFAULTS.enterDuration);
    expect(motion.exitDuration).toBe(OVERLAY_MOTION_DEFAULTS.exitDuration);
    expect(motion.panelScaleStart).toBe(OVERLAY_MOTION_DEFAULTS.panelScaleStart);
    expect(motion.panelFlyDistance).toBe(OVERLAY_MOTION_DEFAULTS.panelFlyDistance);
    expect(motion.easing).toBe(quintOut);
  });

  it('parses ms / s duration values from CSS custom properties', () => {
    const values: Record<string, string> = {
      '--blocks-overlay-enter-duration': '300ms',
      '--blocks-overlay-exit-duration': '0.25s',
      '--blocks-overlay-panel-scale-start': '0.9',
      '--blocks-overlay-panel-fly-distance': '480px'
    };
    globalThis.getComputedStyle = vi.fn(
      () =>
        ({
          getPropertyValue: (name: string) => values[name] ?? ''
        }) as unknown as CSSStyleDeclaration
    );
    const motion = getOverlayMotion();
    expect(motion.enterDuration).toBe(300);
    expect(motion.exitDuration).toBe(250);
    expect(motion.panelScaleStart).toBe(0.9);
    expect(motion.panelFlyDistance).toBe(480);
  });

  it('per-instance override wins over CSS custom property', () => {
    globalThis.getComputedStyle = vi.fn(
      () =>
        ({
          getPropertyValue: () => '300ms'
        }) as unknown as CSSStyleDeclaration
    );
    const motion = getOverlayMotion({ enterDuration: 50 });
    expect(motion.enterDuration).toBe(50);
    // Other properties still come from CSS
    expect(motion.exitDuration).toBe(300);
  });

  it('falls back to defaults for unparseable values', () => {
    globalThis.getComputedStyle = vi.fn(
      () =>
        ({
          getPropertyValue: () => 'not-a-number'
        }) as unknown as CSSStyleDeclaration
    );
    const motion = getOverlayMotion();
    expect(motion.enterDuration).toBe(OVERLAY_MOTION_DEFAULTS.enterDuration);
  });

  it('is SSR-safe when window is undefined', () => {
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    const motion = getOverlayMotion();
    expect(motion).toEqual({
      ...OVERLAY_MOTION_DEFAULTS,
      easing: OVERLAY_MOTION_DEFAULTS.easing
    });
  });

  it('SSR-safe path still honors per-instance override', () => {
    // @ts-expect-error — simulate SSR
    delete globalThis.window;
    const motion = getOverlayMotion({ enterDuration: 999 });
    expect(motion.enterDuration).toBe(999);
    expect(motion.exitDuration).toBe(OVERLAY_MOTION_DEFAULTS.exitDuration);
  });

  describe('maxTransitionDurationMs', () => {
    const el = {} as Element;

    const stubTransitionDuration = (value: string) => {
      globalThis.getComputedStyle = vi.fn(
        () => ({ transitionDuration: value }) as unknown as CSSStyleDeclaration
      );
    };

    it('returns the longest entry of a comma list (the slowest property governs)', () => {
      stubTransitionDuration('0.15s, 0.6s, 0.15s');
      expect(maxTransitionDurationMs(el)).toBe(600);
    });

    it('parses ms entries and single values', () => {
      stubTransitionDuration('250ms');
      expect(maxTransitionDurationMs(el)).toBe(250);
    });

    it('returns 0 for a zero/empty/absent transition', () => {
      stubTransitionDuration('0s');
      expect(maxTransitionDurationMs(el)).toBe(0);
      stubTransitionDuration('');
      expect(maxTransitionDurationMs(el)).toBe(0);
      expect(maxTransitionDurationMs(null)).toBe(0);
      expect(maxTransitionDurationMs(undefined)).toBe(0);
    });

    it('is SSR-safe when window is undefined', () => {
      // @ts-expect-error — simulate SSR
      delete globalThis.window;
      expect(maxTransitionDurationMs(el)).toBe(0);
    });
  });
});
