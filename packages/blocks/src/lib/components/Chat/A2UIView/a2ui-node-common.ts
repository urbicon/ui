/**
 * Pure helpers shared by the catalog node dispatchers (`A2UINode`,
 * `urbicon/UrbiconA2UINode`). No Svelte — just the payload-shaping logic both
 * renderers need identically. The reactive plumbing (the `$derived`/`$state`
 * two-way-binding wiring) is deliberately NOT extracted: it is duplicated per
 * dispatcher so each stays a self-contained, readable component.
 *
 * `dedupeOptions` is load-bearing for the "never throw" contract: EVERY
 * payload-driven keyed `{#each}` over option values must dedupe first, or two
 * equal keys throw Svelte's `each_key_duplicate` — a hard render crash on an
 * untrusted payload. The validator only WARNS on duplicates; the renderer must
 * drop them.
 */

import { coerceBoolean } from './a2ui-data';

/**
 * Coerce an unknown resolved value to display text: strings pass through, finite
 * numbers stringify, everything else (null/undefined/object/NaN) becomes `''`.
 */
export function coerceText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** A component's `@accessibility`, resolved; `hidden` is {@link readHidden}'s. */
export interface A2uiAccessibility {
  /** The accessible name of the element that takes focus, or of the component's role. */
  label: string | undefined;
  /** The accessible description, on the element `label` names. */
  description: string | undefined;
  /** `aria-live` of the component's root. */
  live: 'off' | 'polite' | 'assertive' | undefined;
}

/**
 * Read a stored `@accessibility` value. `resolve` is the dispatcher's
 * data-binding resolver — `label` and `description` may be bound. An absent key,
 * or one that resolves to no text, is `undefined`, so a component keeps the
 * semantics it infers from its visible text.
 */
export function readAccessibility(
  accessibility: unknown,
  resolve: (value: unknown) => unknown
): A2uiAccessibility {
  if (accessibility === null || typeof accessibility !== 'object') {
    return { label: undefined, description: undefined, live: undefined };
  }
  const source = accessibility as Record<string, unknown>;
  const live = source.live;
  return {
    label: coerceText(resolve(source.label)) || undefined,
    description: coerceText(resolve(source.description)) || undefined,
    live: live === 'off' || live === 'polite' || live === 'assertive' ? live : undefined
  };
}

/**
 * `@accessibility.hidden`, resolved — or `undefined` when the component
 * declares no `hidden`, which is what lets the view wrap only the components
 * that do, and keep the wrapper while a bound value changes.
 */
export function readHidden(
  accessibility: unknown,
  resolve: (value: unknown) => unknown
): boolean | undefined {
  if (accessibility === null || typeof accessibility !== 'object') return undefined;
  if (!Object.hasOwn(accessibility, 'hidden')) return undefined;
  return coerceBoolean(resolve((accessibility as Record<string, unknown>).hidden));
}

/**
 * Normalise a raw options array into a deduped `{ value, label }` list (first
 * occurrence of each value wins). `resolveLabel` turns a raw label value (a
 * literal or a `{ "@path" }` binding) into display text — the caller injects its
 * data-binding resolver. Malformed options (non-object, non-string value) are
 * skipped. Dedup is mandatory: the rendered list is keyed on `value`.
 */
export function dedupeOptions(
  rawOptions: unknown,
  resolveLabel: (rawLabel: unknown) => string
): Array<{ value: string; label: string }> {
  if (!Array.isArray(rawOptions)) return [];
  const seen = new Set<string>();
  const out: Array<{ value: string; label: string }> = [];
  for (const option of rawOptions) {
    if (option === null || typeof option !== 'object') continue;
    const value = (option as { value?: unknown }).value;
    if (typeof value !== 'string' || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: resolveLabel((option as { label?: unknown }).label) });
  }
  return out;
}

/** Keep only the leading `HH:MM(:SS)?` of a time string; `''` if there is none. */
export function normalizeTimePart(value: string): string {
  const match = /^(\d{2}:\d{2}(?::\d{2})?)/.exec(value);
  return match ? match[1] : '';
}

/**
 * Split one ISO 8601 date/time literal into its date and time parts, timezone-
 * naively (a trailing offset/`Z` is dropped, never re-attached — timezone
 * semantics belong to the agent, not a UI renderer without timezone context).
 */
export function splitDateTime(value: string): { date: string; time: string } {
  const trimmed = value.trim();
  if (trimmed === '') return { date: '', time: '' };
  const tIndex = trimmed.indexOf('T');
  if (tIndex !== -1) {
    return {
      date: trimmed.slice(0, tIndex),
      time: normalizeTimePart(trimmed.slice(tIndex + 1))
    };
  }
  if (trimmed.includes(':')) return { date: '', time: normalizeTimePart(trimmed) };
  return { date: trimmed, time: '' };
}
