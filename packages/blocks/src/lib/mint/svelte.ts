import type { Attachment } from 'svelte/attachments';
import { type MintFallbacks, mintRegistry } from './registry';
import type { MintProp } from './types';

/**
 * Applies a mint to the element it is attached to.
 *
 * Replaces the `bind:this` + `$effect` + null-guard trio that every
 * mint-consuming component used to repeat:
 *
 * ```svelte
 * <!-- before: a ref that exists only for this, and a guard that cannot fail -->
 * let inputRef = $state<HTMLInputElement>();
 * $effect(() => {
 *   if (inputRef && mint && mint !== 'none' && !disabled) {
 *     return mintRegistry.apply(inputRef, mint);
 *   }
 * });
 *
 * <!-- after -->
 * <input {@attach mintAttachment(mint, { enabled: !disabled })} />
 * ```
 *
 * Returns `false` when there is nothing to apply — `{@attach false}` is a
 * no-op, so the call site needs no conditional of its own. The expression runs
 * inside an effect, so changing `mint` or `enabled` tears the old mint down and
 * applies the new one, exactly as the hand-written effect did.
 *
 * `mintRegistry.apply` allows only one application per element; one
 * `{@attach mintAttachment(…)}` per element upholds that.
 *
 * @param mint The mint prop as the consumer passed it (`undefined` / `'none'` disable it).
 * @param options.enabled Gate for component state that suppresses the effect —
 *   `disabled`, `loading`, or a non-interactive variant. Defaults to `true`.
 * @param options.fallbacks Directly imported default factories, so a component's
 *   own mint ships tree-shaken instead of pulling in the whole built-in set
 *   (see `mintRegistry.apply`).
 *
 * @example
 * ```svelte
 * <button {@attach mintAttachment(mint, { enabled: !disabled && !loading, fallbacks: { scale: scaleMint } })}>
 * ```
 */
export function mintAttachment(
  mint: MintProp | undefined,
  options: { enabled?: boolean; fallbacks?: MintFallbacks } = {}
): Attachment<HTMLElement> | false {
  const { enabled = true, fallbacks } = options;
  if (!enabled || isMintOff(mint)) return false;

  return (node) => mintRegistry.apply(node, mint, fallbacks);
}

/**
 * Did the consumer opt out of micro-interactions on this element?
 *
 * The one definition of "mint off", so a component that styles itself around
 * the opt-out cannot disagree with the attachment that acts on it: Button
 * flattens its `active:` press sink for exactly the props that make
 * `mintAttachment` a no-op (#192).
 *
 * It answers the DECLARED intent, not the effective outcome, and those come
 * apart at the edges: `mint={[]}` applies nothing (`normalizeMintProp` returns
 * the empty list untouched) yet reads as "on" here, and `mint={['none']}` /
 * `mint={{ name: 'none' }}` resolve to an unregistered name and warn at runtime
 * rather than disabling anything. All three are consumer mistakes with a
 * clearer spelling one keystroke away, and reporting them as "off" would hide
 * the warning that names them — so the scalar forms below stay the only "off".
 *
 * Written as a type predicate so the call sites keep narrowing `mint` to
 * something `mintRegistry.apply` accepts; `''` is in the predicate because it is
 * a `MintName` the falsy check catches, and a predicate that omitted it would be
 * a lie the compiler believes.
 */
export function isMintOff(mint: MintProp | undefined): mint is undefined | '' | 'none' {
  return !mint || mint === 'none';
}
