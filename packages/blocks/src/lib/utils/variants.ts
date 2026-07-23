// ─── Type Utilities ──────────────────────────────────────────────────────────

/**
 * Call-site class value — mirrors Svelte 5's `ClassValue` (clsx shape):
 * strings, nested arrays, `{ class: condition }` records, falsy values
 * (dropped). Accepted by `cx()` and every `class` input (component props,
 * slot-function overrides). Config-side values (variants, compound classes)
 * deliberately do NOT take the record form — there an object is a slot map.
 */
type ClassInput =
  | string
  | number
  | ClassInput[]
  | Record<string, boolean | undefined | null>
  | undefined
  | null
  | false;

type VariantPropType<V> =
  V extends Record<string, unknown>
    ? 'true' extends Extract<keyof V, string>
      ? boolean | Exclude<Extract<keyof V, string>, 'true' | 'false'>
      : Extract<keyof V, string>
    : never;

type VariantPropsMap<V extends Record<string, Record<string, unknown>>> = {
  [K in keyof V]?: VariantPropType<V[K]>;
};

type SlotFn<V extends Record<string, Record<string, unknown>>> = (
  props?: VariantPropsMap<V> & { class?: ClassInput }
) => string;

/** Per-slot class map used config-side (variant values, compound classes). */
type SlotClassMap<S> = { [K in keyof S]?: string | string[] };

/**
 * Validation companion for slot-mode `variants`: intersecting the inferred
 * `V` with this mapped type turns every slot-map key that is not a declared
 * slot into an assignability error AT that key — the compiler catches
 * `wrapeer` typos that structural checking alone would let through.
 */
type ValidSlotVariants<V, S> = {
  [A in keyof V]: {
    [Q in keyof V[A]]: V[A][Q] extends string | readonly string[]
      ? unknown
      : { [K in keyof V[A][Q]]: K extends keyof S ? unknown : ['unknown slot', K] };
  };
};

type CompoundVariant<V extends Record<string, Record<string, unknown>>> = {
  [K in keyof V]?: VariantPropType<V[K]> | VariantPropType<V[K]>[];
} & {
  class?: string | string[];
};

type SlotCompoundVariant<V extends Record<string, Record<string, unknown>>, S> = {
  [K in keyof V]?: VariantPropType<V[K]> | VariantPropType<V[K]>[];
} & {
  class?: string | string[] | SlotClassMap<S>;
};

// ─── Public Types ────────────────────────────────────────────────────────────

export type TVProps<V extends Record<string, Record<string, unknown>>> = VariantPropsMap<V> & {
  class?: ClassInput;
};

export type VariantProps<T extends (...args: never[]) => unknown> = Omit<
  Exclude<Parameters<T>[0], undefined>,
  'class'
>;

/**
 * Extracts the slot-name union from a slotted `tv()` config function — the
 * companion to {@link VariantProps}. The slot-mode overload returns
 * `(props?) => { [K in keyof S]: SlotFn }`, so `keyof ReturnType<T>` is exactly
 * the set of slot names a component declares in `tv({ slots: … })`.
 *
 * Use it to type a component's `slotClasses` prop from the single source of
 * truth (its `*.variants.ts`) instead of hand-maintaining a parallel union
 * that silently drifts when a slot is added or renamed:
 *
 * @example
 * // button.variants.ts
 * export type ButtonSlots = SlotNames<typeof buttonVariants>; // 'base' | 'content' | 'spinner'
 * // index.ts
 * slotClasses?: Partial<Record<ButtonSlots, string>>;
 */
export type SlotNames<T extends (...args: never[]) => unknown> = keyof ReturnType<T> & string;

// ─── cx: class concatenation ─────────────────────────────────────────────────

/**
 * Concatenate class inputs into a single string. Accepts strings, nested
 * arrays, `{ class: condition }` records (Svelte 5 `ClassValue` / clsx
 * shape — keys with truthy values are included) and falsy values (filtered
 * out). Trims and joins with single spaces.
 *
 * Note: `cx()` does **not** deduplicate — `cx('foo', 'foo bar')` returns
 * `'foo foo bar'`. Duplicate Tailwind classes are harmless at runtime
 * (CSS ignores them), but DOM output is longer than after a `twMerge`
 * pass. See `docs/ARCHITECTURE.md` "tv() engine — explicit trade-offs".
 */
export function cx(...inputs: ClassInput[]): string {
  const parts: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed) parts.push(trimmed);
    } else if (typeof input === 'number') {
      // clsx/ClassValue parity: numbers stringify (0 is already filtered).
      parts.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cx(...input);
      if (nested) parts.push(nested);
    } else if (typeof input === 'object') {
      for (const key of Object.keys(input)) {
        if (!input[key]) continue;
        const trimmed = key.trim();
        if (trimmed) parts.push(trimmed);
      }
    }
  }
  return parts.join(' ');
}

// ─── Tailwind Conflict Resolver ──────────────────────────────────────────────
//
// Determines which "bucket" a Tailwind utility class belongs to. Two classes
// with the same bucket key are treated as conflicting; the later source in
// the `tv()` resolution pipeline wins (see the fold in `resolvePipeline`).
//
// Modifier prefixes (`hover:`, `focus-visible:`, `md:`, `dark:`, …) are part
// of the bucket key. `hover:bg-red` and `bg-red` therefore do NOT conflict.
// The modifier/base split happens at the last colon OUTSIDE brackets, so
// arbitrary values (`bg-[url(https://…)]`) and arbitrary properties
// (`[gap:inherit]`, `hover:[transform:…]`) keep their base intact.
//
// Arbitrary properties (`[prop:value]`, including CSS custom properties like
// `[--spinner-speed:1s]`) bucket per property name, so `[gap:inherit]` vs
// `[gap:0]` resolves deterministically. A small alias table maps properties
// onto their utility twin's bucket (`[gap:…]` ↔ `gap-*`).
//
// Unknown / unmatched classes return `null` and never conflict — this keeps
// the resolver opt-in: any class shape we have not catalogued passes through
// untouched (e.g. `blocks-menu--open`, semantic component hooks).
//
// Pattern ordering matters: more specific patterns are listed first. The
// first match wins.

