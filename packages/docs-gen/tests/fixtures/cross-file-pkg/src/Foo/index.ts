import type { BarProps, BazProps, WidgetController, WidgetTour } from '../shared/types';

/**
 * @description Fixture component whose props extend an imported base via Omit.
 * @tag form
 */
export interface FooProps extends Omit<BarProps, 'hidden'> {
  /** The tour to run. */
  tour?: WidgetTour;
  /** Programmatic controller. */
  controller?: WidgetController;
}

/**
 * @description Fixture component with a plain imported heritage clause.
 * @tag form
 */
export interface PlainProps extends BazProps {
  /** Own prop. */
  own?: string;
}

export type { BarProps, BazProps };
