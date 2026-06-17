import { getContext, hasContext, setContext } from 'svelte';

/**
 * Optional context helper.
 *
 * Svelte's built-in `createContext<T>()` getter throws `missing_context`
 * when no parent component set the value. That is correct for compound
 * components (Tab, Accordion, …) where the sub-components must live
 * inside the parent. For *optional* contexts (e.g. BlocksProvider,
 * ButtonGroup wrapping individual Buttons, IconProvider) we want the
 * getter to silently return `undefined` instead.
 *
 * This helper provides the same `[get, set]` shape as `createContext`
 * but with a `() => T | undefined` getter that uses `hasContext` to
 * differentiate between "no provider" (return undefined) and "provider
 * deliberately set the value to undefined" (return undefined too —
 * the consumer can't tell the difference, which is fine for opt-in
 * APIs).
 */
export function createOptionalContext<T>(): readonly [
  () => T | undefined,
  (value: T | undefined) => T | undefined
] {
  // Object identity is used as the context key, just like Svelte's
  // built-in createContext does internally. Plain `{}` is sufficient.
  const key = {};
  return [
    () => (hasContext(key) ? getContext<T>(key) : undefined),
    (value: T | undefined) => setContext(key, value)
  ] as const;
}
