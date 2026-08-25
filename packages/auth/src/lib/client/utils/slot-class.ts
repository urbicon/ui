import { type BlocksConfig, resolveSlotClasses } from '@urbicon-ui/blocks';

/**
 * Resolve a slot's classes under the `unstyled` contract: default styling is
 * dropped entirely when `unstyled`, the consumer's slot classes always apply.
 * Components bind it as `const cls = (base, slot) => slotClass(unstyled, base, slot)`
 * so `unstyled` stays a per-call read (reactive) and call sites keep the
 * two-argument shape. Was a per-component clone.
 */
export function slotClass(unstyled: boolean, base: string, slot?: string): string {
  return (unstyled ? [slot] : [base, slot]).filter(Boolean).join(' ');
}

// `resolveSlotClasses` matches prop-conditional `overrides` against a component's
// active variant props. The auth components have no variant props — their look is
// fixed and steered through slots — so the match set is empty by construction.
// Frozen and named once instead of an inline `{}` at every call site.
const NO_VARIANT_PROPS: Record<string, unknown> = Object.freeze({});

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
    instance as Record<string, string> | undefined
  ) as Partial<Record<S, string>>;
}
