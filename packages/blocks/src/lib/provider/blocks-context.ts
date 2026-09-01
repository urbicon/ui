import { createOptionalContext } from '$lib/utils/optional-context';
import {
  effectiveVariants,
  matchesCompound,
  resolveClassChain,
  type TVConfig
} from '$lib/utils/variants';

/**
 * A prop-conditional style rule. Its non-`class` keys are matched against the
 * component's **effective** variant props — the same fold `tv()` styles it
 * with, so a rule sees an axis the component left out at its
 * `defaultVariants` value rather than as absent (see {@link effectiveVariants}).
 * `{ disabled: false }` therefore fires on every component whose config
 * declares a `disabled` axis defaulting to `false`, and a component with no
 * such axis — one that dims through the `disabled:` CSS variant instead of a
 * variant branch — cannot be addressed on it at all.
 *
 * Matching works like a `tv()` compoundVariant: `string` = equality,
 * `string[]` = "one of", `boolean` for a boolean axis such as the table's
 * `contained`; the comparison runs on the stringified value, so `true` and
 * `'true'` are the same condition. On a match, the `class` record (slot →
 * classes) is merged into the slot-class cascade. Additive: every matching
 * rule contributes; later sources win per Tailwind bucket.
 *
 * The keys are **variant axis names**, which are the component's public prop
 * names wherever it has one for the axis, and internal where the axis is
 * computed rather than received (`hasRightIcon`, `messageType`, `open`).
 *
 * @example
 * { variant: 'outlined', class: { base: 'border' } } // 1px border only on outlined
 */
export interface ConditionalOverride {
  /** Per-slot classes applied when the prop conditions match. */
  class: Record<string, string>;
  /** Prop conditions: prop name → required value (or one of several). */
  [propCondition: string]: string | string[] | boolean | Record<string, string> | undefined;
}

export interface ComponentDefaults {
  slotClasses?: Record<string, string>;
  /**
   * Prop-conditional style rules, applied after unconditional `slotClasses`
   * (so they win per bucket) but before instance-level `slotClasses` / `class`.
   * Use for surgical per-variant tweaks the unconditional `slotClasses` cannot
   * express, e.g. `overrides: [{ variant: 'outlined', class: { base: 'border' } }]`.
   */
  overrides?: ConditionalOverride[];
}

/**
 * A preset is a named, project-defined visual style for a component.
 * It provides `slotClasses` that are merged *after* provider defaults
 * but *before* instance-level `slotClasses` / `class`.
 *
 * Presets are the recommended way to introduce custom looks that fall
 * outside the semantic intent palette — instead of overriding styles
 * with `class="bg-…!"` at each usage site.
 */
export interface ComponentPreset {
  slotClasses?: Record<string, string>;
  /** Prop-conditional rules scoped to this preset (see {@link ConditionalOverride}). */
  overrides?: ConditionalOverride[];
}

/** Map of component name → preset name → preset definition. */
export type PresetMap = Record<string, Record<string, ComponentPreset>>;

export interface BlocksConfig {
  readonly unstyled: boolean;
  readonly defaults: Readonly<Record<string, ComponentDefaults>>;
  readonly presets: Readonly<PresetMap>;
}

// BlocksProvider is optional — components must work without one.
const [getBlocksConfig, setBlocksConfig] = createOptionalContext<BlocksConfig>();

export { getBlocksConfig, setBlocksConfig };

export function mergeSlotClasses(
  ...sources: (Record<string, string> | undefined)[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      if (!value) continue;
      result[key] = result[key] ? `${result[key]} ${value}` : value;
    }
  }
  return result;
}

/**
 * Look up a preset's `slotClasses` for a given component + preset name.
 * Returns `undefined` if no preset is registered (caller falls back to
 * provider defaults only). Emits a dev-only warning when a preset name
 * is used but not registered, so missing presets are discoverable.
 */
export function resolvePresetSlotClasses(
  presets: PresetMap | undefined,
  component: string,
  presetName: string | undefined
): Record<string, string> | undefined {
  if (!presetName) return undefined;

  const preset = presets?.[component]?.[presetName];
  if (!preset) {
    if (typeof window !== 'undefined' && import.meta.env?.DEV) {
      console.warn(
        `[BlocksProvider] Preset "${presetName}" for component "${component}" is not registered. ` +
          `Register it via <BlocksProvider presets={{ ${component}: { ${presetName}: { slotClasses: { … } } } }}>.`
      );
    }
    return undefined;
  }

  return preset.slotClasses;
}

