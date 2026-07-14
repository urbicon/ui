import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import {
  computeComponentDefaults,
  isDefaultValue,
  isWithinRange,
  normalizeControls
} from './code-gen.js';

/**
 * URL codec for playground share links. Pure functions only — no Svelte
 * reactivity, no DOM — so the round-trip is unit-testable without mounting
 * the configurator (same contract as `code-gen.ts`, its sibling).
 *
 * The wire format is one bare query param per non-default control key, behind
 * a `_pg` param naming the playground they belong to
 * (`?_pg=Button&variant=outlined&size=lg`) — not an opaque blob: every value a
 * docs playground can hold is scalar (enum / boolean / number / string), so a
 * readable, hand-editable URL costs nothing over base64.
 *
 * `_pg` exists because a query string is page-global while a playground is
 * not: a docs page may mount several (this component's own page mounts eight),
 * and without a scope every one of them decodes the same link against its own
 * controls — a link sharing a red Button seeds the Alert demo beside it red
 * too. `_pg` is reserved; no control may use it as a key. It is the caller's
 * `shareKey`, which defaults to `componentName`, so instances documenting
 * *different* components never collide without any call site opting in.
 *
 * Asymmetric on purpose — write strictly, read tolerantly:
 *
 *   • `encodeShareParams` emits exactly the set the strip counts as modified,
 *     restricted to what `decodeShareParams` provably accepts back, and always
 *     names its scope. A link never carries a value the reader did not choose,
 *     nor one the reader would silently lose on arrival.
 *   • `decodeShareParams` is type-directed off the control definitions and
 *     drops anything it cannot prove valid — an unknown key, an enum value
 *     outside `items`, a non-finite or out-of-range number, a malformed
 *     colour. It never throws: a hand-mangled URL silently degrades to the
 *     defaults for the parts it got wrong instead of breaking the page. A link
 *     carrying no `_pg` at all is hand-written, and is honoured as such.
 *
 * Both halves run `normalizeControls` first, so a booleanish dropdown (coerced
 * to a `boolean` control, hence rendered as a Toggle) encodes and decodes
 * through the same arm rather than the two sides disagreeing about its type.
 * That call is idempotent, so callers may pass raw or already-normalised
 * controls.
 */

/**
 * Query param naming the playground a link was copied from. Reserved: a
 * control keyed `_pg` would shadow it. Leading underscore marks it as the one
 * param that is not a control — every docs control key is a camelCase prop
 * name.
 */
const SCOPE_PARAM = '_pg';

function encodeValue(control: ControlDefinition, value: unknown): string | undefined {
  switch (control.type) {
    case 'boolean':
    case 'checkbox':
      return typeof value === 'boolean' ? (value ? '1' : '0') : undefined;
    case 'number':
    case 'slider':
    case 'range':
      // The same range guard `decodeValue` applies. Without it a link can
      // carry `?count=999` for a `max: 20` control, which the recipient's
      // decode then drops on the floor — the value vanishes in transit with
      // no error at either end. Emitting nothing is the honest form of a
      // value that cannot survive the trip.
      return typeof value === 'number' && Number.isFinite(value) && isWithinRange(control, value)
        ? String(value)
        : undefined;
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
      return isWithinRange(control, parsed) ? parsed : undefined;
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
 * the leading `?`), scoped to the `scope` playground. Returns `''` when
 * nothing is modified — a link of pure defaults carries no information, not
 * even its own scope.
 *
 * `scope` is required rather than optional so a link cannot be minted without
 * declaring whose it is: an unscoped link is every playground's link.
 *
 * A control that declares no `defaultValue` is never emitted: it has no
 * baseline to be "modified" against, so `isDefaultValue` reports it clean and
 * "Reset all (N)" ignores it too. Encoding exactly what that counter counts
 * keeps the link and the strip's own dirty-state telling the same story.
 */
export function encodeShareParams(
  controls: readonly ControlDefinition[] | undefined,
  values: Record<string, unknown> | undefined,
  scope: string
): string {
  if (!values) return '';
  const normalized = normalizeControls(controls);
  const defaults = computeComponentDefaults(normalized);
  const params = new URLSearchParams();

  // Scope first, so the URL reads subject-then-settings.
  params.set(SCOPE_PARAM, scope);

  let modified = false;
  for (const control of normalized) {
    if (isDefaultValue(control.key, values, defaults)) continue;
    const encoded = encodeValue(control, values[control.key]);
    if (encoded !== undefined) {
      params.set(control.key, encoded);
      modified = true;
    }
  }

  return modified ? params.toString() : '';
}

/**
 * Parse a query string (`window.location.search`, with or without the leading
 * `?`) into the subset of playground values it validly describes for the
 * `scope` playground. Iterates the controls rather than the params, so an
 * unknown key cannot enter the result.
 *
 * A link scoped to a different playground yields nothing — that is the whole
 * point of `_pg`. A link with no scope predates it or was hand-written, and is
 * read as addressed to whoever is asking.
 *
 * The caller merges the result over its current values; keys absent here keep
 * whatever they had.
 */
export function decodeShareParams(
  controls: readonly ControlDefinition[] | undefined,
  search: string | undefined,
  scope: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!search) return result;

  const params = new URLSearchParams(search);
  const target = params.get(SCOPE_PARAM);
  if (target !== null && target !== scope) return result;

  for (const control of normalizeControls(controls)) {
    const raw = params.get(control.key);
    if (raw === null) continue;
    const decoded = decodeValue(control, raw);
    if (decoded !== undefined) result[control.key] = decoded;
  }

  return result;
}
