// ─── Type Utilities ──────────────────────────────────────────────────────────

type ClassInput = string | ClassInput[] | undefined | null | false;

type VariantPropType<V> =
  V extends Record<string, unknown>
    ? 'true' extends Extract<keyof V, string>
      ? boolean | Exclude<Extract<keyof V, string>, 'true' | 'false'>
      : Extract<keyof V, string>
    : never;

type VariantPropsMap<V extends Record<string, Record<string, unknown>>> = {
  [K in keyof V]?: VariantPropType<V[K]>;
};

type TVClassOverrides = {
  class?: ClassInput;
  className?: ClassInput;
};

type SlotFn<V extends Record<string, Record<string, unknown>>> = (
  props?: VariantPropsMap<V> & TVClassOverrides
) => string;

type CompoundVariant<V extends Record<string, Record<string, unknown>>> = {
  [K in keyof V]?: VariantPropType<V[K]> | VariantPropType<V[K]>[];
} & {
  class?: string | string[] | Record<string, string | string[]>;
  className?: string | string[] | Record<string, string | string[]>;
};

// ─── Public Types ────────────────────────────────────────────────────────────

export type TVProps<V extends Record<string, Record<string, unknown>>> = VariantPropsMap<V> &
  TVClassOverrides;

export type VariantProps<T extends (...args: never[]) => unknown> = Omit<
  Exclude<Parameters<T>[0], undefined>,
  'class' | 'className'
>;

// ─── cx: class concatenation ─────────────────────────────────────────────────

