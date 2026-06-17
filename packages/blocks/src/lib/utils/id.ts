/**
 * Generates a unique ID, optionally with a prefix.
 *
 * Inside Svelte components prefer `$props.id()` (Svelte 5) — it is
 * deterministic across SSR and the client, so it avoids hydration
 * mismatches. This helper exists for non-component code (tests, build
 * tools) and uses `crypto.randomUUID()` when available, falling back
 * to `Math.random()` only on legacy runtimes.
 *
 * @param prefix - An optional prefix for the ID.
 * @returns A unique string ID.
 */
export function id(prefix = 'blocks-'): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 7)
      : Math.random().toString(36).substring(2, 9);
  return `${prefix}${random}`;
}
