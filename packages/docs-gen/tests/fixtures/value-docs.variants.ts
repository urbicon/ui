/**
 * Fixture: per-value descriptions. A JSDoc block touching a value's key is
 * that value's description. A `//` note touching the key, a pragma line
 * between block and key, a block above the axis, and a block separated from
 * the key by a blank line are the four things that must NOT become one.
 */
declare const tv: (config: unknown) => Record<string, unknown>;

export const toggleVariants = tv({
  variants: {
    /** The axis, not its first value — must not land on `default`. */
    variant: {
      default: {},
      // Implementation note that touches the key — a maintainer's constraint,
      // not a description.
      pill: {},
      /**
       * Small indicator dot left of the label — outline only when off,
       * filled in the intent colour when on.
       */
      dot: {},
      /** Compact square. */
      // eslint-disable-next-line no-empty-pattern
      square: {},
      /** Separated from the key by a blank line — not touching it. */

      detached: {}
    },
    size: { sm: {}, md: {} }
  },
  defaultVariants: { variant: 'default', size: 'md' }
});
