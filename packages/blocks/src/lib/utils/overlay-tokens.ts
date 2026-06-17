/**
 * Overlay animation tokens (XC-11).
 *
 * Single JS source of truth that mirrors the CSS custom properties in
 * `style/interaction.css`. Svelte transitions need numeric inputs at the
 * call site, so we expose the same values as constants here and as
 * runtime getters that read the live CSS custom property — useful when
 * a consumer overrides a token via `BlocksProvider` or a theme.
 *
 * Components should call `getOverlayMotion()` (returns the resolved
 * numeric values for the current document) over hard-coding numbers.
 * The optional `override` argument carries per-instance values from a
 * component's `transitionDuration` / `transitionEasing` props.
 *
 * Reduced motion: `getOverlayMotion()` reads the live CSS — so the
 * `@media (prefers-reduced-motion: reduce)` branch in `interaction.css`
 * automatically collapses durations and distances to zero. Components
 * never need to consult the media query themselves.
 */

import { quintOut } from 'svelte/easing';

export type EasingFn = (t: number) => number;

export interface OverlayMotion {
  /** Enter duration in ms (panel + backdrop). */
  enterDuration: number;
  /** Exit duration in ms (panel + backdrop). */
  exitDuration: number;
  /** Backdrop enter duration in ms — usually = enterDuration. */
  backdropEnterDuration: number;
  /** Backdrop exit duration in ms — usually = exitDuration. */
  backdropExitDuration: number;
  /** Easing for panel and backdrop transitions. */
  easing: EasingFn;
  /** Panel scale-in start value (0..1). 1 disables the scale effect. */
  panelScaleStart: number;
  /** Panel fly-in distance in px (translated along the placement axis). */
  panelFlyDistance: number;
}

export interface OverlayMotionOverride {
  enterDuration?: number;
  exitDuration?: number;
  backdropEnterDuration?: number;
  backdropExitDuration?: number;
  easing?: EasingFn;
  panelScaleStart?: number;
  panelFlyDistance?: number;
}

/** Defaults mirror the CSS custom properties in `interaction.css`. */
export const OVERLAY_MOTION_DEFAULTS: OverlayMotion = {
  enterDuration: 200,
  exitDuration: 180,
  backdropEnterDuration: 200,
  backdropExitDuration: 180,
  easing: quintOut,
  panelScaleStart: 0.96,
  panelFlyDistance: 320
};

function parseDurationMs(value: string, fallback: number): number {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n : fallback;
  }
  if (trimmed.endsWith('s')) {
    const n = parseFloat(trimmed);
    return Number.isFinite(n) ? n * 1000 : fallback;
  }
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function parsePx(value: string, fallback: number): number {
  if (!value) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseUnit(value: string, fallback: number): number {
  if (!value) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Read the current overlay motion settings.
 *
 * SSR-safe: when `window` is unavailable, returns the static defaults.
 * Easing is not read from CSS (no portable cross-browser parse of
 * `cubic-bezier()` arguments) — it stays at the JS default and can be
 * overridden per-instance via the `override` argument.
 */
export function getOverlayMotion(override?: OverlayMotionOverride): OverlayMotion {
  if (typeof window === 'undefined') {
    return { ...OVERLAY_MOTION_DEFAULTS, ...override };
  }
  const computed = getComputedStyle(document.documentElement);
  return {
    enterDuration:
      override?.enterDuration ??
      parseDurationMs(
        computed.getPropertyValue('--blocks-overlay-enter-duration'),
        OVERLAY_MOTION_DEFAULTS.enterDuration
      ),
    exitDuration:
      override?.exitDuration ??
      parseDurationMs(
        computed.getPropertyValue('--blocks-overlay-exit-duration'),
        OVERLAY_MOTION_DEFAULTS.exitDuration
      ),
    backdropEnterDuration:
      override?.backdropEnterDuration ??
      parseDurationMs(
        computed.getPropertyValue('--blocks-overlay-backdrop-enter-duration'),
        OVERLAY_MOTION_DEFAULTS.backdropEnterDuration
      ),
    backdropExitDuration:
      override?.backdropExitDuration ??
      parseDurationMs(
        computed.getPropertyValue('--blocks-overlay-backdrop-exit-duration'),
        OVERLAY_MOTION_DEFAULTS.backdropExitDuration
      ),
    easing: override?.easing ?? OVERLAY_MOTION_DEFAULTS.easing,
    panelScaleStart:
      override?.panelScaleStart ??
      parseUnit(
        computed.getPropertyValue('--blocks-overlay-panel-scale-start'),
        OVERLAY_MOTION_DEFAULTS.panelScaleStart
      ),
    panelFlyDistance:
      override?.panelFlyDistance ??
      parsePx(
        computed.getPropertyValue('--blocks-overlay-panel-fly-distance'),
        OVERLAY_MOTION_DEFAULTS.panelFlyDistance
      )
  };
}
