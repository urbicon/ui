/**
 * Tiny key-glob matcher shared by the translation audit (`ignoreKeys`) and the
 * unused-key reconciler (`dynamicKeys`/`ignoreKeys`). Supports exact keys and a
 * trailing `*` wildcard, so `errors.*` matches `errors.timeout` but not `errorsX`
 * is intentional — `errors.*` slices to the prefix `errors.` (the dot is kept).
 */
export function makeGlobMatcher(patterns: string[] | undefined): (key: string) => boolean {
  if (!patterns || patterns.length === 0) return () => false;
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('*')) prefixes.push(pattern.slice(0, -1));
    else exact.add(pattern);
  }
  return (key) => exact.has(key) || prefixes.some((prefix) => key.startsWith(prefix));
}
