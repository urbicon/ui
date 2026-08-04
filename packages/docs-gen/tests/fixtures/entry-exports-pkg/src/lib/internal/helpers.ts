/** Re-exported from the package root, so a consumer can import it. */
export interface WidgetTour {
  id: string;
  internals?: WidgetTourInternals;
}

/**
 * Reachable only by following `WidgetTour` — never re-exported. The negative
 * control for a transitively collected type.
 */
export interface WidgetTourInternals {
  seen: boolean;
}
