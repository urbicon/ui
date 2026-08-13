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

/**
 * @description Fixture component that adds nothing to its base — the shape a
 * re-export wrapper takes.
 * @tag form
 */
export interface EmptyExtendsProps extends BazProps {}

/**
 * @description Fixture component with neither own members nor a base.
 * @tag form
 */
export type BarrenProps = {};

export type { BarProps, BazProps };
