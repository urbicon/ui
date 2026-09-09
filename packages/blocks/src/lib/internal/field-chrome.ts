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
 * Textarea takes the surfaces too. Select and Combobox draw on the validation
 * subset ({@link fieldErrorFrame} and {@link FIELD_MESSAGE_TONES}) plus
 * {@link fieldBareSurface} — their resting frames are otherwise their own (a
 * trigger button, a tokenizer box). That subset is what kept drifting: Select
 * hand-copied the error frame and Combobox had none at all, so an invalid
 * Combobox announced itself through `aria-invalid` and looked untouched.
 *
 * NOT covered here (deliberately component-local): the per-component frame
 * prefix (Input's `w-full`, PinInput's cell content styles, TimeInput's
 * `inline-flex` container), the `underline` variant and Input's `placeholder`
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

/**
 * The focus-mode fragments, each written out for both modes.
 *
 * **Never interpolate a class name's prefix** (`` `${f}:ring-2` ``, which is
 * what these used to be). Tailwind's scanner reads source TEXT, so a class that
 * exists only as an interpolation is never extracted and compiles into no
 * consumer stylesheet — while the fold in `utils/variants.ts` resolves it
 * happily, because it parses the string it is handed rather than the stylesheet.
 * The two disagree in silence, and `apps/docs` cannot notice: it scans `dist`
 * and is not a consumer.
 *
 * One `const` per fragment rather than one table of all of them, so a component
 * that reaches for the ring does not carry the surfaces and the intents into its
 * bundle — a bundler can only drop what is separately named, which is also why
 * {@link fieldFilledSurface} and {@link fieldGhostSurface} exist beside
 * {@link fieldSurfaceVariants}.
 */
type ByFocus = Readonly<Record<FieldFocus, string>>;

const RING: ByFocus = {
  'focus-visible':
    'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
  'focus-within': 'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
};

const FILLED_SURFACE: ByFocus = {
  'focus-visible':
    'bg-surface-interactive border-transparent hover:bg-surface-interactive-hover focus-visible:bg-surface-base',
  'focus-within':
    'bg-surface-interactive border-transparent hover:bg-surface-interactive-hover focus-within:bg-surface-base'
};

const GHOST_SURFACE: ByFocus = {
  'focus-visible':
    'bg-transparent hover:bg-surface-hover focus-visible:bg-surface-base focus-visible:border-border-subtle',
  'focus-within':
    'bg-transparent hover:bg-surface-hover focus-within:bg-surface-base focus-within:border-border-subtle'
};

const BARE_SURFACE: ByFocus = {
  'focus-visible':
    'bg-transparent border-0 rounded-none focus-visible:ring-0 focus-visible:outline-solid focus-visible:outline-[length:var(--blocks-focus-ring-width)] focus-visible:outline-offset-[length:var(--blocks-focus-ring-offset)] focus-visible:outline-(color:--blocks-focus-ring-color)',
  'focus-within':
    'bg-transparent border-0 rounded-none focus-within:ring-0 focus-within:outline-solid focus-within:outline-[length:var(--blocks-focus-ring-width)] focus-within:outline-offset-[length:var(--blocks-focus-ring-offset)] focus-within:outline-(color:--blocks-focus-ring-color)'
};

const BARE_ERROR_OUTLINE: ByFocus = {
  'focus-visible': 'focus-visible:outline-(color:--color-danger)',
  'focus-within': 'focus-within:outline-(color:--color-danger)'
};

const SUCCESS_FRAME: ByFocus = {
  'focus-visible': 'border-success focus-visible:border-success focus-visible:ring-success/20',
  'focus-within': 'border-success focus-within:border-success focus-within:ring-success/20'
};

const WARNING_FRAME: ByFocus = {
  'focus-visible': 'border-warning focus-visible:border-warning focus-visible:ring-warning/20',
  'focus-within': 'border-warning focus-within:border-warning focus-within:ring-warning/20'
};

const DANGER_FRAME: ByFocus = {
  'focus-visible': 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
  'focus-within': 'border-danger focus-within:border-danger focus-within:ring-danger/20'
};

/** The primary focus ring (border + 2px ring at 20% alpha), for the given mode. */
export const fieldFocusRing = (f: FieldFocus): string => RING[f];

/**
 * The `bare` surface: a field that reads as the text it sits in.
 *
 * No frame, no fill, no radius — and the focus indicator is an **outline**, not
 * a `ring-*`. A ring is a `box-shadow`, and forced-colors mode drops box-shadow
 * entirely; every other variant survives that because its border still marks
 * the field, and `bare` has no border to fall back on. An outline is honoured
 * in forced-colors and takes the system highlight colour there.
 *
 * All three of colour, width and offset come from the `--blocks-focus-ring-*`
 * tokens (`style/interaction.css`), so a product whose accent means something
 * else sets the focus look once instead of once per call site — and
 * `prefers-contrast: more`, which raises the width token to 3px, reaches this
 * outline for free. `outline-solid` is not decoration: it shares the
 * `outline-style` bucket with the `outline-none` every field's base slot
 * carries, and only a class in that bucket can strip it — the width utility
 * writes `outline-style: var(--tw-outline-style)`, which `outline-none` has
 * already set to `none` (measured against the compiler).
 *
 * The measure — padding, height, radius' absence — is NOT here: the `size` axis
 * is declared after `variant` and would win it back. See {@link FIELD_BARE_MEASURE}.
 */
