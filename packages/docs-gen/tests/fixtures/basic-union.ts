/**
 * Basic 2-arm discriminated union (Badge-style):
 * - Dot variant: no children/counter/removable
 * - Standard variant: full surface
 *
 * Used to verify discriminator detection, ?:never semantics, source
 * re-attribution, and conditionalOn propagation.
 */

interface BasicBaseProps {
  /** Visual intent. */
  intent?: 'primary' | 'success' | 'danger';
  /** Add a ring outline. */
  border?: boolean;
}

interface BasicDotProps extends BasicBaseProps {
  /** Visual variant. */
  variant: 'dot';
  counter?: never;
  removable?: never;
}

interface BasicStandardProps extends BasicBaseProps {
  /**
   * Visual variant.
   * @default 'filled'
   */
  variant?: 'filled' | 'outlined' | 'soft';
  /** Numeric counter shape. */
  counter?: boolean;
  /** Show a remove button. */
  removable?: boolean;
}

/**
 * @description Test fixture for basic 2-arm discriminated union.
 * @tag display
 */
export type BasicProps = BasicDotProps | BasicStandardProps;