/**
 * The `activeProps` a **wrapper** component hands {@link resolveSlotClasses}.
 *
 * A wrapper (NumberInput over Input, ConfirmDialog over Dialog) resolves its
 * own preset before the component it wraps ever runs, so it sees only the props
 * its caller wrote. Every axis the caller left out is defaulted *inside* the
 * inner component — which is where an `overrides` rule would otherwise have
 * been matched. Handing the written props through unchanged makes the rule
 * shape `packages/blocks/README.md` documents (`{ variant: 'outlined' }`) match
 * nothing at all under a wrapper's name, because the wrapper carries
 * `variant: undefined`.
 *
 * Which keys are axes at all is read off the inner component's own `tv()`
 * config rather than restated here — a rule may not key on `label`, which the
 * inner component's condition object never carries either. **Every** such axis
 * becomes a key, at `undefined` where the caller wrote nothing: a wrapper
 * stands in for the whole inner component, so it can speak for every axis that
 * component has, and {@link effectiveVariants} then answers the `undefined`
 * with the inner config's own default. That is what makes a wrapper and the
 * component it wraps give one rule the same answer.
 *
 * A component that is *not* a stand-in must not do this — an item beside its
 * siblings (`SegmentItem`) speaks only for the axes it names, or a rule keyed
 * on one of them would claim its neighbour's state.
 *
 * **What it cannot supply — and the direction matters.** A rule that fails to
 * fire is noticed; a rule that fires on a state the component is not in looks
 * like a success. Measured, three classes, all of them in #360:
 *
 * - *False hit, derived axis.* An axis the inner component computes rather than
 *   receives carries its config default here. Under a `commit` tier context
 *   `{ tier: 'modify' }` fires on NumberInput and `{ tier: 'commit' }` does not,
 *   though the rendered Input is `commit`; on `<NumberInput error="x">`,
 *   `{ messageType: 'helper' }` fires and `{ messageType: 'error' }` does not.
 * - *Coerced axis.* `error` is a `string` prop on Input and Select and a boolean
 *   axis in their configs. `{ error: true }` fires on the plain component and
 *   never on a wrapper; `{ error: 'x' }` fires on a wrapper and can never match
 *   inside. It is on Input and Select, so on all four wrappers.
 * - *Missed hit, unknowable axis.* An axis the inner component owns (`open` on
 *   Select) or derives from what it renders (`hasRightIcon`, which both input
 *   wrappers always set) carries its default here, so a rule on its other side
 *   never fires.
 *
 * One further axis is declared but passed per slot-call rather than per
 * component, so a rule on it fires here and not there: `iconPosition` on Input,
 * 1 of its 12 axes. (`selected` on Select is not a second case: it defaults to
 * `false` on `selectVariants`, and both sides now reach that default through
 * the same fold, so `{ selected: false }` fires under either name.)
 */
export function wrapperActiveProps(
  innerConfig: TVConfig,
  written: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const axis of Object.keys(innerConfig.variants ?? {})) {
    result[axis] = written[axis];
  }
  return result;
}

/**
 * Collect the per-slot classes of every `overrides` entry whose prop
 * conditions match `activeProps`. Returns `undefined` when there are no
 * overrides or none match. Multiple matches merge additively, in order.
 */
export function resolveOverrideSlotClasses(
  overrides: ConditionalOverride[] | undefined,
  activeProps: Record<string, unknown>
): Record<string, string> | undefined {
  if (!overrides || overrides.length === 0) return undefined;

  let result: Record<string, string> | undefined;
  for (const entry of overrides) {
    if (!matchesCompound(entry, activeProps)) continue;
    result ??= {};
    for (const [slot, value] of Object.entries(entry.class)) {
      if (!value) continue;
      result[slot] = result[slot] ? `${result[slot]} ${value}` : value;
    }
  }
  return result;
}

/**
 * Resolve the full slot-class cascade for a component instance, honoring
 * conditional `overrides` from both provider defaults and the active preset.
 *
 * Precedence (weak → strong), conflict-resolved per slot so a later source
 * wins within the same Tailwind bucket:
 *
 *   defaults.slotClasses → defaults.overrides[match]
 *     → preset.slotClasses → preset.overrides[match] → instance.slotClasses
 *
 * The result is handed to the component's `tv()` slot fn as the `class`
 * override, where it additionally strips conflicting library classes.
 *
 * `instanceSlotClasses` admits `undefined` values because that is what a
 * `Partial<XSlotClasses>` prop is: a slot the caller left out. Such a slot is
 * skipped, exactly like an empty string, and never reaches the result.
 *
 * `variantConfig` is the component's own `tv()` config (`xVariants.config`),
 * and it is required rather than optional on purpose: it is what supplies the
 * default for an axis the component named but left `undefined`
 * (see {@link effectiveVariants}). A call site that could omit it would
 * silently lose those, which is the defect this parameter exists to remove.
 *
 * **Required buys the presence of an argument, not the right one.** `TVConfig`
 * is optional in every field, so *any* config satisfies the parameter and the
 * compiler cannot tell `cardVariants.config` from `badgeVariants.config` here
 * — measured: wiring Badge's config into Card's call leaves every suite green
 * while four rules on axes Card does not have start matching every Card. Tying
 * the two together — `activeProps` typed as the props of *this* config — was
 * tried and does not fit: `datePickerVariants` declares no axes at all, and
 * `DatePicker` deliberately hands the resolver five keys that are not axes of
 * it but of the Input and Calendar it wraps. A type that rejected the mismatch
 * would reject that pattern too. Until a shape exists that admits both, the
 * pairing rests on the call site naming one identifier twice.
 */
export function resolveSlotClasses(
  config: BlocksConfig | undefined,
  component: string,
  preset: string | undefined,
  activeProps: Record<string, unknown>,
  instanceSlotClasses: Record<string, string | undefined> | undefined,
  variantConfig: TVConfig
): Record<string, string> {
  const defaults = config?.defaults?.[component];
  const presetDef = preset ? config?.presets?.[component]?.[preset] : undefined;
  const matchProps = effectiveVariants(variantConfig, activeProps);

  const sources: (Record<string, string | undefined> | undefined)[] = [
    defaults?.slotClasses,
    resolveOverrideSlotClasses(defaults?.overrides, matchProps),
    resolvePresetSlotClasses(config?.presets, component, preset),
    resolveOverrideSlotClasses(presetDef?.overrides, matchProps),
    instanceSlotClasses
  ];

  const result: Record<string, string> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [slot, value] of Object.entries(source)) {
      if (!value) continue;
      result[slot] = result[slot] ? resolveClassChain(result[slot], value) : value;
    }
  }
  return result;
}
