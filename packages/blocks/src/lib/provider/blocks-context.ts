import { createOptionalContext } from '$lib/utils/optional-context';
import {
  effectiveVariants,
  matchesCompound,
  resolveClassChain,
  type TVConfig
} from '$lib/utils/variants';

/**
 * A prop-conditional style rule. Its non-`class` keys are matched against the
 * component's **effective** variant props: every axis that component's own
 * condition object *names*, at its value, or at the config's `defaultVariants`
 * value where it named the axis but wrote `undefined` (see
 * {@link effectiveVariants}). Naming is the boundary, not declaring — a rule
 * can only address an axis the component speaks for.
 *
 * So `{ disabled: false }` fires on every component that names a `disabled`
 * **key**, and on no others — declaring the axis is neither necessary nor
 * sufficient. `datePickerVariants` declares no axes at all and its rules fire,
 * because DatePicker names the keys of the Input it wraps. Three kinds fall
 * outside, all pinned in `provider/boolean-conditions.svelte.test.ts`: a
 * component with no such axis, which reaches the state some other way — the
 * `disabled:` CSS variant, forwarding to a component it wraps, another axis
 * carrying it, a predicate writing classes in the markup, or suppressing the
 * element rather than styling it; one whose config declares the axis while the
 * component hands it to a slot function per element rather than carrying it for
 * itself (`Menu`, whose rows each get their own `disabled`); and one the
 * provider cannot address at all, having no name registered.
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
 * The index signature admits any string, so a mistyped key type-checks and
 * paints nothing. A development build reports a key the component neither
 * passes nor declares — once, naming the keys that *can* match, which is the
 * passed half alone: an axis the config declares but the component hands to a
 * slot function per element can never match either, so the message keeps it out
 * of that list. A rule that is merely unmatched stays silent, being the normal
 * case. Only a rendered component is checked: a rule under a component name
 * that never mounts reaches nothing and is reported by nothing.
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
 * Keys already reported — `component \0 source \0 key` — so one mistyped key is
 * reported once rather than once per component instance and once more per
 * re-render, the cascade running inside a `$derived`. The message is built
 * behind this check rather than in front of it.
 */
const warnedConditionKeys = new Set<string>();

/**
 * Report an `overrides` condition key this component neither passes nor
 * declares. `ConditionalOverride`'s index signature admits any string on
 * purpose, so a typo (`varaint`) and a prop that is no axis (`label`) both
 * type-check, resolve to nothing and change no markup — indistinguishable from
 * a rule that is simply not matched, which is the normal case.
 *
 * **Silence takes the union of `named` and `declared`; the message names only
 * `named`, and the two must not be conflated.** Measured over the 88 components
 * that resolve a cascade:
 *
 * - a check against `declared` alone reports the keys a component only passes:
 *   the four wrappers hand over axes belonging to what they wrap, and
 *   `datePickerVariants` declares none of the five DatePicker passes. So
 *   `declared` has to buy silence;
 * - `matchesCompound` reads `effectiveProps[key]`, whose keys are exactly
 *   `named`. The 32 axes that are declared but not passed — 14 components,
 *   among them `state` on Stepper, `iconPosition` on Input, `dayState` on
 *   Calendar and Planner — can therefore never match, so recommending one sends
 *   the reader from one silent no-op into the next. Measured on the very path
 *   `docs/MIGRATION.md` describes: with `{ stepState: … }` reported,
 *   `{ state: 'active' }` still paints nothing while `{ orientation:
 *   'horizontal' }` paints.
 *
 * Which component *does* pass such an axis is not knowable here — a shared
 * config gives `Stepper` and `StepperStep` the same `declared`, and only the
 * running call says who passed what. The sentence names the axes and their
 * shape, not their owner.
 *
 * With `named` empty the diagnosis is the certain one rather than the weak one:
 * no conditional rule can match that component at all, so the message says so
 * instead of listing nothing. 22 components are in that state — 9 here and 13
 * in `@urbicon-ui/auth`, which routes them through one frozen empty config —
 * and none of the 88 has a non-empty `declared` beside an empty `named`.
 *
 * Quiet is not the same as inert: `falsyToString` maps a `null`/`undefined`
 * constraint to `undefined`, which is also what a missing key reads as, so
 * `{ varaint: undefined }` matches everything. The message therefore states
 * what the key is, not what the rule will do.
 *
 * **No sibling check for the `class` record's slot names.** The information is
 * not here: five components read slot names the config they hand this resolver
 * does not declare. Three read past a declared slot map — `NumberInput` takes
 * `stepper`/`stepperButton` from its own config while passing Input's,
 * `SidebarLayout` five `sidebar*` keys, `Guide` `skip`/`next` — and two,
 * `Popover` and `Separator`, pass a config carrying no `slots` at all and read
 * `base` off the result. Checking against `variantConfig.slots` would report
 * correct consumer config as mistyped in all five. A second parameter carrying
 * the missing names is the shape that would close it, and it would be
 * hand-maintained: the next forwarding component to omit it turns the check
 * into a false alarm on working code.
 *
 * **What it cannot see at all:** a rule reaches this function only when the
 * component it is written for actually renders under the provider. A mistyped
 * *component* name (`defaults: { Butoon: … }`) addresses nobody and stays
 * silent, as does every rule for a component the page never mounts.
 */
