/**
 * Shared style fragments for the bordered field frame.
 *
 * Input, PinInput and TimeInput (and NumberInput, via its Input composition)
 * all render the same field chrome — the neutral resting frame, the focus ring,
 * the `outlined | filled | ghost` surfaces, the intent colours, the disabled /
 * error states and the label / message scaffolding. Before this module each of
 * the three `*.variants.ts` hand-copied those class strings, so a token fix had
 * to be applied in three places and drift crept in silently.
 *
 * These exports are the single source for the shared tokens. They are composed
 * back into each `tv()` config at the EXACT positions the inlined strings held,
 * so the resolved (flattened) class output is byte-identical — proven by the
 * render-identity matrix diff in the debt-fix-wave-5 (40 960 Input / 2 304 Pin /
 * 4 608 TimeInput combinations, zero diff). This is a pure de-duplication, not a
 * behaviour change.
 *
 * The one axis of genuine divergence is the focus mechanism: Input and PinInput
 * put the ring on the focusable element itself (`focus-visible:`), while
 * TimeInput hosts borderless segments inside a bordered container and lights the
 * whole field via `focus-within:`. That is why the ring / variant / intent /
 * error fragments are parameterised by {@link FieldFocus} rather than fixed.
 *
 * Select and Combobox draw only on the validation subset ({@link fieldErrorFrame}
 * and {@link FIELD_MESSAGE_TONES}) — their frames are otherwise their own (a
 * trigger button, a tokenizer box). That subset is what kept drifting: Select
 * hand-copied the error frame and Combobox had none at all, so an invalid
 * Combobox announced itself through `aria-invalid` and looked untouched.
 *
 * NOT covered here (deliberately component-local): the per-component frame
 * prefix (Input's `w-full`, PinInput's cell content styles, TimeInput's
 * `inline-flex` container), Input's `underline` variant and `placeholder`
 * colour, PinInput's `focus-visible:z-10`, TimeInput's `fullWidth` and its
 * cursor-free readonly. The shared label/message MARKUP in the `.svelte` files
 * is a separate, larger cut (see technical-debt "Field chrome…" part b).
 *
 * This is not a component and imports nothing from other component dirs, so it
 * is exempt from the cross-component import guard (imports-lint treats
 * `internal/**` as the extraction target).
 */

/** The field's colour/border/shadow transition — the longest shared string. */
export const FIELD_TRANSITION =
  'transition-[color,background-color,border-color,box-shadow] duration-[var(--blocks-duration-fast)] ease-out';

/** The neutral resting frame: border + primary text + base surface. Input
 *  appends its own `placeholder:` colour after this. */
export const FIELD_SURFACE = 'border text-text-primary bg-surface-base';

/** `:disabled` / `:read-only` pseudo-class fallbacks on a NATIVE field element
 *  (Input's `base`, PinInput's `cell`). TimeInput's frame is a container whose
 *  segments carry their own states, so it omits these. */
export const FIELD_NATIVE_DISABLED =
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-subtle';
export const FIELD_NATIVE_READONLY = 'read-only:bg-surface-subtle read-only:cursor-default';

/**
 * Where the focus ring lives: `focus-visible:` on a directly-focusable field
 * (Input, PinInput cell), `focus-within:` on a container that hosts focusable
 * segments (TimeInput).
 */
export type FieldFocus = 'focus-visible' | 'focus-within';

/** The primary focus ring (border + 2px ring at 20% alpha), for the given mode. */
export const fieldFocusRing = (f: FieldFocus): string =>
  `${f}:border-primary ${f}:ring-2 ${f}:ring-primary/20`;

/**
 * The `outlined | filled | ghost` surface values, parameterised by focus mode.
 * `outlined` is a constant; consumers add their own extra variants (Input's
 * `underline`) alongside.
 */
export const fieldSurfaceVariants = (f: FieldFocus) => ({
  outlined: 'border-border-subtle',
  filled: `bg-surface-interactive border-transparent hover:bg-surface-hover ${f}:bg-surface-base`,
  ghost: `bg-transparent hover:bg-surface-subtle ${f}:bg-surface-base ${f}:border-border-subtle`
});

/**
 * The intent frame values (border + focus ring tint) for success/warning/danger,
 * parameterised by focus mode. `default` carries no frame class, so callers keep
 * their own empty `default: {}` slot entry.
 */
export const fieldIntentFrames = (f: FieldFocus) => ({
  success: `border-success ${f}:border-success ${f}:ring-success/20`,
  warning: `border-warning ${f}:border-warning ${f}:ring-warning/20`,
  danger: `border-danger ${f}:border-danger ${f}:ring-danger/20`
});

/**
 * The error frame value (danger border + ring), parameterised by focus mode.
 *
 * PRECEDENCE: this paints the same three buckets as {@link fieldIntentFrames}
 * (border-color plus the focused border/ring tint), so in a config that has
 * BOTH a tonal `intent` axis and a boolean `error` axis only one of them can
 * win. Apply it from a `compoundVariants` entry (`{ error: true, … }`), never
 * from the `error` axis: compounds fold after every axis, which makes "error
 * beats intent" a rule instead of a side effect of the axis declaration order.
 * Configs without an `intent` axis (Select, Combobox) can keep it on the axis —
 * but must move it the day one is added. Reference: input.variants.ts.
 */
export const fieldErrorFrame = (f: FieldFocus): string =>
  `border-danger ${f}:border-danger ${f}:ring-danger/20`;

/** Frame classes when the whole control is disabled (the `disabled` variant). */
export const FIELD_DISABLED_FRAME =
  'opacity-50 cursor-not-allowed bg-surface-disabled pointer-events-none';

/** The field label base, shared verbatim across all three fields. */
export const FIELD_LABEL = 'block font-medium text-text-secondary text-sm';

/** Label colour when the control is disabled. */
export const FIELD_LABEL_DISABLED = 'text-text-disabled';

/** Required-marker asterisk appended after the label. */
export const FIELD_REQUIRED_LABEL = "after:content-['*'] after:ml-1 after:text-danger";

/** The two `messageType` message tones (error wins the fold when both apply). */
export const FIELD_MESSAGE_TONES = {
  error: 'text-danger',
  helper: 'text-text-tertiary'
} as const;
