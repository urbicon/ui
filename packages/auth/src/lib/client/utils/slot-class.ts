import {
  type BlocksConfig,
  resolveClassChain,
  resolveSlotClasses,
  type TVConfig
} from '@urbicon-ui/blocks';

/**
 * Resolve a slot's classes under the `unstyled` contract: default styling is
 * dropped entirely when `unstyled`, the consumer's slot classes always apply.
 * Components bind it as `const cls = (base, slot) => slotClass(unstyled, base, slot)`
 * so `unstyled` stays a per-call read (reactive) and call sites keep the
 * two-argument shape. Was a per-component clone.
 */
export function slotClass(unstyled: boolean, base: string, slot?: string): string {
  return unstyled ? (slot ?? '') : resolveClassChain(base, slot);
}

// `resolveSlotClasses` matches prop-conditional `overrides` against a component's
// effective variant props — its `tv()` config's `defaultVariants` under whatever
// the component passes. The auth components have neither: their look is fixed and
// steered through slots, so both halves are empty by construction and no
// conditional rule can match. Unconditional `slotClasses` and presets do.
// Frozen and named once instead of an inline `{}` at every call site.
const NO_VARIANT_PROPS: Record<string, unknown> = Object.freeze({});
const NO_VARIANT_CONFIG: TVConfig = Object.freeze({});

/**
 * Resolve a component's per-slot classes through the blocks provider cascade:
 * `<BlocksProvider defaults>` → the named `preset` → the instance's own
 * `slotClasses`, later sources winning per Tailwind bucket. Returns the
 * instance classes unchanged when no provider is mounted, so a component works
 * standalone.
 *
 * Call during component initialisation (it reads the provider context through
 * `getBlocksConfig()`), then read the result inside a `$derived`:
 *
 * ```ts
 * const blocksConfig = getBlocksConfig();
 * const slotClasses = $derived(
 *   resolveAuthSlotClasses(blocksConfig, 'LoginPage', preset, slotClassesProp)
 * );
 * ```
 */
export function resolveAuthSlotClasses<S extends string>(
  config: BlocksConfig | undefined,
  component: string,
  preset: string | undefined,
  instance: Partial<Record<S, string>> | undefined
): Partial<Record<S, string>> {
  return resolveSlotClasses(
    config,
    component,
    preset,
    NO_VARIANT_PROPS,
    instance,
    NO_VARIANT_CONFIG
  ) as Partial<Record<S, string>>;
}