function warnUnknownConditionKeys(
  component: string,
  source: string,
  overrides: ConditionalOverride[] | undefined,
  named: string[],
  declared: string[]
): void {
  if (!overrides) return;
  for (const entry of overrides) {
    for (const key of Object.keys(entry)) {
      if (key === 'class' || named.includes(key) || declared.includes(key)) continue;

      const seen = `${component}\u0000${source}\u0000${key}`;
      if (warnedConditionKeys.has(seen)) continue;
      warnedConditionKeys.add(seen);

      const perSlotCall = declared.filter((axis) => !named.includes(axis));
      const head =
        `[BlocksProvider] The \`overrides\` rule under ${source} for component "${component}" ` +
        `conditions on "${key}", which is neither a prop it passes nor an axis its ` +
        '`tv()` config declares.';
      const body =
        named.length > 0
          ? ` Keys that can match here: ${named.join(', ')}.`
          : ' The component passes no variant props at all, so no conditional rule can match it' +
            ' — use unconditional `slotClasses`.';
      const tail =
        perSlotCall.length > 0
          ? ` Its config also declares ${perSlotCall.join(', ')}, which the component hands to a` +
            ' slot function per element rather than carrying for itself; a rule keyed on one of' +
            ' those matches nothing here either, and belongs on the component that passes it.'
          : '';
      console.warn(head + body + tail);
    }
  }
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
 * while four rules on axes Card does not have start matching every Card.
 *
 * Typing the pair together (`activeProps` as the props of *this* config) is not
 * the way out, and not for the reason this comment first gave. Two `tsc
 * --strict` reproductions of that signature disagree with each other depending
 * only on how inference is arranged, and in one of them the mismatch passes
 * while an inline literal of the same object is rejected — the weak-type
 * asymmetry `blocks/docs/MIGRATION.md` already records for slot keys: a target
 * whose properties are all optional rejects only an object with *no* key in
 * common, and a condition object held in a variable (which is how every call
 * site writes it) skips excess-property checking altogether.
 *
 * Measured across three candidate signatures, the only form that catches a
 * mispairing is a non-`Partial` `Record` — and it demands that every call site
 * name **every** axis its config declares. `Input` deliberately omitting
 * `iconPosition`, which it passes per slot call, becomes a compile error. So a
 * type tie is not merely unmeasured; it forbids the deliberate omission this
 * fold exists to permit.
 *
 * The binding does not have to be on the type level, though. A closure would
 * make the mispairing unrepresentable — one identifier instead of two, e.g.
 * `cardVariants.resolveSlots(config, 'Card', preset, variantProps, slotClasses)`
 * — and it leaves `DatePicker` alone, whose props parameter stays
 * `Record<string, unknown>` (its config declares no axes and it hands over five
 * keys belonging to the Input and Calendar it wraps). What blocks it today is
 * **module layering, not typing**: this file imports `variants.ts` and not the
 * other way round, so the binder would have to live on the provider side.
 * Until then the pairing rests on the call site naming one identifier twice.
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

  // On the rules, not on the resolved map: a key only reaches that map when its
  // rule matches, and a mistyped key is exactly the one whose rule never does.
  if (
    typeof window !== 'undefined' &&
    import.meta.env?.DEV &&
    (defaults?.overrides || presetDef?.overrides)
  ) {
    const named = Object.keys(activeProps);
    const declared = Object.keys(variantConfig.variants ?? {});
    warnUnknownConditionKeys(component, 'defaults', defaults?.overrides, named, declared);
    warnUnknownConditionKeys(
      component,
      `preset "${preset}"`,
      presetDef?.overrides,
      named,
      declared
    );
  }

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
