/** Base props shared by all inputs in this fixture package. */
export interface BarProps {
  /** Label text displayed above the widget. */
  label?: string;
  /**
   * Error message rendered below the widget.
   * @default undefined
   */
  error?: string;
  /** Internal flag that consumers must not set. */
  hidden?: boolean;
  /** Size of the widget. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
}

/** Plain heritage base (no Omit). */
export interface BazProps {
  /** Duration of the entrance animation in ms. */
  duration?: number;
}

/** A step inside a widget tour. */
export interface WidgetStep {
  /** Anchor id. */
  target?: string;
}

/** Fired when a step becomes active. */
export interface WidgetStepEvent {
  /** The active step. */
  step: WidgetStep;
}

/**
 * A widget tour definition — references WidgetStep transitively.
 *
 * @see WidgetStep
 * @see https://example.com/widget-tour
 */
export interface WidgetTour {
  /** Unique id. */
  id: string;
  /** Ordered steps. */
  steps: WidgetStep[];
  /** Analytics hook. */
  onStep?: (event: WidgetStepEvent) => void;
}

/** Direction alias. */
export type WidgetDirection = 'to-widget' | 'to-ui';

/** Controller class — public signature should be summarized. */
export class WidgetController {
  #secret = 0;
  private internalState: string[] = [];

  constructor(options?: { direction?: WidgetDirection }) {
    void options;
    this.reset();
  }

  /** Start the given tour. */
  startTour(tour: WidgetTour): boolean {
    void tour;
    this.#secret += 1;
    return true;
  }

  get stepIndex(): number {
    return this.#secret;
  }

  private reset(): void {
    this.internalState.length = 0;
  }
}
