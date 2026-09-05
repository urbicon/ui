/**
 * Fixture: per-value descriptions. The JSDoc block on a value's key is that
 * value's description, attached the way TypeScript attaches a prop's. A `//`
 * note is not JSDoc; a block on the axis key belongs to the axis; a pragma
 * line, a blank line and an inline tag change nothing about the attachment.
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
      /** Separated from the key by a blank line — attached all the same. */

      detached: {},
      /** Hollow ring. @deprecated prefer `dot` */
      ring: {}
    },
    size: { sm: {}, md: {} }
  },
  defaultVariants: { variant: 'default', size: 'md' }
});
