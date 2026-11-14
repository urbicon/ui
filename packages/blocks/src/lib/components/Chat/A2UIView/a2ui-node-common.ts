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

/** The ARIA state a component's `@accessibility` asks for beyond its name. */
export interface A2uiAriaAttributes {
  'aria-description'?: string;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-hidden'?: 'true';
}

/**
 * Read a stored `@accessibility` value: `label` as the accessible name, the
 * rest as the attributes every component root takes. `resolve` is the
 * dispatcher's data-binding resolver — `label`, `description` and `hidden` may
 * be bound. An absent key yields no attribute, so a component keeps the
 * semantics it infers from its visible text.
 */
export function readAccessibility(
  accessibility: unknown,
  resolve: (value: unknown) => unknown
): { label: string | undefined; attributes: A2uiAriaAttributes } {
  if (accessibility === null || typeof accessibility !== 'object') {
    return { label: undefined, attributes: {} };
  }
  const source = accessibility as Record<string, unknown>;
  const attributes: A2uiAriaAttributes = {};
  const description = coerceText(resolve(source.description));
  if (description) attributes['aria-description'] = description;
  if (source.live === 'off' || source.live === 'polite' || source.live === 'assertive') {
    attributes['aria-live'] = source.live;
  }
  if (coerceBoolean(resolve(source.hidden))) attributes['aria-hidden'] = 'true';
  return { label: coerceText(resolve(source.label)) || undefined, attributes };
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
