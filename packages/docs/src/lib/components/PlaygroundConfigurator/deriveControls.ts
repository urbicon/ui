import type { ControlDefinition, ControlOption } from '@urbicon-ui/shared-types/playground';
import { extractLiteralValues } from '../TypesReference';

/**
 * The slice of a generated `api.ts` that control derivation needs. Structural,
 * not imported from docs-gen — the docs package must not depend on the
 * generator, and every consumer already has this object in hand.
 */
export interface DerivableComponentData {
  variants?: Array<{ name: string; values: string[]; defaultValue?: string }>;
  props?: Array<{ name: string; type?: string; values?: string[]; defaultValue?: string }>;
  /**
   * Local type definitions the component's props refer to. Used to resolve a
   * named alias (`size: ComponentSize`) to its literal values — the extractor
   * records the alias but not what it stands for.
   */
  types?: Array<{ name: string; definition?: string }>;
}

/** Per-key adjustments merged onto a derived control. */
export type ControlOverride = Partial<Omit<ControlDefinition, 'key'>>;

export interface DeriveControlsOptions {
  /**
   * Keys to render, in this order. Every key must be derivable or carry an
   * `override` supplying what derivation cannot know — an unknown key throws
   * rather than silently disappearing from the playground.
   */
  pick: string[];
  /** Adjustments per key: a nicer label, a narrowed item list, min/max, … */
  overrides?: Record<string, ControlOverride>;
  /**
   * Controls that are **not props at all** — playground affordances such as
   * Slider's `showMarks`, which toggles a `marks={[…]}` array, or A2UIView's
   * scenario switch, which picks a payload. Appended in order after the picked
   * ones unless `at` places them.
   *
   * Everything here is marked `demoOnly` and therefore never reaches the
   * generated code snippet. A prop whose type the extractor cannot resolve does
   * **not** belong here — it goes in `overrides` with an explicit `type`, or it
   * silently disappears from the snippet. `deriveControls.test.ts` guards the
   * mechanical half of that distinction.
   */
  extra?: Array<ControlDefinition & { at?: number }>;
}

/** `showValue` → "Show value", `nodeAlign` → "Node align". */
function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * The design system's two ordered scales. docs-gen emits variant values
 * **alphabetically**, which turns a size axis into `lg, md, sm` and an intent
 * axis into `danger, neutral, primary, …` — readable as a list, wrong as a
 * scale. Reordering happens by *content*, not by key name, so an axis called
 * `itemSize` or `dotIntent` is fixed too.
 */
const SCALE_ORDER = [
  // `none` is the bottom rung of a spacing scale (Card's `padding`,
  // SidebarLayout's `contentMaxWidth`), `full`/`fullscreen` the top rung of a
  // size scale (Drawer, Dialog). Without them here `values.every(…)` fails and
  // the whole axis falls back to alphabetical — which is how Dialog ended up
  // offering `full, fullscreen, lg, md, sm, xl`.
  'none',
  '3xs',
  '2xs',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  'full',
  'fullscreen'
];
const INTENT_ORDER = [
  'primary',
  'secondary',
  'success',
  'warning',
  'danger',
  'info',
  'neutral',
  'current'
];

function canonicalOrder(values: string[]): string[] {
  for (const order of [SCALE_ORDER, INTENT_ORDER]) {
    if (values.every((v) => order.includes(v))) {
      return [...values].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
  }
  return values;
}

function toItems(values: string[]): ControlOption[] {
  return canonicalOrder(values).map((v) => ({ label: v, value: v }));
}

/**
 * `defaultValue` in a generated `api.ts` is the **source literal**, not the
 * value: `"'week'"`, `"true"`, `"42"`. Passing it through unparsed hands the
 * component a string with quotes in it — which is how a Planner ended up with
 * `view="'week'"` and crashed its date grid. Anything that isn't a plain
 * literal (an object, a call, an identifier) yields `undefined`: no default is
 * better than a wrong one.
 */
function parseDefault(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  const v = raw.trim();
  const quoted = v.match(/^'([^']*)'$/) ?? v.match(/^"([^"]*)"$/);
  if (quoted) return quoted[1];
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return undefined;
}

/**
 * Values of a prop whose type is a named alias (`size: ComponentSize`).
 *
 * The extractor records the alias, not the union behind it, so `values` stays
 * empty and the prop looks underivable. The definition is right there in
 * `types[]` though — resolving it locally beats waiting for the extractor.
 *
 * Two shapes stay unresolvable and need an `override`: computed unions
 * (`(typeof INTENTS)[number]`) and indexed variant access
 * (`ButtonVariants['variant']`). Both are recorded in docs/technical-debt.md.
 */
function resolveAliasValues(
  type: string | undefined,
  types: DerivableComponentData['types']
): string[] | null {
  if (!type || !types?.length) return null;
  const alias = types.find((t) => t.name === type.trim());
  if (!alias?.definition) return null;
  const values = extractLiteralValues(alias.definition);
  return values.length > 1 ? values : null;
}

