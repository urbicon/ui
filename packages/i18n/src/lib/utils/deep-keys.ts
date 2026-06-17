/**
 * Utility type to extract all possible deep keys from a nested object
 * Used for type-safe translation key access
 */
export type DeepKeys<T> =
  T extends Record<string, unknown>
    ? {
        [K in keyof T]: K extends string
          ? T[K] extends Record<string, unknown>
            ? `${K}` | `${K}.${DeepKeys<T[K]>}`
            : `${K}`
          : never;
      }[keyof T]
    : never;

/**
 * Utility type to get the value at a specific deep key path
 */
export type DeepValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? DeepValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Runtime function to get nested value from object
 */
export function getDeepValue<T extends Record<string, unknown>>(obj: T, path: string): unknown {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/**
 * Runtime function to check if a deep key exists in an object
 */
export function hasDeepKey<T extends Record<string, unknown>>(obj: T, path: string): boolean {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (typeof value !== 'object' || value === null || !(key in value)) {
      return false;
    }
    value = (value as Record<string, unknown>)[key];
  }

  return true;
}

/**
 * Runtime counterpart to the `DeepKeys` type: collects every leaf-key path of a
 * nested translation object (dotted, e.g. `form.label.required`). A leaf is any
 * non-object value (the translation strings); nested objects recurse. Used by
 * `validatePackageTranslations` to diff locale bundles structurally — two
 * bundles with the same leaf-key set are key-compatible.
 */
export function collectDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const entries = Object.entries(obj);
  // An empty nested object still occupies its key path — emit it instead of
  // recursing into nothing, so `{ a: {} }` yields `['a']` rather than `[]`.
  // Otherwise a structural divergence like `{a:{}}` vs `{a:'x'}` would go
  // undetected. (The empty ROOT object, prefix='', correctly yields `[]`.)
  if (entries.length === 0) return prefix ? [prefix] : [];

  const out: string[] = [];
  for (const [key, value] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...collectDeepKeys(value as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}
