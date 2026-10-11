import { getBlocksConfig } from './blocks-context';
import type { ComponentSlotMap, ThemePropsOf } from './component-slots';

/**
 * The prop names a theme may default — `defaults.<Name>.props` and a preset's
 * `props` — library-wide. Style belongs in the theme, behaviour stays at the
 * call site: a name is on this list when, on every component that carries it,
 * it changes how the component looks and nothing else — not what it renders,
 * not how it behaves or is announced, not where it sits in the surrounding
 * layout, and not a state the user or the data drives.
 *
 * The classification behind the list, with the names it leaves out and why, is
 * COMPONENT-API-CONVENTIONS.md § Theme props. A name joins the list only when
 * it is a look on every component that declares it: `orientation` changes
 * arrow-key handling and `aria-orientation` on several, so it is out on all.
 *
 * A component admits the names it declares as props with a **vocabulary**
 * type — a literal union or a boolean (see {@link StylePropsOf}); a `size`
 * measured in pixels is a free value, not a look the library names.
 */
export const STYLE_PROPS = [
  'variant',
  'size',
  'intent',
  'tier',
  'inputVariant',
  'calendarVariant',
  'padding',
  'gap',
  'density',
  'spacing',
  'itemSize',
  'animation',
  'speed',
  'chevronAnimation',
  'loadingPlacement',
  'connected',
  'dividers',
  'withBorder',
  'accentEdge',
  'frame',
  'striped',
  'statusPosition',
  'ringIntent'
] as const;

/** One name from {@link STYLE_PROPS}. */
export type StyleProp = (typeof STYLE_PROPS)[number];

/** A literal union or a boolean; `string`, `number` and object types are not. */
type IsVocabulary<V> = [NonNullable<V>] extends [string | boolean]
  ? string extends NonNullable<V>
    ? false
    : true
  : false;

/** The arms of a props union an instance naming nothing can be in: no required member. */
type OpenArms<P> = P extends unknown ? (Partial<P> extends P ? P : never) : never;

/**
 * The props of `P` a theme may default: every member named in
 * {@link STYLE_PROPS} whose type is a vocabulary, at the type `P` gives it.
 *
 * A theme default reaches an instance that names nothing, so a props type split
 * into arms is read in the arms such an instance is in — those without a
 * required member. A value only a discriminated arm admits (Badge's
 * `variant: 'dot'`, which hides the badge's content) stays a call-site choice. A
 * props type with no such arm, or no union at all, is read whole.
 */
export type StylePropsOf<P> = StyleMembers<[OpenArms<P>] extends [never] ? P : OpenArms<P>>;

type StyleMembers<P> = P extends unknown
  ? {
      [A in keyof P as A extends StyleProp
        ? IsVocabulary<P[A]> extends true
          ? A
          : never
        : never]?: P[A];
    }
  : never;

const NO_THEME: Readonly<Record<string, unknown>> = Object.freeze({});

/** `component \0 source \0 key`, so one unknown key is reported once. */
const warnedThemeKeys = new Set<string>();

/**
 * Report a `props` key that is not a style prop at all. TypeScript rejects it
 * already; this is for a config written in JavaScript or typed as
 * `Record<string, ComponentDefaults>`, where it would otherwise type-check,
 * reach no component and change no markup. A key that *is* a style prop but
 * not one this component declares is not reported — the runtime cannot see
 * the component's props, and the type that can is what answers it.
 */
function warnUnknownThemeKeys(
  component: string,
  source: string,
  props: Readonly<Record<string, unknown>> | undefined
): void {
  if (!props) return;
  for (const key of Object.keys(props)) {
    if ((STYLE_PROPS as readonly string[]).includes(key)) continue;
    const seen = `${component}\u0000${source}\u0000${key}`;
    if (warnedThemeKeys.has(seen)) continue;
    warnedThemeKeys.add(seen);
    console.warn(
      `[BlocksProvider] The \`props\` under ${source} for component "${component}" sets ` +
        `"${key}", which is not a prop a theme may default — a theme sets a component's look ` +
        `(${STYLE_PROPS.join(', ')}), never its behaviour or state. Set "${key}" at the call site.`
    );
  }
}

/**
 * The theme's value for each style prop of one component instance: the
 * active preset's `props` first, then the provider `defaults` entry's —
 * `undefined` where neither sets one, so the component's own default applies.
 *
 * Read it where the component's own default is written, which is what places
 * the theme below the instance prop and above that default and nowhere else:
 *
 * ```ts
 * const theme = useThemeProps('Input', () => preset);
 * let { preset, variant = theme.variant ?? 'outlined', ...rest }: InputProps = $props();
 * ```
 *
 * Every read goes through the provider's config, so a theme switched at
 * runtime reaches mounted components. Call it during component
 * initialisation — it reads the provider context — and before `$props()`.
 *
 * **`preset` is read lazily and must be destructured before every prop whose
 * default reads this view.** The server render evaluates the destructuring in
 * source order, so a style prop listed ahead of `preset` reads the binding
 * before it is initialised and throws.
 *
 * Where something already beats the component's own default — a `TierContext`
 * from a Toolbar, a ButtonGroup's variant — it beats the theme too: read the
 * theme value in the place the own default is, behind those.
 */
export function useThemeProps<K extends keyof ComponentSlotMap>(
  component: K,
  preset?: () => string | undefined
): Readonly<ThemePropsOf<K>>;
/**
 * For a component outside this package (`@urbicon-ui/table`, a consumer's own
 * wrapper), whose props the package barrel cannot name: pass its props type.
 */
export function useThemeProps<P>(
  component: string,
  preset?: () => string | undefined
): Readonly<StylePropsOf<P>>;
export function useThemeProps(
  component: string,
  preset?: () => string | undefined
): Readonly<Record<string, unknown>> {
  const config = getBlocksConfig();
  if (!config) return NO_THEME;

  return new Proxy(NO_THEME, {
    get(_, key) {
      if (typeof key !== 'string') return undefined;
      const defaults = config.defaults?.[component]?.props;
      const presetName = preset?.();
      const presetProps = presetName ? config.presets?.[component]?.[presetName]?.props : undefined;
      // Inline, and the reporter reads `STYLE_PROPS` without a module-level
      // `new Set(…)`: a production build drops the reporter and the list only
      // then. Measured with `bun run size --breakdown` on Card: this module was
      // 1.0 KB min with the condition hoisted into a const, 0.5 KB with the
      // set, 0.2 KB with neither.
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        warnUnknownThemeKeys(component, 'defaults', defaults);
        warnUnknownThemeKeys(component, `preset "${presetName}"`, presetProps);
      }
      const fromPreset = presetProps?.[key];
      return fromPreset !== undefined ? fromPreset : defaults?.[key];
    }
  });
}
