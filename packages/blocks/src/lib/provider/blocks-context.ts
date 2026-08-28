import { createOptionalContext } from '$lib/utils/optional-context';
import { matchesCompound, resolveClassChain } from '$lib/utils/variants';

/**
 * A prop-conditional style rule. Its non-`class` keys are matched against a
 * component's active variant props — exactly like a `tv()` compoundVariant
 * (`string` = equality, `string[]` = "one of", `boolean` for a boolean axis
 * such as the table's `contained`; the comparison runs on the stringified
 * value, so `true` and `'true'` are the same condition). An axis a component
 * carries as `undefined` rather than `false` — the blocks primitives do that
 * for `disabled`, `readonly` and `error` — matches only its `true` side:
 * `{ disabled: false }` never fires. On a match, the `class` record (slot →
 * classes) is merged into the slot-class cascade. Additive: every matching
 * rule contributes; later sources win per Tailwind bucket.
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
 */
export function resolveSlotClasses(
  config: BlocksConfig | undefined,
  component: string,
  preset: string | undefined,
  activeProps: Record<string, unknown>,
  instanceSlotClasses: Record<string, string | undefined> | undefined
): Record<string, string> {
  const defaults = config?.defaults?.[component];
  const presetDef = preset ? config?.presets?.[component]?.[preset] : undefined;

  const sources: (Record<string, string | undefined> | undefined)[] = [
    defaults?.slotClasses,
    resolveOverrideSlotClasses(defaults?.overrides, activeProps),
    resolvePresetSlotClasses(config?.presets, component, preset),
    resolveOverrideSlotClasses(presetDef?.overrides, activeProps),
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