export const fieldBareSurface = (f: FieldFocus): string => BARE_SURFACE[f];

/**
 * What `bare` takes off the axes that fold after `variant`: *bare has no
 * measure, only a type size.* Emit it from a `compoundVariants` entry keyed on
 * `{ variant: 'bare' }` — compounds fold after every axis, so one entry covers
 * all five sizes, while the same classes on the `variant` axis would be
 * overwritten by whichever `size` the caller passes.
 *
 * `bg-transparent` repeats what {@link fieldBareSurface} already says, and for
 * the same reason: the `disabled` and `readonly` axes are declared after
 * `variant` and would otherwise fill a field that has no frame to fill.
 * Disabled reads as `opacity-50` + `cursor-not-allowed` on `bare`.
 *
 * `p-0` takes the lane an absolutely positioned control sits in with it, so a
 * component that has one (Select's clear button, Combobox's clear/chevron pair)
 * puts a `pr-*` back from a later compound — measured, the text ran under the
 * button otherwise. A longhand after this shorthand composes rather than
 * replacing it, the same way the icon insets do.
 */
export const FIELD_BARE_MEASURE = 'h-auto min-h-0 p-0 bg-transparent';

/**
 * The same for the two native pseudo-class fills a directly-editable field
 * carries in its base slot ({@link FIELD_NATIVE_DISABLED},
 * {@link FIELD_NATIVE_READONLY}). Only Input and Textarea have them; a trigger
 * button and a tokenizer div do not.
 */
export const FIELD_BARE_NATIVE_FILL = 'disabled:bg-transparent read-only:bg-transparent';

/**
 * `bare`'s focus outline in the failure tone. `bare` has no frame for
 * {@link fieldErrorFrame} to tint, so the one mark it does draw carries the
 * state instead — emitted from the compound stage, after the `error` axis, the
 * same place the frame is emitted from on every other variant.
 */
export const fieldBareErrorOutline = (f: FieldFocus): string => BARE_ERROR_OUTLINE[f];

/** The `outlined` surface — a constant, no focus mode in it. */
export const FIELD_OUTLINED_SURFACE = 'border-border-subtle';

/** The `filled` surface, for the given focus mode. */
export const fieldFilledSurface = (f: FieldFocus): string => FILLED_SURFACE[f];

/** The `ghost` surface, for the given focus mode. */
export const fieldGhostSurface = (f: FieldFocus): string => GHOST_SURFACE[f];

/**
 * The four surface values a text field carries, parameterised by focus mode.
 *
 * For the four fields that have `bare` only. PinInput and TimeInput compose
 * their three from {@link FIELD_OUTLINED_SURFACE}, {@link fieldFilledSurface}
 * and {@link fieldGhostSurface} instead — measured, taking the record here put
 * 440 B of `bare` classes into PinInput's bundle that nothing could reach.
 * Callers add their own extra variants (the text fields' `underline`) alongside.
 */
export const fieldSurfaceVariants = (f: FieldFocus) => ({
  outlined: FIELD_OUTLINED_SURFACE,
  filled: FILLED_SURFACE[f],
  ghost: GHOST_SURFACE[f],
  bare: BARE_SURFACE[f]
});

/**
 * The intent frame values (border + focus ring tint) for success/warning/danger,
 * parameterised by focus mode. `default` carries no frame class, so callers keep
 * their own empty `default: {}` slot entry.
 */
export const fieldIntentFrames = (f: FieldFocus) => ({
  success: SUCCESS_FRAME[f],
  warning: WARNING_FRAME[f],
  danger: DANGER_FRAME[f]
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
export const fieldErrorFrame = (f: FieldFocus): string => DANGER_FRAME[f];

/** Frame classes when the whole control is disabled (the `disabled` variant). */
export const FIELD_DISABLED_FRAME =
  'opacity-50 cursor-not-allowed bg-surface-disabled pointer-events-none';

/** The field label base, shared verbatim across all three fields. */
export const FIELD_LABEL = 'block font-medium text-text-secondary text-sm';

/** Label colour when the control is disabled. */
export const FIELD_LABEL_DISABLED = 'text-text-disabled';

/**
 * The required marker's own classes, worn by the `requiredMark` slot of every
 * field that has a label.
 *
 * A slot rather than an `after:content-['*']` pseudo-element on the label,
 * because only a slot is on the override ladder: `slotClasses`, presets,
 * `defaults` and `overrides` all reach it, and hiding the glyph on an
 * all-required form is `slotClasses: { requiredMark: 'hidden' }`. A
 * pseudo-element is reachable only by writing `after:content-none` into the
 * label's own bucket.
 *
 * The provider rungs reach eight of the nine: FormField resolves no cascade of
 * its own (no `resolveSlotClasses`, no `unstyled`, no `preset`), so it takes the
 * instance `slotClasses` entry and nothing above it. That is a property of
 * FormField, older than this marker, and its docs page says so.
 *
 * `text-text-secondary`, not the danger tone: nothing has failed yet. The
 * "required" information travels through native `required` / `aria-required`,
 * which is why the glyph itself is `aria-hidden`.
 */
export const FIELD_REQUIRED_MARK = 'ml-1 text-text-secondary';

/** The two `messageType` message tones (error wins the fold when both apply). */
export const FIELD_MESSAGE_TONES = {
  error: 'text-danger-text',
  helper: 'text-text-tertiary'
} as const;
