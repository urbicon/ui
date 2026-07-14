import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import { computeComponentDefaults, isDefaultValue, normalizeControls } from './code-gen.js';

/**
 * URL codec for playground share links. Pure functions only — no Svelte
 * reactivity, no DOM — so the round-trip is unit-testable without mounting
 * the configurator (same contract as `code-gen.ts`, its sibling).
 *
 * The wire format is one bare query param per non-default control key
 * (`?variant=outlined&size=lg`), not an opaque blob: every value a docs
 * playground can hold is scalar (enum / boolean / number / string), so a
 * readable, hand-editable URL costs nothing over base64.
 *
 * Asymmetric on purpose — write strictly, read tolerantly:
 *
 *   • `encodeShareParams` emits exactly the set the strip counts as modified,
 *     so a link never carries a value the reader did not choose.
 *   • `decodeShareParams` is type-directed off the control definitions and
 *     drops anything it cannot prove valid — an unknown key, an enum value
 *     outside `items`, a non-finite or out-of-range number, a malformed
 *     colour. It never throws: a hand-mangled URL silently degrades to the
 *     defaults for the parts it got wrong instead of breaking the page.
 *
 * Both halves run `normalizeControls` first, so a booleanish dropdown (coerced
 * to a `boolean` control, hence rendered as a Toggle) encodes and decodes
 * through the same arm rather than the two sides disagreeing about its type.
 * That call is idempotent, so callers may pass raw or already-normalised
 * controls.
 */

function encodeValue(control: ControlDefinition, value: unknown): string | undefined {
  switch (control.type) {
    case 'boolean':
    case 'checkbox':
      return typeof value === 'boolean' ? (value ? '1' : '0') : undefined;
    case 'number':
    case 'slider':
    case 'range':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
    case 'dropdown':
    case 'select':
      // The widgets write `String(item.value)` on pick, so a numeric item
      // value is already a string by the time it reaches here — accept both.
      return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
    case 'text':
    case 'color':
      return typeof value === 'string' ? value : undefined;
    // Every other ControlType (textarea, radio, multi-select, json, code) has
    // no branch in the configurator's strip, so there is no widget to restore
    // the value into. Encoding one would put a param on the URL that decode
    // could never hand back.
    default:
      return undefined;
  }
}

function decodeValue(control: ControlDefinition, raw: string): unknown {
  switch (control.type) {
    case 'boolean':
    case 'checkbox':
      if (raw === '1') return true;
      if (raw === '0') return false;
      return undefined;
    case 'number':
    case 'slider':
    case 'range': {
      // `Number('')` and `Number(' ')` are 0, which would turn a blank param
      // into a real value.
      if (raw.trim() === '') return undefined;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return undefined;
      // Out-of-range is rejected, not clamped — same rule as an enum value
      // outside `items`. Clamping would silently rewrite a hand-typed URL
      // into a different configuration and show it as if it were asked for.
      if (control.min !== undefined && parsed < control.min) return undefined;
      if (control.max !== undefined && parsed > control.max) return undefined;
      return parsed;
    }
    case 'dropdown':
    case 'select': {
      const match = (control.items ?? []).find((item) => String(item.value) === raw);
      return match ? String(match.value) : undefined;
    }
    case 'color':
      return /^#[0-9a-f]{6}$/i.test(raw) ? raw : undefined;
    case 'text':
      return raw;
    default:
      return undefined;
  }
}

/**
 * Serialise the non-default subset of `values` into a query string (without
 * the leading `?`). Returns `''` when nothing is modified — a link of pure
 * defaults carries no information.
 *
 * A control that declares no `defaultValue` is never emitted: it has no
 * baseline to be "modified" against, so `isDefaultValue` reports it clean and
 * "Reset all (N)" ignores it too. Encoding exactly what that counter counts
 * keeps the link and the strip's own dirty-state telling the same story.
 */
export function encodeShareParams(
  controls: readonly ControlDefinition[] | undefined,
  values: Record<string, unknown> | undefined
): string {
  if (!values) return '';
  const normalized = normalizeControls(controls);
  const defaults = computeComponentDefaults(normalized);
  const params = new URLSearchParams();

  for (const control of normalized) {
    if (isDefaultValue(control.key, values, defaults)) continue;
    const encoded = encodeValue(control, values[control.key]);
    if (encoded !== undefined) params.set(control.key, encoded);
  }

  return params.toString();
}

/**
 * Parse a query string (`window.location.search`, with or without the leading
 * `?`) into the subset of playground values it validly describes. Iterates the
 * controls rather than the params, so an unknown key cannot enter the result.
 *
 * The caller merges the result over its current values; keys absent here keep
 * whatever they had.
 */
export function decodeShareParams(
  controls: readonly ControlDefinition[] | undefined,
  search: string | undefined
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!search) return result;

  const params = new URLSearchParams(search);
  for (const control of normalizeControls(controls)) {
    const raw = params.get(control.key);
    if (raw === null) continue;
    const decoded = decodeValue(control, raw);
    if (decoded !== undefined) result[control.key] = decoded;
  }

  return result;
}
