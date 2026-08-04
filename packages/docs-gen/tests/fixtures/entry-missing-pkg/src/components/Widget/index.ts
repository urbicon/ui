import type { WidgetTone } from '../../shared/tone';

/**
 * @description Fixture component used to measure what an unresolvable export
 * surface does to the extraction as a whole.
 * @tag display
 */
export interface WidgetProps {
  /** Visible label. */
  label: string;
  /** Tone of the widget. */
  tone?: WidgetTone;
  /** Whether the widget is disabled. */
  disabled?: boolean;
  /** Callback fired on click. */
  onclick?: () => void;
}

/** Placement of the widget's badge. */
export type WidgetBadgePlacement = 'start' | 'end';