/**
 * Concatenate class inputs into a single string. Accepts strings, nested
 * arrays, and falsy values (filtered out). Trims and joins with single
 * spaces.
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
    } else if (Array.isArray(input)) {
      const nested = cx(...input);
      if (nested) parts.push(nested);
    }
  }
  return parts.join(' ');
}

// ─── Tailwind Conflict Resolver ──────────────────────────────────────────────
//
// Determines which "bucket" a Tailwind utility class belongs to. Two classes
// with the same bucket key are treated as conflicting; the later stage in the
// `tv()` resolution pipeline wins.
//
// Modifier prefixes (`hover:`, `focus-visible:`, `md:`, `dark:`, …) are part
// of the bucket key. `hover:bg-red` and `bg-red` therefore do NOT conflict.
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
  [/^flex-(1|auto|initial|none)$/, 'flex'],
  [/^grow(-0|-\[.+\])?$/, 'flex-grow'],
  [/^shrink(-0|-\[.+\])?$/, 'flex-shrink'],
  [/^basis-/, 'flex-basis'],
  [/^order-/, 'order'],
  [/^items-(start|end|center|baseline|stretch)$/, 'align-items'],
  [/^justify-(start|end|center|between|around|evenly|normal|stretch)$/, 'justify-content'],
  [/^justify-items-(start|end|center|stretch)$/, 'justify-items'],
  [/^justify-self-(auto|start|end|center|stretch)$/, 'justify-self'],
  [/^content-(start|end|center|between|around|evenly|baseline|stretch|normal)$/, 'align-content'],
  [/^self-(auto|start|end|center|stretch|baseline)$/, 'align-self'],
  [/^place-content-/, 'place-content'],
  [/^place-items-/, 'place-items'],
  [/^place-self-/, 'place-self'],
  [/^grid-cols-/, 'grid-template-columns'],
  [/^grid-rows-/, 'grid-template-rows'],
  [/^col-/, 'grid-column'],
  [/^row-/, 'grid-row'],
  [/^auto-cols-/, 'grid-auto-columns'],
  [/^auto-rows-/, 'grid-auto-rows'],
  [/^auto-flow-/, 'grid-auto-flow'],

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

  // Gap / space-between
  [/^gap-x-/, 'gap-x'],
  [/^gap-y-/, 'gap-y'],
  [/^gap-/, 'gap'],
  [/^space-x-/, 'space-x'],
  [/^space-y-/, 'space-y'],

  // Position offsets
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

  // Border style (must come before width/color)
  [/^border-(solid|dashed|dotted|double|hidden|none)$/, 'border-style'],
  // Border width — `border`, `border-1`, `border-2`, `border-[3px]` (Tailwind v4 accepts any integer)
  [/^border(-(\d+|\[[^\]]+\]))?$/, 'border-width'],
  // Border side-width — `border-x`, `border-t-2`, `border-r-[3px]`
  [/^border-(x|y|t|r|b|l|s|e)(-(\d+|\[[^\]]+\]))?$/, (m) => `border-${m[1]}-width`],
  // Border color (catch-all, e.g. `border-red-500`, `border-primary`, `border-border-subtle`)
  [/^border-(x|y|t|r|b|l|s|e)-/, (m) => `border-${m[1]}-color`],
  [/^border-/, 'border-color'],

  // Outline / ring
  [/^outline-(none|dashed|dotted|double|hidden)$/, 'outline-style'],
  [/^outline-offset-/, 'outline-offset'],
  [/^outline(-\d+|-\[[^\]]+\])?$/, 'outline-width'],
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
    /^bg-(top|right|bottom|left|center|left-top|left-bottom|right-top|right-bottom)$/,
    'bg-position'
  ],
  [/^bg-gradient-to-/, 'bg-image'],
  [/^bg-/, 'bg-color'],
  [/^from-/, 'gradient-from'],
  [/^via-/, 'gradient-via'],
  [/^to-/, 'gradient-to'],

  // Text — size / align / weight / color (specific first). v4 size+leading shorthand: `text-sm/6`, `text-base/relaxed`.
  [/^text-(xs|sm|base|lg|xl|\d+xl)(\/[\w.-]+)?$/, 'text-size'],
  // Arbitrary text-size values starting with a digit (e.g. `text-[11px]`,
  // `text-[1.5rem]`). Hex/named values like `text-[#fff]` / `text-[var(--x)]`
  // still fall through to the text-color catch-all below.
  [/^text-\[[0-9.]/, 'text-size'],
  [/^text-(left|center|right|justify|start|end)$/, 'text-align'],
  [/^text-(ellipsis|clip|wrap|nowrap|balance|pretty)$/, 'text-overflow'],
  [/^text-(current|inherit|transparent)$/, 'text-color'],
  [/^text-/, 'text-color'],
  [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, 'font-weight'],
  [/^font-(sans|serif|mono)$/, 'font-family'],
  [/^font-/, 'font-family'],
  [/^italic$|^not-italic$/, 'font-style'],
  [/^tracking-/, 'letter-spacing'],
  [/^leading-/, 'line-height'],
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
  [/^shadow-(inner|none)$/, 'shadow'],
  [/^shadow(-\w+)?$/, 'shadow'],
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
  [/^rotate-/, 'rotate'],
  [/^translate-x-/, 'translate-x'],
  [/^translate-y-/, 'translate-y'],
  [/^skew-x-/, 'skew-x'],
  [/^skew-y-/, 'skew-y'],
  [/^origin-/, 'transform-origin'],

  // Transitions / animations
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

/**
 * Returns the conflict-bucket key of a Tailwind class, or `null` if the class
 * does not match any catalogued utility family. Unknown classes never conflict.
 *
 * Modifier prefixes are part of the key — `hover:bg-red` returns `hover:bg-color`
 * while `bg-red` returns `bg-color`. The two never strip each other. `!`-important
 * is normalized away entirely so `!bg-red` and `bg-red` share a bucket.
 *
 * Results are memoized per process — `tailwindBucket` is called O(stages × classes)
 * per `tv()` resolve, and the same handful of class strings appear thousands of
 * times across a render tree. Cap kept high enough for any realistic application
 * surface; values are short and the map never frees.
 */
const BUCKET_CACHE = new Map<string, string | null>();
const BUCKET_CACHE_MAX = 4096;