/**
 * Builds playground controls from the component's generated API data, so the
 * knobs a reader sees are the values the component actually accepts.
 *
 * Hand-written control literals drift: at the time this was introduced, twelve
 * dropdowns across the docs had fallen behind their component — `Select` was
 * missing `xs`/`xl`, `Alert` and `Toaster` were missing `info`, `Dialog` was
 * missing `fullscreen`, and `CompositionBar` offered a `legendPlacement` value
 * the component had dropped. Derivation removes that whole class of error: a
 * new variant value shows up in the playground the next time docs-gen runs.
 *
 * Derivation is deliberately opt-in per key (`pick`) rather than "every prop":
 * a playground is an edited selection, and `class`, `preset`, `slotClasses` or
 * callbacks have no business being knobs.
 *
 * What it cannot know stays explicit: demo-only toggles go in `extra`, and
 * anything derivation gets wrong is corrected per key in `overrides`.
 *
 * @throws if a picked key is neither derivable nor fully supplied by an
 * override — a typo would otherwise drop a control without a trace.
 *
 * @example
 * ```ts
 * const controls = deriveControls(componentData, {
 *   pick: ['variant', 'intent', 'size', 'range', 'showValue', 'disabled'],
 *   overrides: { step: { items: [1, 5, 10, 25].map((v) => ({ label: `${v}`, value: v })) } },
 *   extra: [{ type: 'checkbox', key: 'showMarks', label: 'Show marks', defaultValue: false }]
 * });
 * ```
 */
export function deriveControls(
  data: DerivableComponentData,
  { pick, overrides = {}, extra = [] }: DeriveControlsOptions
): ControlDefinition[] {
  const variants = new Map((data.variants ?? []).map((v) => [v.name, v]));
  const props = new Map((data.props ?? []).map((p) => [p.name, p]));

  const derived = pick.map((key) => {
    const override = overrides[key];
    const variant = variants.get(key);
    const prop = props.get(key);
    const aliasValues = prop?.values?.length ? null : resolveAliasValues(prop?.type, data.types);

    let base: ControlDefinition | null = null;

    if (variant) {
      // A tv() axis over booleans is a flag, not a choice — whether it declares
      // only `true` (`removable: { true: {} }`) or both keys
      // (`accentEdge: { true: {}, false: {} }`). Both spellings are idiomatic in
      // this repo's variant configs, and missing the second one produced a
      // *string* dropdown: `values.accentEdge` became `'false'`, which is truthy,
      // so the rendered Toggle read "on" while the component — where tv()
      // normalises `'false'` back to the false branch — stayed off. Drawer's
      // accent edge, CodeBlock's `wrap` and Popover's `syncWidth` all sat on
      // that gap.
      const isFlag =
        variant.values.length > 0 && variant.values.every((v) => v === 'true' || v === 'false');
      base = isFlag
        ? {
            type: 'checkbox',
            key,
            label: humanize(key),
            defaultValue: variant.defaultValue === 'true'
          }
        : {
            type: 'dropdown',
            key,
            label: humanize(key),
            items: toItems(variant.values),
            defaultValue: variant.defaultValue ?? variant.values[0]
          };
    } else if (prop?.values?.length || aliasValues) {
      const values = (prop?.values?.length ? prop.values : aliasValues) as string[];
      base = {
        type: 'dropdown',
        key,
        label: humanize(key),
        items: toItems(values),
        defaultValue: parseDefault(prop?.defaultValue) ?? canonicalOrder(values)[0]
      };
    } else if (prop?.type === 'boolean') {
      base = {
        type: 'checkbox',
        key,
        label: humanize(key),
        defaultValue: parseDefault(prop.defaultValue) ?? false
      };
    } else if (prop?.type === 'number') {
      base = {
        type: 'number',
        key,
        label: humanize(key),
        defaultValue: parseDefault(prop.defaultValue)
      };
    } else if (prop?.type === 'string') {
      base = {
        type: 'text',
        key,
        label: humanize(key),
        defaultValue: parseDefault(prop.defaultValue)
      };
    }

    if (!base) {
      // An override may carry the whole definition for props whose type the
      // extractor could not resolve (`ButtonVariants['size']`, `MintProp`, …).
      // `componentDefault: undefined` is set deliberately, not forgotten: the
      // key has to *exist* so the code generator knows the component has no
      // default here and must print the value (see `computeOmittableDefaults`).
      if (override?.type) {
        return {
          key,
          label: humanize(key),
          componentDefault: undefined,
          ...override
        } as ControlDefinition;
      }
      throw new Error(
        `deriveControls: "${key}" is neither a variant axis nor a typed prop of this component. ` +
          `Supply it via \`overrides.${key}\` (with a \`type\`) or move it to \`extra\`.`
      );
    }

    // The derived default is what the *component* does without the prop. An
    // override may move where the playground starts (`searchDebounceMs: 100`
    // on a component that defaults to 300) — keep the original, or the code
    // snippet would omit exactly the props that make the preview look the way
    // it does.
    return { componentDefault: base.defaultValue, ...base, ...override };
  });

  // `at` lets a demo-only knob sit between derived ones (Slider's `showMarks`
  // belongs next to the other display toggles, not after `disabled`).
  const result = [...derived];
  for (const { at, ...control } of extra) {
    const marked = { demoOnly: true, ...control };
    if (at === undefined) result.push(marked);
    else result.splice(at, 0, marked);
  }
  return result;
}

/** Default values map matching a control list — feeds `values` on the configurator. */
export function defaultValuesOf(controls: ControlDefinition[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const c of controls) if (c.defaultValue !== undefined) values[c.key] = c.defaultValue;
  return values;
}
