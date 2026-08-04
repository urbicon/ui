import type { WidgetTour } from '../internal/helpers';

/**
 * @description Fixture component for the exported-flag controls.
 * @tag display
 */
export interface WidgetProps {
  /** The tour to run. */
  tour?: WidgetTour;
  /** Visual intent. */
  intent?: WidgetIntent;
}

/** Re-exported from the package root. */
export type WidgetIntent = 'info' | 'danger';

/** Re-exported *only* from the `./sub` entry — still public API. */
export type WidgetSubOnly = { kind: 'sub' };

/** Exported from this file but from no package entry — not reachable. */
export type WidgetSecretSlots = 'root' | 'label';
