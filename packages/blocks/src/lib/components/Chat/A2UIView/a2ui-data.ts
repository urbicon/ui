/**
 * Data-model primitives for the A2UI engine: RFC 6901 JSON Pointer get/set/delete
 * and the `resolveDynamic` union resolver. Pure TS, no Svelte.
 *
 * Security posture (this file is on the untrusted-payload path):
 * - `__proto__` / `constructor` / `prototype` are rejected at **every** pointer
 *   segment — prototype pollution never reaches the model.
 * - Writes never merge or spread payload objects; they navigate and assign a
 *   single leaf, creating intermediate containers explicitly.
 * - Array index deletion leaves a hole (length preserved), matching the spec's
 *   sparse-array semantics.
 *
 * A2UI convention (deviation from strict RFC 6901): the pointers `''` **and**
 * `'/'` both address the whole model. Strict RFC treats `'/'` as the key `""`;
 * A2UI's `updateDataModel` uses `'/'` to mean "the entire data model", and no
 * A2UI payload ever addresses an empty-string key, so we honor the spec's own
 * convention here for ergonomics.
 */

import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';

/** Property names that must never be used as an object key on the write path. */
export const PROTO_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** RFC 6901 token unescape: `~1`→`/` then `~0`→`~` (order is significant). */
function unescapeToken(token: string): string {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

/** Non-negative array index per RFC 6901 (`0` or `[1-9][0-9]*`); else `null`. */
function toIndex(segment: string): number | null {
  return /^(?:0|[1-9]\d*)$/.test(segment) ? Number(segment) : null;
}

interface ParsedPointer {
  segments: string[];
  issue?: A2uiValidationIssue;
}

/**
 * Parse a pointer into decoded segments, guarding every segment against
 * prototype-pollution keys. Absolute pointers start with `/`; anything else is
 * treated as relative (segments split on `/`). `''` yields zero segments.
 */
function parsePointer(pointer: string): ParsedPointer {
  if (typeof pointer !== 'string') {
    return {
      segments: [],
      issue: {
        severity: 'error',
        code: A2UI_ISSUE_CODES.POINTER_ERROR,
        message: 'Pointer must be a string'
      }
    };
  }
  let rawTokens: string[];
  if (pointer === '') rawTokens = [];
  else if (pointer.startsWith('/')) rawTokens = pointer.slice(1).split('/');
  else rawTokens = pointer.split('/');

  const segments: string[] = [];
  for (const token of rawTokens) {
    const segment = unescapeToken(token);
    if (PROTO_KEYS.has(segment)) {
      return {
        segments: [],
        issue: {
          severity: 'error',
          code: A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
          path: pointer,
          message: `Prohibited property name "${segment}" in pointer "${pointer}"`
        }
      };
    }
    segments.push(segment);
  }
  return { segments };
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object';
}

/**
 * Read the value at `pointer`. `''` / `'/'` return the whole model. Missing
 * paths, holes and type-mismatches resolve to `undefined` (never throw) — the
 * spec renders an empty string / skeleton for unresolved bindings.
 */
export function getAtPointer(model: unknown, pointer: string): unknown {
  if (pointer === '' || pointer === '/') return model;
  const { segments, issue } = parsePointer(pointer);
  if (issue) return undefined;

  let node: unknown = model;
  for (const segment of segments) {
    if (node == null) return undefined;
    if (Array.isArray(node)) {
      const index = toIndex(segment);
      node = index === null ? undefined : node[index];
    } else if (typeof node === 'object') {
      node = (node as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return node;
}

/**
 * Write `value` at `pointer`, creating intermediate objects/arrays as needed.
 * The document root cannot be replaced through this function (the processor
 * assigns `dataModel` directly for whole-model updates); a root pointer returns
 * `ok: false`. Prototype-pollution segments are rejected with an issue.
 */
export function setAtPointer(
  model: unknown,
  pointer: string,
  value: unknown
): { ok: boolean; issue?: A2uiValidationIssue } {
  if (pointer === '' || pointer === '/') {
    return {
      ok: false,
      issue: {
        severity: 'error',
        code: A2UI_ISSUE_CODES.POINTER_ERROR,
        path: pointer,
        message: 'Cannot replace the document root through setAtPointer'
      }
    };
  }
  const { segments, issue } = parsePointer(pointer);
  if (issue) return { ok: false, issue };
  if (segments.length === 0) {
    return {
      ok: false,
      issue: {
        severity: 'error',
        code: A2UI_ISSUE_CODES.POINTER_ERROR,
        path: pointer,
        message: 'Cannot replace the document root through setAtPointer'
      }
    };
  }
  if (!isContainer(model)) {
    return {
      ok: false,
      issue: {
        severity: 'error',
        code: A2UI_ISSUE_CODES.POINTER_ERROR,
        path: pointer,
        message: 'Cannot write into a non-object data model'
      }
    };
  }

  let node: Record<string, unknown> | unknown[] = model;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const nextIsIndex = toIndex(segments[i + 1]) !== null || segments[i + 1] === '-';
    if (Array.isArray(node)) {
      const index = toIndex(segment);
      if (index === null) {
        return { ok: false, issue: pointerTypeIssue(pointer, segment) };
      }
      if (!isContainer(node[index])) node[index] = nextIsIndex ? [] : {};
      node = node[index] as Record<string, unknown> | unknown[];
    } else {
      if (!isContainer(node[segment])) node[segment] = nextIsIndex ? [] : {};
      node = node[segment] as Record<string, unknown> | unknown[];
    }
  }

  const last = segments[segments.length - 1];
  if (Array.isArray(node)) {
    const index = last === '-' ? node.length : toIndex(last);
    if (index === null) return { ok: false, issue: pointerTypeIssue(pointer, last) };
    node[index] = value;
  } else {
    node[last] = value;
  }
  return { ok: true };
}

function pointerTypeIssue(pointer: string, segment: string): A2uiValidationIssue {
  return {
    severity: 'error',
    code: A2UI_ISSUE_CODES.POINTER_ERROR,
    path: pointer,
    message: `Segment "${segment}" is not a valid array index in pointer "${pointer}"`
  };
}

/**
 * Delete the leaf at `pointer`. Object keys are removed; array indices are
 * `delete`d in place (leaving a hole, preserving length). No-ops for missing
 * paths, non-container parents, and root pointers (the processor clears
 * `dataModel` directly for whole-model deletes).
 */
export function deleteAtPointer(model: unknown, pointer: string): void {
  if (pointer === '' || pointer === '/') return;
  const { segments, issue } = parsePointer(pointer);
  if (issue || segments.length === 0) return;

  let node: unknown = model;
  for (let i = 0; i < segments.length - 1; i++) {
    if (!isContainer(node)) return;
    if (Array.isArray(node)) {
      const index = toIndex(segments[i]);
      node = index === null ? undefined : node[index];
    } else {
      node = (node as Record<string, unknown>)[segments[i]];
    }
  }
  if (!isContainer(node)) return;

  const last = segments[segments.length - 1];
  if (Array.isArray(node)) {
    const index = toIndex(last);
    if (index !== null) delete node[index];
  } else {
    delete (node as Record<string, unknown>)[last];
  }
}

// ── Logic functions ──────────────────────────────────────────────────────────

/**
 * The only function calls the engine evaluates: the A2UI Basic catalog's logic
 * functions. Each computes a boolean from its operands and executes nothing;
 * every other `call` resolves to `undefined`.
 */
export const A2UI_LOGIC_FUNCTIONS: ReadonlySet<string> = new Set(['not', 'and', 'or']);

/**
 * How deep logic calls may nest (`not(and(…))` is two). Far beyond any real
 * gate; it exists so a hostile payload cannot drive the validator and the
 * resolver into unbounded recursion.
 */
export const A2UI_MAX_LOGIC_DEPTH = 8;

/** Why a logic call is not evaluated — the code, where below the call, and what is wrong. */
export interface A2uiLogicFault {
  code: string;
  /** JSON Pointer below the call object (`/args/values/1`); `''` is the call itself. */
  at: string;
  message: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A `{ call }` object naming one of {@link A2UI_LOGIC_FUNCTIONS} — well-formed or not. */
export function isLogicCall(value: unknown): value is Record<string, unknown> & { call: string } {
  return (
    isPlainRecord(value) && typeof value.call === 'string' && A2UI_LOGIC_FUNCTIONS.has(value.call)
  );
}

const CALL_KEYS: ReadonlySet<string> = new Set(['call', 'args', 'returnType']);
const NOT_ARG_KEYS: ReadonlySet<string> = new Set(['value']);
const LIST_ARG_KEYS: ReadonlySet<string> = new Set(['values']);

function unexpectedKey(
  object: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  at: string,
  where: string
): A2uiLogicFault | undefined {
  for (const key of Object.keys(object)) {
    if (allowed.has(key)) continue;
    return {
      code: PROTO_KEYS.has(key)
        ? A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION
        : A2UI_ISSUE_CODES.UNKNOWN_PROP,
      at: `${at}/${key}`,
      message: `Unexpected key "${key}" in ${where}`
    };
  }
  return undefined;
}

function operandFault(operand: unknown, at: string, depth: number): A2uiLogicFault | undefined {
  if (typeof operand === 'boolean') return undefined;
  if (isPlainRecord(operand)) {
    if (typeof operand.call === 'string') {
      if (!A2UI_LOGIC_FUNCTIONS.has(operand.call)) {
        return {
          code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
          at,
          message: `Function "${operand.call}" is not supported inside a logic call (only not, and, or are)`
        };
      }
      const nested = logicCallFault(operand, depth + 1);
      return nested && { ...nested, at: `${at}${nested.at}` };
    }
    if (typeof operand.path === 'string') {
      const { issue } = parsePointer(operand.path);
      return issue && { code: issue.code, at: `${at}/path`, message: issue.message };
    }
  }
  return {
    code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
    at,
    message: 'A logic operand must be true, false, a { path } binding or a not/and/or call'
  };
}

/**
 * The first structural fault of a logic call, or `undefined` when it is
 * well-formed. The shape is the Basic catalog's: `not` takes `args.value`;
 * `and`/`or` take `args.values`, an array of two or more; no other key on the
 * call or its args; `returnType`, if present, is `"boolean"`. Each operand is a
 * boolean literal, a `{ path }` binding or another logic call. The validator
 * reports this fault and `resolveDynamic` refuses to evaluate on it, so the two
 * read one definition of well-formed.
 */
export function logicCallFault(
  call: Record<string, unknown>,
  depth = 1
): A2uiLogicFault | undefined {
  const name = String(call.call);
  if (depth > A2UI_MAX_LOGIC_DEPTH) {
    return {
      code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '',
      message: `Logic calls nest deeper than ${A2UI_MAX_LOGIC_DEPTH} levels`
    };
  }
  const extra = unexpectedKey(call, CALL_KEYS, '', `the "${name}" call`);
  if (extra) return extra;
  if ('returnType' in call && call.returnType !== 'boolean') {
    return {
      code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/returnType',
      message: `"${name}" returns a boolean; returnType must be "boolean" or absent`
    };
  }
  const args = call.args;
  const shape = name === 'not' ? '{ value }' : '{ values: [...] }';
  if (!isPlainRecord(args)) {
    return {
      code: args === undefined ? A2UI_ISSUE_CODES.MISSING_FIELD : A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/args',
      message: `"${name}" needs args ${shape}`
    };
  }
  if (name === 'not') {
    const extraArg = unexpectedKey(args, NOT_ARG_KEYS, '/args', '"not" args');
    if (extraArg) return extraArg;
    if (!('value' in args)) {
      return {
        code: A2UI_ISSUE_CODES.MISSING_FIELD,
        at: '/args/value',
        message: `"not" needs args.value`
      };
    }
    return operandFault(args.value, '/args/value', depth);
  }
  const extraArg = unexpectedKey(args, LIST_ARG_KEYS, '/args', `"${name}" args`);
  if (extraArg) return extraArg;
  const values = args.values;
  if (!Array.isArray(values) || values.length < 2) {
    return {
      code: values === undefined ? A2UI_ISSUE_CODES.MISSING_FIELD : A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/args/values',
      message: `"${name}" needs args.values: an array of two or more operands`
    };
  }
  for (let i = 0; i < values.length; i++) {
    const fault = operandFault(values[i], `/args/values/${i}`, depth);
    if (fault) return fault;
  }
  return undefined;
}

/**
 * Evaluate a logic call {@link logicCallFault} has passed. Strict truthiness:
 * an operand counts as true only when it IS the boolean `true`, so an unset
 * path (`undefined`), `null`, a string or a number all count as false — and
 * `not` of a path nobody has written yet is `true`.
 */
function evaluateLogic(
  call: Record<string, unknown>,
  model: unknown,
  scopePrefix: string | undefined
): boolean {
  const args = call.args as Record<string, unknown>;
  const operand = (value: unknown): boolean =>
    isLogicCall(value)
      ? evaluateLogic(value, model, scopePrefix)
      : resolveDynamic(value, model, scopePrefix).value === true;
  if (call.call === 'not') return !operand(args.value);
  const values = args.values as unknown[];
  return call.call === 'and' ? values.every(operand) : values.some(operand);
}

/**
 * Resolve a Dynamic value union to a concrete value.
 * - `{ path }` (data binding) → the pointed-at model value (relative paths are
 *   resolved against `scopePrefix`, the current template item).
 * - `{ call: 'not' | 'and' | 'or', args }` → the boolean it computes (see
 *   `evaluateLogic` for the truthiness rule); a malformed one → `undefined` + a
 *   warning.
 * - any other `{ call, ... }` → `undefined` + a warning (unsupported).
 * - anything else (string/number/boolean/array/plain object) → returned as-is.
 *
 * Never throws; unresolved bindings yield `undefined` for graceful rendering.
 */
export function resolveDynamic(
  value: unknown,
  model: unknown,
  scopePrefix: string | undefined
): { value: unknown; issue?: A2uiValidationIssue } {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;

    if (isLogicCall(object)) {
      const fault = logicCallFault(object);
      if (fault) {
        return {
          value: undefined,
          issue: {
            severity: 'warning',
            code: fault.code,
            message: `Malformed "${object.call}" call resolved to undefined: ${fault.message}`
          }
        };
      }
      return { value: evaluateLogic(object, model, scopePrefix) };
    }

    if (typeof object.call === 'string') {
      return {
        value: undefined,
        issue: {
          severity: 'warning',
          code: A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
          message: `Function call "${object.call}" is not supported; resolved to undefined`
        }
      };
    }

    if (typeof object.path === 'string') {
      const relative = object.path;
      const full = relative.startsWith('/') ? relative : `${scopePrefix ?? ''}/${relative}`;
      const { issue } = parsePointer(full);
      if (issue) return { value: undefined, issue };
      return { value: getAtPointer(model, full) };
    }

    // A literal object argument (rare, e.g. a raw config object) — pass through.
    return { value };
  }
  return { value };
}

/**
 * Deep-clone JSON data for ingest into the model, stripping any own
 * `__proto__`/`constructor`/`prototype` keys (harmless as own props, but never
 * addressable, so we drop them). Functions/symbols are dropped. Used by the
 * processor so that later two-way edits never mutate the source payload and no
 * prototype key ever enters the model.
 */
export function cloneData(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      if (i in value) out[i] = cloneData(value[i]);
    }
    return out;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (PROTO_KEYS.has(key)) continue;
      out[key] = cloneData((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  return value;
}
