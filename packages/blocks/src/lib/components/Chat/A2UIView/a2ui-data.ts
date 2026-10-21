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

/** What one logic function takes: a single operand, or a list of at least `minItems`. */
export type A2uiLogicSignature = { arg: 'value' } | { arg: 'values'; minItems: number };

/**
 * The only function calls the engine evaluates — the A2UI Basic catalog's logic
 * functions — each with the one arg it takes, as that catalog declares it.
 * Each computes a boolean and executes nothing; every other `call` resolves to
 * `undefined`. The validator, the resolver and the prompt all read this table.
 */
export const A2UI_LOGIC_FUNCTION_ARGS: Readonly<Record<string, A2uiLogicSignature>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, A2uiLogicSignature>, {
    not: { arg: 'value' },
    and: { arg: 'values', minItems: 2 },
    or: { arg: 'values', minItems: 2 }
  })
);

/** The names of {@link A2UI_LOGIC_FUNCTION_ARGS}. */
export const A2UI_LOGIC_FUNCTIONS: ReadonlySet<string> = new Set(
  Object.keys(A2UI_LOGIC_FUNCTION_ARGS)
);

/** The names as a reader sees them in a message: `not, and, or`. */
export const A2UI_LOGIC_FUNCTION_NAMES = [...A2UI_LOGIC_FUNCTIONS].join(', ');

/**
 * How deep logic calls may nest (`not(and(…))` is two), and how many operands
 * one gate may hold in all — one call tree, or every condition of a `checks`
 * list together. Generous for any gate; they exist because a gate is
 * re-evaluated on every render, and a hostile payload must neither recurse
 * without bound nor make each keystroke walk a list of thousands.
 */
export const A2UI_MAX_LOGIC_DEPTH = 8;
export const A2UI_MAX_LOGIC_OPERANDS = 64;

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

/** Operands counted so far against one gate's {@link A2UI_MAX_LOGIC_OPERANDS}. */
export interface OperandBudget {
  used: number;
}

function operandFault(
  operand: unknown,
  at: string,
  depth: number,
  budget: OperandBudget
): A2uiLogicFault | undefined {
  budget.used++;
  if (budget.used > A2UI_MAX_LOGIC_OPERANDS) {
    return {
      code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at,
      message: `A logic call holds more than ${A2UI_MAX_LOGIC_OPERANDS} operands in all`
    };
  }
  if (typeof operand === 'boolean') return undefined;
  if (isPlainRecord(operand)) {
    if (typeof operand.call === 'string') {
      if (!A2UI_LOGIC_FUNCTIONS.has(operand.call)) {
        return {
          code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
          at,
          message: `Function "${operand.call}" is not supported inside a logic call (only ${A2UI_LOGIC_FUNCTION_NAMES} are)`
        };
      }
      const nested = callFault(operand, depth + 1, budget);
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
    message: `A logic operand must be true, false, a { path } binding or one of ${A2UI_LOGIC_FUNCTION_NAMES}`
  };
}

function callFault(
  call: Record<string, unknown>,
  depth: number,
  budget: OperandBudget
): A2uiLogicFault | undefined {
  const name = String(call.call);
  const signature = A2UI_LOGIC_FUNCTION_ARGS[name];
  const arg = signature.arg;
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
  const shape = arg === 'value' ? '{ value }' : '{ values: [...] }';
  if (!isPlainRecord(args)) {
    return {
      code: args === undefined ? A2UI_ISSUE_CODES.MISSING_FIELD : A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/args',
      message: `"${name}" needs args ${shape}`
    };
  }
  const extraArg = unexpectedKey(args, new Set([arg]), '/args', `"${name}" args`);
  if (extraArg) return extraArg;
  if (signature.arg === 'value') {
    if (!('value' in args)) {
      return {
        code: A2UI_ISSUE_CODES.MISSING_FIELD,
        at: '/args/value',
        message: `"${name}" needs args.value`
      };
    }
    return operandFault(args.value, '/args/value', depth, budget);
  }
  const values = args.values;
  if (!Array.isArray(values) || values.length < signature.minItems) {
    return {
      code: values === undefined ? A2UI_ISSUE_CODES.MISSING_FIELD : A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/args/values',
      message: `"${name}" needs args.values: an array of ${signature.minItems} or more operands`
    };
  }
  for (let i = 0; i < values.length; i++) {
    const fault = operandFault(values[i], `/args/values/${i}`, depth, budget);
    if (fault) return fault;
  }
  return undefined;
}

/**
 * The first structural fault of a logic call, or `undefined` when it is
 * well-formed. The shape is the Basic catalog's (see
 * {@link A2UI_LOGIC_FUNCTION_ARGS}); no other key on the call or its args;
 * `returnType`, if present, is `"boolean"`. Each operand is a boolean literal, a
 * `{ path }` binding or another logic call, within the depth and operand caps.
 * The validator reports this fault and `resolveDynamic` refuses to evaluate on
 * it, so the two read one definition of well-formed.
 *
 * `budget` counts the operands against one already in use, for calls that share
 * a gate's cap: the conditions of one `checks` list.
 */
export function logicCallFault(
  call: Record<string, unknown>,
  budget: OperandBudget = { used: 0 }
): A2uiLogicFault | undefined {
  return callFault(call, 1, budget);
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
 * Whether every rule of a stored `checks` list passes: its `condition`, passed
 * through `resolve` (the dispatcher's `resolveDynamic`), is exactly `true` — the
 * truthiness a logic operand reads, so an unset path, `"true"` or a call the
 * engine does not run all fail. No list passes; a value that is not a list of
 * rules fails.
 */
export function checksPass(checks: unknown, resolve: (value: unknown) => unknown): boolean {
  if (checks === undefined) return true;
  if (!Array.isArray(checks)) return false;
  return checks.every((rule) => isPlainRecord(rule) && resolve(rule.condition) === true);
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
