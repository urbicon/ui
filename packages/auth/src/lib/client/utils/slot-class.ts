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
