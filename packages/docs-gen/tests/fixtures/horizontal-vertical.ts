/**
 * Tab-style discriminated union: orientation is the discriminator;
 * `fullWidth` is only available on the horizontal arm via `?: never` on
 * the vertical arm. Verifies the conditionalOn payload.
 */

interface HVBaseProps {
  size?: 'sm' | 'md' | 'lg';
}

interface HVHorizontalProps extends HVBaseProps {
  /** Layout axis. */
  orientation?: 'horizontal';
  /** Stretch triggers to fill the available width. */
  fullWidth?: boolean;
}

interface HVVerticalProps extends HVBaseProps {
  /** Layout axis. */
  orientation: 'vertical';
  fullWidth?: never;
}

/**
 * @description Horizontal/vertical discriminated union with conditional fullWidth.
 */
export type HVProps = HVHorizontalProps | HVVerticalProps;