function tailwindBucket(cls: string): string | null {
  const cached = BUCKET_CACHE.get(cls);
  if (cached !== undefined || BUCKET_CACHE.has(cls)) return cached!;

  // Split off all modifier prefixes (`hover:focus-visible:dark:md:bg-red`).
  const lastColon = cls.lastIndexOf(':');
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
  if (base.startsWith('-')) base = base.slice(1);

  let result: string | null = null;
  for (const [pattern, key] of BUCKET_PATTERNS) {
    const match = base.match(pattern);
    if (match) {
      const bucketKey = typeof key === 'string' ? key : key(match);
      result = modifiers + bucketKey;
      break;
    }
  }

  if (BUCKET_CACHE.size < BUCKET_CACHE_MAX) BUCKET_CACHE.set(cls, result);
  return result;
}

/**
 * Removes classes from `prior` whose conflict-bucket appears in `current`.
 * Stable order preserved within each side.
 */
function stripConflicts(prior: string[], current: string[]): string[] {
  if (prior.length === 0 || current.length === 0) return prior;
  const used = new Set<string>();
  for (const cls of current) {
    const b = tailwindBucket(cls);
    if (b) used.add(b);
  }
  if (used.size === 0) return prior;
  return prior.filter((cls) => {
    const b = tailwindBucket(cls);
    return b == null || !used.has(b);
  });
}

/**
 * Tokenize a class-string into individual class tokens. Whitespace-only
 * fragments and empty strings are filtered.
 */
function tokenize(value: string): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter(Boolean);
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

