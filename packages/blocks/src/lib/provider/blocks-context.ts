import { createOptionalContext } from '$lib/utils/optional-context';
import {
  effectiveVariants,
  matchesCompound,
  resolveClassChain,
  type TVConfig
} from '$lib/utils/variants';
import type { SlotOf } from './component-slots';

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
export interface ConditionalOverride<Slot extends string = string> {
  /** Per-slot classes applied when the prop conditions match. */
  class: Partial<Record<Slot, string>>;
  /** Prop conditions: prop name → required value (or one of several). */
  [propCondition: string]: string | string[] | boolean | Partial<Record<Slot, string>> | undefined;
}

export interface ComponentDefaults<Slot extends string = string> {
  slotClasses?: Partial<Record<Slot, string>>;
  /**
   * Prop-conditional style rules, applied after unconditional `slotClasses`
   * (so they win per bucket) but before instance-level `slotClasses` / `class`.
   * Use for surgical per-variant tweaks the unconditional `slotClasses` cannot
   * express, e.g. `overrides: [{ variant: 'outlined', class: { base: 'border' } }]`.
   */
  overrides?: ConditionalOverride<Slot>[];
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
export interface ComponentPreset<Slot extends string = string> {
  slotClasses?: Partial<Record<Slot, string>>;
  /** Prop-conditional rules scoped to this preset (see {@link ConditionalOverride}). */
  overrides?: ConditionalOverride<Slot>[];
}

/** Map of component name → preset name → preset definition. */
export type PresetMap = Record<string, Record<string, ComponentPreset>>;

/**
 * A provider `defaults` object, with each entry checked against the slot names
 * of the component its key names.
 *
 * Generic in the object that is *written*, not in a fixed key set: `K` is the
 * literal the consumer typed, so {@link SlotOf} can answer per key — a known
 * component gets its own slots, any other name keeps `string`. A non-generic
 * `Record<keyof ComponentSlotMap, …>` would be the alternative and it would
 * close the map, which breaks the consumer wrapper that
 * COMPONENT-API-CONVENTIONS.md documents.
 *
 * **Sharp for the object literal, not for a variable that reaches it.** These
 * records are weak types (every property optional), and the rule for those is
 * that only an object with *no* key in common is rejected; a wrong key beside a
 * right one is caught by excess-property checking, which applies to a fresh
 * literal and not to a value passed through a variable. So
 * `slotClasses: { mark: '…', arc: '…' }` written into the attribute is an error,
 * while the same two keys held in a `const` and handed to the same place are
 * not. Both are pinned in `component-slots.types.test.ts`.
 */
export type BlocksDefaults<T> = { [K in keyof T]: ComponentDefaults<SlotOf<K>> };

/** A provider `presets` object, checked per component key like {@link BlocksDefaults}. */
export type BlocksPresets<T> = { [K in keyof T]: Record<string, ComponentPreset<SlotOf<K>>> };

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
): Record<string, string | undefined> | undefined {
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
 *   `datePickerVariants` declares none of the five DatePicker passes, and
 *   `CopyButton` passes two that belong to the Button inside it. So `declared`
 *   has to buy silence;
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
 * **`component` is the name a rule is written under, not the component the
 * props came from.** A wrapper resolves through the component it wraps, so
 * under `NumberInput` both lists are Input's — `numberInputVariants` declares
 * no axis at all and NumberInput passes none. That is the truth a rule needs,
 * and it is why the message says "the variant props this rule is matched
 * against" rather than "its props": the possessive would name the wrong
 * component on every wrapper.
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
 * `stepper`/`stepperButton` off a record Input resolved under its name,
 * `SidebarLayout` five `sidebar*` keys, `Guide` `skip`/`next` — and two,
 * `Popover` and `Separator`, pass a config carrying no `slots` at all and read
 * `base` off the result. Checking against `variantConfig.slots` would report
 * correct consumer config as mistyped in all five. A second parameter carrying
 * the missing names is the shape that would close it, and it would be
 * hand-maintained: the next forwarding component to omit it turns the check
 * into a false alarm on working code. Slot names are checked by the type
 * instead, and from the other side — each component's `slotClasses` prop rather
 * than its config (see `component-slots.ts`), which is why all five are correct
 * there.
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
        `conditions on "${key}", which is neither one of the variant props this rule is ` +
        'matched against nor an axis of the `tv()` config behind them.';
      const body =
        named.length > 0
          ? ` Keys that can match here: ${named.join(', ')}.`
          : ' The component passes no variant props at all, so no conditional rule can match it' +
            ' — use unconditional `slotClasses`.';
      const tail =
        perSlotCall.length > 0
          ? ` That config also declares ${perSlotCall.join(', ')}, handed to a slot function per` +
            ' element rather than carried per component; a rule keyed on one of those matches' +
            ' nothing here either, and belongs on the component that passes it.'
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