// Pattern → bucket-key. Patterns operate on the **bare** class (after
// stripping modifier prefix and leading `-` sign).
//
// Border patterns deserve a comment: `border` alone, `border-2`, and
// `border-x-4` are widths; `border-red-500` and `border-primary` are
// colors; `border-dashed` is a style. We disambiguate with three layers
// of regex (style → numeric-width → fallback color) per side prefix.
//
// Likewise `text-` is overloaded: size (`text-sm`), alignment (`text-left`),
// or color (`text-red-500`). Specific patterns first, then color fallback.
type BucketResolver = string | ((m: RegExpMatchArray) => string);

const BUCKET_PATTERNS: Array<[RegExp, BucketResolver]> = [
  // Display / Layout
  [
    /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|inline-table|table-(?:caption|cell|column|column-group|footer-group|header-group|row|row-group)|flow-root|contents|list-item|hidden)$/,
    'display'
  ],
  [/^(static|fixed|absolute|relative|sticky)$/, 'position'],
  [/^float-(left|right|none|start|end)$/, 'float'],
  [/^clear-(left|right|both|none|start|end)$/, 'clear'],
  [/^isolate$|^isolation-auto$/, 'isolation'],
  [/^object-(contain|cover|fill|none|scale-down)$/, 'object-fit'],
  [
    /^object-(top|right|bottom|left|center|left-top|left-bottom|right-top|right-bottom)$/,
    'object-position'
  ],
  [/^visible$|^invisible$|^collapse$/, 'visibility'],
  [/^overflow-(auto|hidden|clip|visible|scroll)$/, 'overflow'],
  [/^overflow-x-(auto|hidden|clip|visible|scroll)$/, 'overflow-x'],
  [/^overflow-y-(auto|hidden|clip|visible|scroll)$/, 'overflow-y'],
  [/^pointer-events-(auto|none)$/, 'pointer-events'],
  [/^select-(none|text|all|auto)$/, 'user-select'],
  [/^resize(-(none|y|x))?$/, 'resize'],

  // Flex / Grid
  [/^flex-(row|col|row-reverse|col-reverse)$/, 'flex-direction'],
  [/^flex-(wrap|nowrap|wrap-reverse)$/, 'flex-wrap'],
  // v4 accepts any integer (`flex-2`) and arbitrary values (`flex-[2_2_0%]`).
  [/^flex-(\d+|auto|initial|none|\[[^\]]+\])$/, 'flex'],
  [/^grow(-\d+|-\[.+\])?$/, 'flex-grow'],
  [/^shrink(-\d+|-\[.+\])?$/, 'flex-shrink'],
  [/^basis-/, 'flex-basis'],
  [/^order-/, 'order'],
  [/^items-(start|end|center|baseline|baseline-last|stretch)$/, 'align-items'],
  [/^justify-(start|end|center|between|around|evenly|normal|stretch)$/, 'justify-content'],
  [/^justify-items-(start|end|center|stretch|normal)$/, 'justify-items'],
  [/^justify-self-(auto|start|end|center|stretch)$/, 'justify-self'],
  [/^content-(start|end|center|between|around|evenly|baseline|stretch|normal)$/, 'align-content'],
  [/^self-(auto|start|end|center|stretch|baseline|baseline-last)$/, 'align-self'],
  [/^place-content-/, 'place-content'],
  [/^place-items-/, 'place-items'],
  [/^place-self-/, 'place-self'],
  [/^grid-cols-/, 'grid-template-columns'],
  [/^grid-rows-/, 'grid-template-rows'],
  [/^grid-flow-/, 'grid-auto-flow'],
  // grid-column vs -start vs -end are three CSS properties — `col-span-2`
  // must not conflict with `col-start-3`.
  [/^col-start-/, 'grid-column-start'],
  [/^col-end-/, 'grid-column-end'],
  [/^col-/, 'grid-column'],
  [/^row-start-/, 'grid-row-start'],
  [/^row-end-/, 'grid-row-end'],
  [/^row-/, 'grid-row'],
  [/^auto-cols-/, 'grid-auto-columns'],
  [/^auto-rows-/, 'grid-auto-rows'],

  // Sizing — width / height
  [/^min-w-/, 'min-w'],
  [/^min-h-/, 'min-h'],
  [/^max-w-/, 'max-w'],
  [/^max-h-/, 'max-h'],
  [/^w-/, 'w'],
  [/^h-/, 'h'],
  [/^size-/, 'size'],
  [/^aspect-/, 'aspect'],

  // Padding — separate buckets per shorthand (matches Tailwind's own cascade)
  [/^px-/, 'px'],
  [/^py-/, 'py'],
  [/^pt-/, 'pt'],
  [/^pr-/, 'pr'],
  [/^pb-/, 'pb'],
  [/^pl-/, 'pl'],
  [/^ps-/, 'ps'],
  [/^pe-/, 'pe'],
  [/^p-/, 'p'],

  // Margin
  [/^mx-/, 'mx'],
  [/^my-/, 'my'],
  [/^mt-/, 'mt'],
  [/^mr-/, 'mr'],
  [/^mb-/, 'mb'],
  [/^ml-/, 'ml'],
  [/^ms-/, 'ms'],
  [/^me-/, 'me'],
  [/^m-/, 'm'],

  // Gap / space-between / divide
  [/^gap-x-/, 'gap-x'],
  [/^gap-y-/, 'gap-y'],
  [/^gap-/, 'gap'],
  [/^space-x-reverse$/, 'space-x-reverse'],
  [/^space-y-reverse$/, 'space-y-reverse'],
  [/^space-x-/, 'space-x'],
  [/^space-y-/, 'space-y'],
  // divide-* — width / style / color are orthogonal properties.
  [/^divide-(x|y)-reverse$/, (m) => `divide-${m[1]}-reverse`],
  [/^divide-(x|y)(-(\d+|\[[^\]]+\]))?$/, (m) => `divide-${m[1]}-width`],
  [/^divide-(solid|dashed|dotted|double|none)$/, 'divide-style'],
  [/^divide-/, 'divide-color'],

  // Position offsets. v4.1 inset-shadow-* / inset-ring-* must not fall into
  // the `inset-` position bucket.
  [/^inset-shadow-\[/, 'inset-shadow'],
  [/^inset-shadow-(2xs|xs|sm|none)$/, 'inset-shadow'],
  [/^inset-shadow$/, 'inset-shadow'],
  [/^inset-shadow-/, 'inset-shadow-color'],
  [/^inset-ring(-\d+|-\[[^\]]+\])?$/, 'inset-ring-width'],
  [/^inset-ring-/, 'inset-ring-color'],
  [/^inset-x-/, 'inset-x'],
  [/^inset-y-/, 'inset-y'],
  [/^inset-/, 'inset'],
  [/^top-/, 'top'],
  [/^right-/, 'right'],
  [/^bottom-/, 'bottom'],
  [/^left-/, 'left'],
  [/^start-/, 'start'],
  [/^end-/, 'end'],
  [/^z-/, 'z-index'],

  // Border-radius — `rounded-tl`, `rounded-tl-md`, `rounded-tl-[N]` all share one bucket per corner/side
  [/^rounded-tl(-|$)/, 'rounded-tl'],
  [/^rounded-tr(-|$)/, 'rounded-tr'],
  [/^rounded-bl(-|$)/, 'rounded-bl'],
  [/^rounded-br(-|$)/, 'rounded-br'],
  [/^rounded-ss(-|$)/, 'rounded-ss'],
  [/^rounded-se(-|$)/, 'rounded-se'],
  [/^rounded-es(-|$)/, 'rounded-es'],
  [/^rounded-ee(-|$)/, 'rounded-ee'],
  [/^rounded-t(-|$)/, 'rounded-t'],
  [/^rounded-r(-|$)/, 'rounded-r'],
  [/^rounded-b(-|$)/, 'rounded-b'],
  [/^rounded-l(-|$)/, 'rounded-l'],
  [/^rounded-s(-|$)/, 'rounded-s'],
  [/^rounded-e(-|$)/, 'rounded-e'],
  [/^rounded(-|$)/, 'rounded'],

  // border-collapse / border-spacing are table-layout properties, not colors.
  [/^border-(collapse|separate)$/, 'border-collapse'],
  [/^border-spacing-x-/, 'border-spacing-x'],
  [/^border-spacing-y-/, 'border-spacing-y'],
  [/^border-spacing-/, 'border-spacing'],
  // Border style (must come before width/color)
  [/^border-(solid|dashed|dotted|double|hidden|none)$/, 'border-style'],
  // Border width — `border`, `border-1`, `border-2`, `border-[3px]` (Tailwind v4 accepts any integer)
  [/^border(-(\d+|\[[^\]]+\]))?$/, 'border-width'],
  // Border side-width — `border-x`, `border-t-2`, `border-r-[3px]`
  [/^border-(x|y|t|r|b|l|s|e)(-(\d+|\[[^\]]+\]))?$/, (m) => `border-${m[1]}-width`],
  // Border color (catch-all, e.g. `border-red-500`, `border-primary`, `border-border-subtle`)
  [/^border-(x|y|t|r|b|l|s|e)-/, (m) => `border-${m[1]}-color`],
  [/^border-/, 'border-color'],

  // Outline / ring. In v4 bare `outline` sets outline-style: solid — it is a
  // style, not a width.
  [/^outline-(solid|dashed|dotted|double|none|hidden)$/, 'outline-style'],
  [/^outline$/, 'outline-style'],
  [/^outline-offset-/, 'outline-offset'],
  [/^outline(-\d+|-\[[^\]]+\])$/, 'outline-width'],
  [/^outline-/, 'outline-color'],
  [/^ring-offset-(\d+|\[[^\]]+\])$/, 'ring-offset-width'],
  [/^ring-offset-/, 'ring-offset-color'],
  [/^ring-inset$/, 'ring-inset'],
  [/^ring(-\d+|-\[[^\]]+\])?$/, 'ring-width'],
  [/^ring-/, 'ring-color'],

  // Background
  [/^bg-(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/, 'bg-repeat'],
  [/^bg-(auto|cover|contain)$/, 'bg-size'],
  [/^bg-(fixed|local|scroll)$/, 'bg-attachment'],
  [/^bg-clip-/, 'bg-clip'],
  [/^bg-origin-/, 'bg-origin'],
  [
    /^bg-(top|right|bottom|left|center|left-top|left-bottom|right-top|right-bottom|top-left|top-right|bottom-left|bottom-right)$/,
    'bg-position'
  ],
  // Data-type hints and image-valued arbitraries must not read as bg-color —
  // background-image and background-color are independent CSS properties
  // (a gradient overlay must never strip the color underneath, see the
  // Skeleton wave shimmer and Progress striped fill).
  [/^bg-\[(?:length|size):/, 'bg-size'],
  [/^bg-\[position:/, 'bg-position'],
  [/^bg-\[(?:image:|url\(|linear-gradient\(|radial-gradient\(|conic-gradient\()/, 'bg-image'],
  [/^bg-\[color:/, 'bg-color'],
  [/^bg-position-/, 'bg-position'],
  [/^bg-size-/, 'bg-size'],
  [/^bg-(?:linear|radial|conic)(-|$)/, 'bg-image'],
  [/^bg-gradient-to-/, 'bg-image'],
  [/^bg-none$/, 'bg-image'],
  [/^bg-/, 'bg-color'],
  [/^from-/, 'gradient-from'],
  [/^via-/, 'gradient-via'],
  [/^to-/, 'gradient-to'],

  // Text — size / align / weight / color (specific first). v4 size+leading shorthand: `text-sm/6`, `text-base/relaxed`.
  // v4.1 text-shadow-* must not read as text-color — and like `shadow`,
  // the named size scale is finite; other single-word values are colors
  // (`text-shadow-white` must not strip `text-shadow-lg`).
  [/^text-shadow-\[/, 'text-shadow'],
  [/^text-shadow-(2xs|xs|sm|md|lg|none)$/, 'text-shadow'],
  [/^text-shadow$/, 'text-shadow'],
  [/^text-shadow-/, 'text-shadow-color'],
  // `\d+xs` covers the library's sub-xs scale (--text-2xs/--text-3xs in
  // foundation.css) and mirrors `\d+xl` for consumer-added steps. Without it
  // `text-2xs` falls through to the text-color catch-all below, so a color
  // override would silently strip the font size.
  [/^text-(\d+xs|xs|sm|base|lg|xl|\d+xl)(\/[\w.-]+)?$/, 'text-size'],
  // Data-type hints disambiguate the overloaded `text-` arbitraries.
  [/^text-\[length:/, 'text-size'],
  [/^text-\[color:/, 'text-color'],
  // Arbitrary text-size values starting with a digit (e.g. `text-[11px]`,
  // `text-[1.5rem]`). Hex/named values like `text-[#fff]` / `text-[var(--x)]`
  // still fall through to the text-color catch-all below.
  [/^text-\[[0-9.]/, 'text-size'],
  [/^text-(left|center|right|justify|start|end)$/, 'text-align'],
  // text-overflow (ellipsis/clip) and text-wrap (wrap/nowrap/balance/pretty)
  // are different CSS properties — a wrap override must not strip ellipsis'
  // sibling and vice versa.
  [/^text-(ellipsis|clip)$/, 'text-overflow'],
  [/^text-(wrap|nowrap|balance|pretty)$/, 'text-wrap'],
  [/^text-(current|inherit|transparent)$/, 'text-color'],
  [/^text-/, 'text-color'],
  [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, 'font-weight'],
  [/^font-stretch-/, 'font-stretch'],
  [/^font-(sans|serif|mono)$/, 'font-family'],
  [/^font-/, 'font-family'],
  [/^italic$|^not-italic$/, 'font-style'],
  [/^tracking-/, 'letter-spacing'],
  [/^leading-/, 'line-height'],
  [/^line-clamp-/, 'line-clamp'],
  [/^underline$|^overline$|^line-through$|^no-underline$/, 'text-decoration'],
  // text-decoration sub-properties are orthogonal CSS — three separate buckets.
  // Order matters: style names first, then thickness (numeric/arbitrary), then color catch-all.
  [/^decoration-(solid|double|dotted|dashed|wavy|none)$/, 'text-decoration-style'],
  [/^decoration-(auto|from-font|\d+|\[[^\]]+\])$/, 'text-decoration-thickness'],
  [/^decoration-/, 'text-decoration-color'],
  [/^underline-offset-/, 'text-underline-offset'],
  [/^uppercase$|^lowercase$|^capitalize$|^normal-case$/, 'text-transform'],
  [/^whitespace-/, 'whitespace'],
  [/^break-(normal|words|all|keep)$/, 'word-break'],
  [/^truncate$/, 'text-overflow'],
  [/^placeholder-/, 'placeholder-color'],
  [/^align-(baseline|top|middle|bottom|text-top|text-bottom|sub|super)$/, 'vertical-align'],

  // Effects
  [/^opacity-/, 'opacity'],
  // Named shadow scale is finite; any other `shadow-<word>` is a color
  // (`shadow-primary` must not strip `shadow-md`).
  [/^shadow-(2xs|xs|sm|md|lg|xl|2xl|inner|none)$/, 'shadow'],
  [/^shadow$/, 'shadow'],
  [/^shadow-\[/, 'shadow'],
  [/^shadow-/, 'shadow-color'],
  [/^blur(-\w+)?$/, 'blur'],
  [/^backdrop-blur(-\w+)?$/, 'backdrop-blur'],
  [/^brightness-/, 'brightness'],
  [/^contrast-/, 'contrast'],
  [/^grayscale(-\w+)?$/, 'grayscale'],
  [/^invert(-\w+)?$/, 'invert'],
  [/^saturate-/, 'saturate'],
  [/^sepia(-\w+)?$/, 'sepia'],
  [/^mix-blend-/, 'mix-blend-mode'],
  [/^bg-blend-/, 'background-blend-mode'],

  // Transforms
  [/^transform$|^transform-none$/, 'transform'],
  [/^scale-x-/, 'scale-x'],
  [/^scale-y-/, 'scale-y'],
  [/^scale-/, 'scale'],
  // v4 3D rotate axes are orthogonal to plain rotate.
  [/^rotate-(x|y|z)-/, (m) => `rotate-${m[1]}`],
  [/^rotate-/, 'rotate'],
  [/^translate-x-/, 'translate-x'],
  [/^translate-y-/, 'translate-y'],
  [/^translate-z-/, 'translate-z'],
  // v4 plain `translate-*` sets both axes.
  [/^translate-/, 'translate'],
  [/^skew-x-/, 'skew-x'],
  [/^skew-y-/, 'skew-y'],
  [/^origin-/, 'transform-origin'],

  // Transitions / animations. v4 transition-behavior must not conflict with
  // transition-property (`transition-discrete` composes with `transition-colors`).
  [/^transition-(discrete|normal)$/, 'transition-behavior'],
  [/^transition(-\w+)?$/, 'transition'],
  [/^transition-\[/, 'transition'],
  [/^duration-/, 'transition-duration'],
  [/^ease-/, 'transition-timing-function'],
  [/^delay-/, 'transition-delay'],
  [/^animate-/, 'animation'],

  // Cursor / interaction
  [/^cursor-/, 'cursor'],
  [/^appearance-/, 'appearance'],
  [/^accent-/, 'accent-color'],
  [/^caret-/, 'caret-color']
];

// Arbitrary CSS properties whose utility twin should share a bucket, so
// `[gap:inherit]` and `gap-4` resolve against each other (Codeberg #21).
// Everything else buckets as `@<property>` — same-property arbitraries
// conflict, utilities stay untouched (twMerge behaves the same way).
const ARBITRARY_PROP_ALIAS: Record<string, string> = {
  gap: 'gap',
  'column-gap': 'gap-x',
  'row-gap': 'gap-y',
  transform: 'transform'
};

const ARBITRARY_PROP_PATTERN = /^\[((?:--)?[a-zA-Z][a-zA-Z0-9-]*):.+\]$/;

/**
 * Index of the last `:` outside any `[]`/`()` nesting, or -1. This is the
 * modifier/base boundary: colons inside arbitrary values (`bg-[url(https://…)]`),
 * arbitrary properties (`[gap:inherit]`) and selector modifiers
 * (`supports-[display:grid]:grid`) must not split the class.
 */
function lastTopLevelColon(cls: string): number {
  let depth = 0;
  let last = -1;
  for (let i = 0; i < cls.length; i++) {
    const ch = cls[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = depth > 0 ? depth - 1 : 0;
    else if (ch === ':' && depth === 0) last = i;
  }
  return last;
}

/**
 * Returns the conflict-bucket key of a Tailwind class, or `null` if the class
 * does not match any catalogued utility family. Unknown classes never conflict.
 *
 * Modifier prefixes are part of the key — `hover:bg-red` returns `hover:bg-color`
 * while `bg-red` returns `bg-color`. The two never strip each other. `!`-important
 * is normalized away entirely so `!bg-red` and `bg-red` share a bucket.
 * Arbitrary properties bucket per property name (`[gap:inherit]` → `gap`,
 * `[--spinner-speed:1s]` → `@--spinner-speed`).
 *
 * Results are memoized per process — `tailwindBucket` is called O(sources × classes)
 * per `tv()` resolve, and the same handful of class strings appear thousands of
 * times across a render tree. Cap kept high enough for any realistic application
 * surface; values are short and the map never frees.
 */
const BUCKET_CACHE = new Map<string, string | null>();
const BUCKET_CACHE_MAX = 4096;

function tailwindBucket(cls: string): string | null {
  // Stored values are `string | null`, never `undefined` — a single lookup
  // distinguishes hit from miss.
  const cached = BUCKET_CACHE.get(cls);
  if (cached !== undefined) return cached;

  // Split off all modifier prefixes (`hover:focus-visible:dark:md:bg-red`).
  const lastColon = lastTopLevelColon(cls);
  let modifiers = lastColon >= 0 ? cls.slice(0, lastColon + 1) : '';
  let base = lastColon >= 0 ? cls.slice(lastColon + 1) : cls;

  // Strip `!`-important markers — Tailwind v3 leading (`!bg-red`, `hover:!bg-red`)
  // and v4 trailing (`bg-red!`, `hover:bg-red!`). The bang never affects which
  // CSS property the class targets, only the cascade weight — so it must not
  // affect bucket identity.
  if (modifiers.includes('!')) modifiers = modifiers.replace(/!/g, '');
  if (base.startsWith('!')) base = base.slice(1);
  if (base.endsWith('!')) base = base.slice(0, -1);
  // Negative spacing like `-mx-2` shares its bucket with `mx-2`.
  if (base.startsWith('-') && !base.startsWith('-[')) base = base.slice(1);

  let result: string | null = null;

  const arbitraryProp = base.match(ARBITRARY_PROP_PATTERN);
  if (arbitraryProp) {
    const prop = arbitraryProp[1];
    result = modifiers + (ARBITRARY_PROP_ALIAS[prop] ?? `@${prop}`);
  } else {
    for (const [pattern, key] of BUCKET_PATTERNS) {
      const match = base.match(pattern);
      if (match) {
        const bucketKey = typeof key === 'string' ? key : key(match);
        result = modifiers + bucketKey;
        break;
      }
    }
  }

  if (BUCKET_CACHE.size < BUCKET_CACHE_MAX) BUCKET_CACHE.set(cls, result);
  return result;
}

// Directional shorthand dominance: a LATER class in bucket K also strips
// earlier classes in DOMINANCE[K]. Longhands never strip their shorthand —
// a later `pl-2` composes with an earlier `p-4` (Tailwind's own cascade
// resolves the left side), but a later `p-0` fully replaces earlier `px-4`
// or `pl-10`, matching what the override author means.
//
// Deliberately absent: `text-size` → `line-height`. The library pairs a
// slot-base `leading-*` with axis-supplied `text-*` across sources by
// design (labels, timeline meta, table cells) — stripping the leading would
// silently change typography; leading-* also wins Tailwind's own cascade.
const DOMINANCE: Record<string, string[]> = {
  p: ['px', 'py', 'ps', 'pe', 'pt', 'pr', 'pb', 'pl'],
  px: ['pr', 'pl'],
  py: ['pt', 'pb'],
  m: ['mx', 'my', 'ms', 'me', 'mt', 'mr', 'mb', 'ml'],
  mx: ['mr', 'ml'],
  my: ['mt', 'mb'],
  inset: ['inset-x', 'inset-y', 'start', 'end', 'top', 'right', 'bottom', 'left'],
  'inset-x': ['right', 'left'],
  'inset-y': ['top', 'bottom'],
  size: ['w', 'h'],
  gap: ['gap-x', 'gap-y'],
  rounded: [
    'rounded-tl',
    'rounded-tr',
    'rounded-bl',
    'rounded-br',
    'rounded-ss',
    'rounded-se',
    'rounded-es',
    'rounded-ee',
    'rounded-t',
    'rounded-r',
    'rounded-b',
    'rounded-l',
    'rounded-s',
    'rounded-e'
  ],
  'rounded-t': ['rounded-tl', 'rounded-tr'],
  'rounded-r': ['rounded-tr', 'rounded-br'],
  'rounded-b': ['rounded-bl', 'rounded-br'],
  'rounded-l': ['rounded-tl', 'rounded-bl'],
  'rounded-s': ['rounded-ss', 'rounded-es'],
  'rounded-e': ['rounded-se', 'rounded-ee'],
  'border-width': [
    'border-x-width',
    'border-y-width',
    'border-s-width',
    'border-e-width',
    'border-t-width',
    'border-r-width',
    'border-b-width',
    'border-l-width'
  ],
  'border-x-width': ['border-r-width', 'border-l-width'],
  'border-y-width': ['border-t-width', 'border-b-width'],
  'border-color': [
    'border-x-color',
    'border-y-color',
    'border-s-color',
    'border-e-color',
    'border-t-color',
    'border-r-color',
    'border-b-color',
    'border-l-color'
  ],
  'border-x-color': ['border-r-color', 'border-l-color'],
  'border-y-color': ['border-t-color', 'border-b-color'],
  overflow: ['overflow-x', 'overflow-y'],
  scale: ['scale-x', 'scale-y'],
  translate: ['translate-x', 'translate-y', 'translate-z']
};

/**
 * Removes classes from `prior` whose conflict-bucket appears in `current`,
 * including buckets a later shorthand dominates (`p-0` strips `px-4`).
 * Stable order preserved within each side.
 */
function stripConflicts(prior: string[], current: string[]): string[] {
  if (prior.length === 0 || current.length === 0) return prior;
  const used = new Set<string>();
  for (const cls of current) {
    const b = tailwindBucket(cls);
    if (!b) continue;
    used.add(b);
    // Dominance expansion keeps the modifier prefix: `hover:p` dominates
    // `hover:px`, never the plain-state `px`. Bucket keys contain no `:`,
    // so the last colon is the modifier boundary.
    const keyStart = b.lastIndexOf(':') + 1;
    const dominated = DOMINANCE[b.slice(keyStart)];
    if (dominated) {
      const mods = b.slice(0, keyStart);
      for (const d of dominated) used.add(mods + d);
    }
  }
  if (used.size === 0) return prior;
  return prior.filter((cls) => {
    const b = tailwindBucket(cls);
    return b == null || !used.has(b);
  });
}

/**
 * Folds an ordered list of class-token sources into one list: each source
 * strips the accumulated earlier sources' conflicting buckets, then appends
 * its own tokens. The last source therefore wins per bucket — deterministic,
 * independent of stylesheet order.
 *
 * Within a single source, order is preserved and same-bucket pairs fall
 * through to the CSS cascade — author-controlled pairings inside one class
 * string (`rounded-md rounded-t-none`) stay intact.
 */
function foldSources(sources: string[][]): string[] {
  let acc: string[] = [];
  for (const tokens of sources) {
    if (tokens.length === 0) continue;
    acc = acc.length === 0 ? tokens : [...stripConflicts(acc, tokens), ...tokens];
  }
  return acc;
}

/**
 * Tokenize a class-string into individual class tokens. Whitespace-only
 * fragments and empty strings are filtered.
 */
function tokenize(value: string): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Merge class strings with the same Tailwind conflict resolution `tv()`
 * applies between stages: a later source's classes strip any earlier class
 * that shares their conflict bucket, so the last source wins per bucket.
 * Within a single source, order is preserved and conflicts fall through to
 * the CSS cascade. Falsy / empty sources are skipped.
 *
 * Reuses `tokenize` + `stripConflicts`. Powers the BlocksProvider slot-class
 * cascade (`resolveSlotClasses`) so a conditional `overrides` entry
 * deterministically defeats an unconditional `slotClasses` entry in the same
 * bucket — instead of emitting both and leaving the winner to stylesheet
 * order.
 */
export function resolveClassChain(...sources: (string | null | undefined)[]): string {
  let acc: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    const tokens = tokenize(source);
    if (tokens.length === 0) continue;
    acc = [...stripConflicts(acc, tokens), ...tokens];
  }
  return acc.join(' ');
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function falsyToString(value: unknown): string | undefined {
  if (value === false) return 'false';
  if (value === true) return 'true';
  if (value === 0) return '0';
  if (value == null) return undefined;
  return String(value);
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export function matchesCompound(
  compound: Record<string, unknown>,
  effectiveProps: Record<string, unknown>
): boolean {
  for (const key of Object.keys(compound)) {
    if (key === 'class') continue;

    const constraint = compound[key];
    const propValue = falsyToString(effectiveProps[key]);

    if (Array.isArray(constraint)) {
      if (!constraint.map(falsyToString).includes(propValue)) return false;
    } else {
      if (falsyToString(constraint) !== propValue) return false;
    }
  }
  return true;
}

function resolveClassValue(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return cx(...(value as ClassInput[]));
  return '';
}

// ─── tv: main function ──────────────────────────────────────────────────────

type VariantMap = Record<string, Record<string, unknown>>;
type CompoundEntry = Record<string, unknown>;
type PropBag = Record<string, unknown>;

/**
 * Config-time validation — every violation here is a programming error in a
 * `*.variants.ts` (or a consumer's own tv() call), so it throws immediately
 * at module init instead of degrading silently at render time. The compile-
 * time layer (ValidSlotVariants, VariantPropsMap) catches the same class of
 * mistakes for literal configs; this covers JS consumers and values built
 * from imported constants.
 *
 * Error codes (prod builds throw the bare code to keep message bytes out of
 * consumer bundles; reproduce in dev for the full message. Codes are stable —
 * never renumber, append only):
 * - tv:E1  — `base` and `slots` are mutually exclusive
 * - tv:E2  — plain class value routes to 'base', but no 'base' slot is declared
 * - tv:E3  — class leaf is not a string / nested array of strings
 * - tv:E4  — slot map given, but this tv() declares no slots
 * - tv:E5  — value targets an undeclared slot name
 * - tv:E6  — value is neither class string, array nor slot map
 * - tv:E7  — compoundVariants references an unknown variant axis
 * - tv:E8  — compoundVariants matches a value the axis does not declare
 * - tv:E9  — defaultVariants references an unknown variant axis
 * - tv:E10 — defaultVariants value is not declared on its axis
 */
function validateTvConfig(config: {
  base?: string | string[];
  slots?: Record<string, string | string[]>;
  variants?: VariantMap;
  compoundVariants?: CompoundEntry[];
  defaultVariants?: PropBag;
}): void {
  const { base, slots, variants = {}, compoundVariants = [], defaultVariants = {} } = config;
  const slotNames = slots != null && Object.keys(slots).length > 0 ? Object.keys(slots) : null;

  if (slotNames && base != null) {
    // Fail loud instead of the historical silent drop (base only ever
    // reached a slot literally named 'base').
    throw new Error(
      import.meta.env?.DEV
        ? 'tv(): `base` and `slots` are mutually exclusive — declare the primary slot as `slots.base` instead.'
        : 'tv:E1'
    );
  }

  const requireBaseSlot = (context: string) => {
    if (slotNames && !slotNames.includes('base')) {
      throw new Error(
        import.meta.env?.DEV
          ? `tv(): ${context} is a plain class value, which routes to the 'base' slot — but no slot named 'base' is declared.`
          : 'tv:E2'
      );
    }
  };

  // Leaf values must bottom out in class strings (nested arrays allowed,
  // falsy entries tolerated for conditional-array patterns). Objects inside
  // arrays and scalar garbage would silently render as '' — or worse, leak
  // through cx()'s record form as literal slot-name classes — so they throw.
  const checkClassLeaf = (value: unknown, context: string): void => {
    if (value == null || value === false) return;
    if (typeof value === 'string') return;
    if (Array.isArray(value)) {
      for (const [i, v] of value.entries()) {
        checkClassLeaf(v, `${context}[${i}]`);
      }
      return;
    }
    throw new Error(
      import.meta.env?.DEV
        ? `tv(): ${context} must be a class string (or nested array of strings), got ${typeof value}.`
        : 'tv:E3'
    );
  };

  const checkSlotKeys = (value: unknown, context: string) => {
    if (value == null) return;
    if (typeof value === 'string' || Array.isArray(value)) {
      if (slotNames) requireBaseSlot(context);
      checkClassLeaf(value, context);
      return;
    }
    if (typeof value === 'object') {
      if (!slotNames) {
        throw new Error(
          import.meta.env?.DEV
            ? `tv(): ${context} is a slot map, but this tv() declares no slots — use a plain class string/array.`
            : 'tv:E4'
        );
      }
      for (const key of Object.keys(value)) {
        if (!slotNames.includes(key)) {
          throw new Error(
            import.meta.env?.DEV
              ? `tv(): ${context} targets unknown slot '${key}' (declared slots: ${slotNames.join(', ')}).`
              : 'tv:E5'
          );
        }
        checkClassLeaf((value as Record<string, unknown>)[key], `${context}.${key}`);
      }
      return;
    }
    throw new Error(
      import.meta.env?.DEV
        ? `tv(): ${context} must be a class string, array or slot map, got ${typeof value}.`
        : 'tv:E6'
    );
  };

  for (const [axis, values] of Object.entries(variants)) {
    for (const [valueName, value] of Object.entries(values)) {
      checkSlotKeys(value, `variants.${axis}.${valueName}`);
    }
  }

  for (const [i, cv] of compoundVariants.entries()) {
    for (const key of Object.keys(cv)) {
      if (key === 'class') continue;
      const axis = variants[key];
      if (axis == null) {
        throw new Error(
          import.meta.env?.DEV
            ? `tv(): compoundVariants[${i}] references unknown variant axis '${key}'.`
            : 'tv:E7'
        );
      }
      const constraint = cv[key];
      const values = Array.isArray(constraint) ? constraint : [constraint];
      const booleanAxis = 'true' in axis || 'false' in axis;
      for (const v of values) {
        const normalized = falsyToString(v);
        // 'true'/'false' may be matched even when only one of them is
        // declared — half-declared boolean axes are idiomatic
        // (`loading: { true: … }` + a compound on `loading: false`). The
        // escape only applies to boolean-ish axes; `size: true` on a string
        // axis is a config error.
        if ((normalized === 'true' || normalized === 'false') && booleanAxis) continue;
        if (normalized == null || !(normalized in axis)) {
          throw new Error(
            import.meta.env?.DEV
              ? `tv(): compoundVariants[${i}] matches '${key}: ${String(v)}', but axis '${key}' declares no such value (values: ${Object.keys(axis).join(', ')}).`
              : 'tv:E8'
          );
        }
      }
    }
    checkSlotKeys(cv.class, `compoundVariants[${i}].class`);
  }

  for (const [key, value] of Object.entries(defaultVariants)) {
    const axis = variants[key];
    if (axis == null) {
      throw new Error(
        import.meta.env?.DEV
          ? `tv(): defaultVariants references unknown variant axis '${key}'.`
          : 'tv:E9'
      );
    }
    const normalized = falsyToString(value);
    const booleanAxis = 'true' in axis || 'false' in axis;
    if ((normalized === 'true' || normalized === 'false') && booleanAxis) continue;
    if (normalized == null || !(normalized in axis)) {
      throw new Error(
        import.meta.env?.DEV
          ? `tv(): defaultVariants.${key} = '${String(value)}' is not a declared value of axis '${key}' (values: ${Object.keys(axis).join(', ')}).`
          : 'tv:E10'
      );
    }
  }
}

/**
 * Config record exposed on every resolver as `.config` (tooling/linting).
 * Read-only by convention: it is the live config object — mutating it after
 * init bypasses validateTvConfig. Tools must treat it as immutable.
 */
export type TVConfig = {
  readonly base?: string | string[];
  readonly slots?: Record<string, string | string[]>;
  readonly variants?: Record<string, Record<string, unknown>>;
  readonly compoundVariants?: Record<string, unknown>[];
  readonly defaultVariants?: Record<string, unknown>;
};

// Overload: no slots → returns (props?) => string. Variant values are plain
// class strings/arrays — a slot map here is a config error.
// When variants is omitted, V defaults to `{}` so `class` overrides don't
// collide with the wide index-signature inferred from the generic constraint.
// biome-ignore lint/complexity/noBannedTypes: empty-object default keeps `class` overrides from colliding with the inferred index signature (see above).
export function tv<V extends Record<string, Record<string, string | string[]>> = {}>(config: {
  base?: string | string[];
  variants?: V;
  compoundVariants?: CompoundVariant<V>[];
  defaultVariants?: VariantPropsMap<V>;
}): ((props?: TVProps<V>) => string) & { readonly config: TVConfig };

// Overload: with slots → returns (props?) => { [slot]: (slotProps?) => string }.
// No `base` here: the primary slot is declared as `slots.base`. And no
// top-level `class` on the resolve call — class overrides belong to the
// slot functions (`styles.base({ class })`), a top-level one has no slot
// to attach to. Slot-map keys in variant values and compound classes are
// compile-checked against the declared slots (ValidSlotVariants).
export function tv<
  // biome-ignore lint/complexity/noBannedTypes: empty-object default keeps `class` overrides from colliding with the inferred index signature (see above).
  V extends Record<string, Record<string, unknown>> = {},
  S extends Record<string, string | string[]> = Record<string, string>
>(config: {
  slots: S;
  variants?: V & ValidSlotVariants<V, S>;
  compoundVariants?: SlotCompoundVariant<V, S>[];
  defaultVariants?: VariantPropsMap<V>;
}): ((props?: VariantPropsMap<V>) => { [K in keyof S]: SlotFn<V> }) & {
  readonly config: TVConfig;
};

// Implementation
export function tv(config: {
  base?: string | string[];
  slots?: Record<string, string | string[]>;
  variants?: VariantMap;
  compoundVariants?: CompoundEntry[];
  defaultVariants?: PropBag;
}): unknown {
  validateTvConfig(config);

  const { base, slots, variants = {}, compoundVariants = [], defaultVariants = {} } = config;
  const variantEntries = Object.entries(variants);
  const hasSlots = slots != null && Object.keys(slots).length > 0;

  /**
   * Shared pipeline: first source → each variant axis in declaration order →
   * each matching compoundVariant in array order → call-site class override.
   * `foldSources` lets every later source strip earlier sources' conflicting
   * buckets, so axis and compound order are semantic: declare the axis that
   * must win a shared bucket later. See "tv() engine — explicit trade-offs"
   * in ARCHITECTURE.md. `pickValue` routes config values: identity in no-slot
   * mode; per-slot lookup (slot maps by name, plain strings to the 'base'
   * slot) in slot mode.
   */
  function foldFor(
    firstSource: string[],
    effective: PropBag,
    pickValue: (value: unknown) => unknown,
    overrideTokens: string[]
  ): string {
    const sources: string[][] = [firstSource];
    for (const [vName, vMap] of variantEntries) {
      const key = falsyToString(effective[vName]);
      if (key == null || !(key in vMap)) continue;
      sources.push(tokenize(resolveClassValue(pickValue(vMap[key]))));
    }
    for (const cv of compoundVariants) {
      if (!matchesCompound(cv, effective)) continue;
      sources.push(tokenize(resolveClassValue(pickValue(cv.class))));
    }
    sources.push(overrideTokens);
    return foldSources(sources).join(' ');
  }

  if (!hasSlots) {
    const identity = (value: unknown) => value;
    const baseTokens = tokenize(resolveClassValue(base));
    const resolve = function resolve(props?: PropBag): string {
      const effective = { ...defaultVariants, ...stripUndefined(props || {}) };
      const overrideTokens = props?.class ? tokenize(cx(props.class as ClassInput)) : [];
      return foldFor(baseTokens, effective, identity, overrideTokens);
    };
    // Introspection hook for tooling (variants linter, docs-gen) — the
    // config is static module data, exposing it costs nothing.
    Object.defineProperty(resolve, 'config', { value: config, enumerable: false });
    return resolve;
  }

  // Slot mode — `slots` is narrowed to non-null by `hasSlots`.
  const slotNames = Object.keys(slots as Record<string, string | string[]>);
  const slotBases = new Map<string, string[]>();
  for (const slotName of slotNames) {
    slotBases.set(
      slotName,
      tokenize(resolveClassValue((slots as Record<string, string | string[]>)[slotName]))
    );
  }

  const pickerFor =
    (slotName: string) =>
    (value: unknown): unknown => {
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        return (value as Record<string, unknown>)[slotName];
      }
      // Plain string/array config values route to the 'base' slot only.
      return slotName === 'base' ? value : undefined;
    };

  const resolve = function resolve(props?: PropBag) {
    if (import.meta.env?.DEV && props != null && (props as PropBag).class != null) {
      console.warn(
        `tv(): a top-level \`class\` is ignored in slot mode (slots: ${slotNames.join(', ')}) — pass it to the slot function instead, e.g. styles.base({ class }).`
      );
    }
    const topProps = { ...defaultVariants, ...stripUndefined(props || {}) };
    const result: Record<string, (slotProps?: PropBag) => string> = {};

    for (const slotName of slotNames) {
      const pick = pickerFor(slotName);
      const slotBase = slotBases.get(slotName) as string[];
      result[slotName] = function slotFn(slotProps?: PropBag): string {
        const effective = { ...topProps, ...stripUndefined(slotProps || {}) };
        const overrideTokens = slotProps?.class ? tokenize(cx(slotProps.class as ClassInput)) : [];
        return foldFor(slotBase, effective, pick, overrideTokens);
      };
    }

    return result;
  };
  Object.defineProperty(resolve, 'config', { value: config, enumerable: false });
  return resolve;
}