function matchesCompound(
  compound: Record<string, unknown>,
  effectiveProps: Record<string, unknown>
): boolean {
  for (const key of Object.keys(compound)) {
    if (key === 'class' || key === 'className') continue;

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

// Overload: no slots → returns (props?) => string
// When variants is omitted, V defaults to `{}` so `class` overrides don't
// collide with the wide index-signature inferred from the generic constraint.
// biome-ignore lint/complexity/noBannedTypes: empty-object default keeps `class` overrides from colliding with the inferred index signature (see above).
export function tv<V extends Record<string, Record<string, unknown>> = {}>(config: {
  base?: string | string[];
  variants?: V;
  compoundVariants?: CompoundVariant<V>[];
  defaultVariants?: VariantPropsMap<V>;
}): (props?: TVProps<V>) => string;

// Overload: with slots → returns (props?) => { [slot]: (slotProps?) => string }
export function tv<
  // biome-ignore lint/complexity/noBannedTypes: empty-object default keeps `class` overrides from colliding with the inferred index signature (see above).
  V extends Record<string, Record<string, unknown>> = {},
  S extends Record<string, string | string[]> = Record<string, string>
>(config: {
  base?: string | string[];
  slots: S;
  variants?: V;
  compoundVariants?: CompoundVariant<V>[];
  defaultVariants?: VariantPropsMap<V>;
}): (props?: TVProps<V>) => { [K in keyof S]: SlotFn<V> };

// Implementation
export function tv(config: {
  base?: string | string[];
  slots?: Record<string, string | string[]>;
  variants?: VariantMap;
  compoundVariants?: CompoundEntry[];
  defaultVariants?: PropBag;
}): unknown {
  const { base, slots, variants = {}, compoundVariants = [], defaultVariants = {} } = config;
  const variantEntries = Object.entries(variants);
  const hasSlots = slots != null && Object.keys(slots).length > 0;

  if (!hasSlots) {
    return function resolve(props?: PropBag): string {
      const effective = { ...defaultVariants, ...stripUndefined(props || {}) };

      // Pipeline stages — later stages strip earlier stages' conflicting
      // buckets. See "tv() engine — explicit trade-offs" in ARCHITECTURE.md.
      const baseTokens = tokenize(resolveClassValue(base));

      const variantTokens: string[] = [];
      for (const [vName, vMap] of variantEntries) {
        const key = falsyToString(effective[vName]);
        if (key != null && key in vMap) {
          variantTokens.push(...tokenize(resolveClassValue(vMap[key])));
        }
      }

      const compoundTokens: string[] = [];
      for (const cv of compoundVariants) {
        if (matchesCompound(cv, effective)) {
          compoundTokens.push(...tokenize(resolveClassValue(cv.class ?? cv.className)));
        }
      }

      const overrideTokens: string[] = [];
      if (props?.class) overrideTokens.push(...tokenize(resolveClassValue(props.class)));
      if (props?.className) overrideTokens.push(...tokenize(resolveClassValue(props.className)));

      // Strip in pipeline order: variants strip base, compounds strip
      // (base+variants), overrides strip all prior. Each stage's own classes
      // remain untouched.
      const afterVariants = [...stripConflicts(baseTokens, variantTokens), ...variantTokens];
      const afterCompounds = [...stripConflicts(afterVariants, compoundTokens), ...compoundTokens];
      const final = [...stripConflicts(afterCompounds, overrideTokens), ...overrideTokens];

      return final.join(' ');
    };
  }

  // Slot mode
  const slotEntries = Object.keys(slots!);

  return function resolve(props?: PropBag) {
    const topProps = { ...defaultVariants, ...stripUndefined(props || {}) };
    const result: Record<string, (slotProps?: PropBag) => string> = {};

    for (const slotName of slotEntries) {
      result[slotName] = function slotFn(slotProps?: PropBag): string {
        const effective = { ...topProps, ...stripUndefined(slotProps || {}) };

        // 1. Slot base (merge config.base into 'base' slot if present).
        //    `config.base` only contributes to a slot literally named
        //    `'base'`. If a component renames its primary slot (e.g. to
        //    `wrapper`), `config.base` is silently dropped — slots and
        //    config.base must agree on the name.
        const baseTokens: string[] = [];
        if (slotName === 'base' && base) {
          baseTokens.push(...tokenize(resolveClassValue(base)));
        }
        baseTokens.push(...tokenize(resolveClassValue(slots![slotName])));

        // 2. Per-slot variant resolution
        const variantTokens: string[] = [];
        for (const [vName, vMap] of variantEntries) {
          const key = falsyToString(effective[vName]);
          if (key == null || !(key in vMap)) continue;
          const vValue = vMap[key];

          if (vValue != null && typeof vValue === 'object' && !Array.isArray(vValue)) {
            const obj = vValue as Record<string, unknown>;
            if (slotName in obj) {
              variantTokens.push(...tokenize(resolveClassValue(obj[slotName])));
            }
          } else if (slotName === 'base') {
            variantTokens.push(...tokenize(resolveClassValue(vValue)));
          }
        }

        // 3. Compound variant resolution (per-slot)
        const compoundTokens: string[] = [];
        for (const cv of compoundVariants) {
          if (!matchesCompound(cv, effective)) continue;
          const cvClass = cv.class ?? cv.className;

          if (cvClass != null && typeof cvClass === 'object' && !Array.isArray(cvClass)) {
            const obj = cvClass as Record<string, unknown>;
            if (slotName in obj) {
              compoundTokens.push(...tokenize(resolveClassValue(obj[slotName])));
            }
          } else if (slotName === 'base') {
            compoundTokens.push(...tokenize(resolveClassValue(cvClass)));
          }
        }

        // 4. Class override from slotProps
        const overrideTokens: string[] = [];
        if (slotProps?.class) overrideTokens.push(...tokenize(resolveClassValue(slotProps.class)));
        if (slotProps?.className)
          overrideTokens.push(...tokenize(resolveClassValue(slotProps.className)));

        // Pipeline strip: later stage wins over earlier stage's conflicts.
        const afterVariants = [...stripConflicts(baseTokens, variantTokens), ...variantTokens];
        const afterCompounds = [
          ...stripConflicts(afterVariants, compoundTokens),
          ...compoundTokens
        ];
        const final = [...stripConflicts(afterCompounds, overrideTokens), ...overrideTokens];

        return final.join(' ');
      };
    }

    return result;
  };
}
