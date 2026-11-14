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

// ── Dynamic-value directives ─────────────────────────────────────────────────

/** The key that makes an object a data binding: `{ "@path": "/pointer" }`. */
export const A2UI_PATH_KEY = '@path';
/** The key that makes an object a function call: `{ "@call": "not", "args": { … } }`. */
export const A2UI_CALL_KEY = '@call';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The pointer of a `{ "@path" }` data binding; `undefined` for anything else. */
export function bindingPath(value: unknown): string | undefined {
  if (!isPlainRecord(value)) return undefined;
  const path = value[A2UI_PATH_KEY];
  return typeof path === 'string' ? path : undefined;
}

/** The function a `{ "@call" }` object names; `undefined` for anything else. */
export function callName(value: unknown): string | undefined {
  if (!isPlainRecord(value)) return undefined;
  const name = value[A2UI_CALL_KEY];
  return typeof name === 'string' ? name : undefined;
}

/**
 * A2UI 1.0 reserves every key with ONE leading `@` for protocol directives; a
 * literal `@` key is written doubled (`"@@type"` is the key `@type`).
 */
const RESERVED_KEY_RE = /^@(?!@)/;

/** The first key of a literal object that claims the reserved namespace, if any. */
export function reservedKeyOf(object: Record<string, unknown>): string | undefined {
  return Object.keys(object).find((key) => RESERVED_KEY_RE.test(key));
}

/**
 * A literal object as its reader gets it: `@@`-escaped keys unescaped. Returns
 * the object itself when it holds none, so an unescaped literal keeps its
 * identity; the copy inherits nothing and drops prototype keys.
 */
function unescapeLiteral(object: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(object);
  if (!keys.some((key) => key.startsWith('@@'))) return object;
  const out = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (PROTO_KEYS.has(key)) continue;
    out[key.startsWith('@@') ? key.slice(1) : key] = object[key];
  }
  return out;
}

/**
 * Whether the catalog a function call runs in exists: the one its `catalogId`
 * names or, for `undefined`, the surface's default. A2UI 1.0 resolves a call no
 * other way — one that reaches neither is not evaluated.
 */
export type A2uiCallCatalogs = (catalogId: string | undefined) => boolean;

/**
 * The boolean a resolved value counts as wherever A2UI reads a `DynamicBoolean`
 * — a boolean prop, a logic operand, a check condition. The table is the
 * protocol's (A2UI 1.0, "DynamicBoolean and CheckRule Coercion"): a boolean is
 * itself; a validation result is its `valid`; `"true"` in any letter case is
 * true and every other string false; a number is true unless it is 0; null, an
 * absent value, and any other object or array are false.
 */
export function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (isPlainRecord(value) && typeof value.valid === 'boolean') return value.valid;
  return false;
}

// ── Function calls ───────────────────────────────────────────────────────────

/** What one logic function takes: a single operand, or a list of at least `minItems`. */
export type A2uiLogicSignature = { arg: 'value' } | { arg: 'values'; minItems: number };

/**
 * The catalog functions the engine evaluates — the A2UI Basic catalog's logic
 * functions — each with the one arg it takes, as that catalog declares it.
 * Each computes a boolean and executes nothing. The validator, the resolver and
 * the prompt all read this table.
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
 * The protocol's system function: the 0-based position of the current item of
 * a list template, plus an optional `args.offset`. It belongs to no catalog.
 */
export const A2UI_INDEX_FUNCTION = '@index';

/**
 * How deep logic calls may nest (`not(and(…))` is two), and how many operands
 * one gate may hold in all — one call tree, or every condition of a `@checks`
 * list together. Generous for any gate; they exist because a gate is
 * re-evaluated on every render, and a hostile payload must neither recurse
 * without bound nor make each keystroke walk a list of thousands.
 */
export const A2UI_MAX_LOGIC_DEPTH = 8;
export const A2UI_MAX_LOGIC_OPERANDS = 64;

/** Why a function call is not evaluated — the code, where below the call, and what is wrong. */
export interface A2uiCallFault {
  code: string;
  /** JSON Pointer below the call object (`/args/values/1`); `''` is the call itself. */
  at: string;
  message: string;
}

/** A `{ "@call" }` object naming one of {@link A2UI_LOGIC_FUNCTIONS} — well-formed or not. */
export function isLogicCall(value: unknown): value is Record<string, unknown> {
  const name = callName(value);
  return name !== undefined && A2UI_LOGIC_FUNCTIONS.has(name);
}

/** A `{ "@call": "@index" }` object — well-formed or not. */
export function isIndexCall(value: unknown): value is Record<string, unknown> {
  return callName(value) === A2UI_INDEX_FUNCTION;
}

const CALL_KEYS: ReadonlySet<string> = new Set([A2UI_CALL_KEY, 'args', 'catalogId']);

function unexpectedKey(
  object: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  at: string,
  where: string
): A2uiCallFault | undefined {
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

/** The fault of a call whose catalog does not resolve (see {@link A2uiCallCatalogs}). */
function catalogFault(
  call: Record<string, unknown>,
  name: string,
  catalogs: A2uiCallCatalogs
): A2uiCallFault | undefined {
  const catalogId = call.catalogId;
  if (catalogId === undefined) {
    return catalogs(undefined)
      ? undefined
      : {
          code: A2UI_ISSUE_CODES.MISSING_FIELD,
          at: '/catalogId',
          message: `"${name}" names no catalogId and its surface has no default catalog`
        };
  }
  if (typeof catalogId !== 'string') {
    return {
      code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/catalogId',
      message: `catalogId of the "${name}" call must be a string`
    };
  }
  return catalogs(catalogId)
    ? undefined
    : {
        code: A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
        at: '/catalogId',
        message: `Unknown catalogId "${catalogId}" on the "${name}" call`
      };
}

/** Operands counted so far against one gate's {@link A2UI_MAX_LOGIC_OPERANDS}. */
export interface OperandBudget {
  used: number;
}

function operandFault(
  operand: unknown,
  at: string,
  depth: number,
  budget: OperandBudget,
  catalogs: A2uiCallCatalogs
): A2uiCallFault | undefined {
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
    const nestedName = callName(operand);
    if (nestedName !== undefined) {
      if (!A2UI_LOGIC_FUNCTIONS.has(nestedName)) {
        return {
          code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
          at,
          message: `Function "${nestedName}" is not supported inside a logic call (only ${A2UI_LOGIC_FUNCTION_NAMES} are)`
        };
      }
      const nested = logicFault(operand, depth + 1, budget, catalogs);
      return nested && { ...nested, at: `${at}${nested.at}` };
    }
    const path = bindingPath(operand);
    if (path !== undefined) {
      const { issue } = parsePointer(path);
      return issue && { code: issue.code, at: `${at}/${A2UI_PATH_KEY}`, message: issue.message };
    }
  }
  return {
    code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
    at,
    message: `A logic operand must be true, false, a { "@path" } binding or one of ${A2UI_LOGIC_FUNCTION_NAMES}`
  };
}

function logicFault(
  call: Record<string, unknown>,
  depth: number,
  budget: OperandBudget,
  catalogs: A2uiCallCatalogs
): A2uiCallFault | undefined {
  const name = String(call[A2UI_CALL_KEY]);
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
  const unresolved = catalogFault(call, name, catalogs);
  if (unresolved) return unresolved;
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
    return operandFault(args.value, '/args/value', depth, budget, catalogs);
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
    const fault = operandFault(values[i], `/args/values/${i}`, depth, budget, catalogs);
    if (fault) return fault;
  }
  return undefined;
}

/**
 * The first structural fault of a logic call, or `undefined` when it is
 * well-formed. The shape is the Basic catalog's (see
 * {@link A2UI_LOGIC_FUNCTION_ARGS}); no key on the call but `@call`, `args` and
 * `catalogId`, none on its args but the one it takes; its catalog resolves
 * (`catalogs`). Each operand is a boolean literal, a `{ "@path" }` binding or
 * another logic call, within the depth and operand caps. The validator reports
 * this fault and `resolveDynamic` refuses to evaluate on it, so the two read
 * one definition of well-formed.
 *
 * `budget` counts the operands against one already in use, for calls that share
 * a gate's cap: the conditions of one `@checks` list.
 */
export function logicCallFault(
  call: Record<string, unknown>,
  catalogs: A2uiCallCatalogs,
  budget: OperandBudget = { used: 0 }
): A2uiCallFault | undefined {
  return logicFault(call, 1, budget, catalogs);
}

const INDEX_ARG_KEYS: ReadonlySet<string> = new Set(['offset']);

/**
 * The first structural fault of an `@index` call, or `undefined` when it is
 * well-formed: no key but `@call`, `args` and `catalogId` (read by nobody — a
 * system function has no catalog), and `args`, when present, holding at most an
 * `offset` that is a finite number or a `{ "@path" }` binding.
 */
export function indexCallFault(call: Record<string, unknown>): A2uiCallFault | undefined {
  const extra = unexpectedKey(call, CALL_KEYS, '', `the "${A2UI_INDEX_FUNCTION}" call`);
  if (extra) return extra;
  const args = call.args;
  if (args === undefined) return undefined;
  if (!isPlainRecord(args)) {
    return {
      code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
      at: '/args',
      message: `"${A2UI_INDEX_FUNCTION}" takes args { offset } or none`
    };
  }
  const extraArg = unexpectedKey(args, INDEX_ARG_KEYS, '/args', `"${A2UI_INDEX_FUNCTION}" args`);
  if (extraArg) return extraArg;
  const offset = args.offset;
  if (offset === undefined || (typeof offset === 'number' && Number.isFinite(offset))) {
    return undefined;
  }
  const path = bindingPath(offset);
  if (path !== undefined) {
    const { issue } = parsePointer(path);
    return (
      issue && { code: issue.code, at: `/args/offset/${A2UI_PATH_KEY}`, message: issue.message }
    );
  }
  return {
    code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
    at: '/args/offset',
    message: `"${A2UI_INDEX_FUNCTION}" offset must be a number or a { "@path" } binding`
  };
}

/**
 * The position of the template item `scopePrefix` addresses. A template scope
 * is its list's pointer plus the item's index (`/items/2`), and a nested
 * template's scope ends in the innermost index, which is the one A2UI means.
 */
function templateIndex(scopePrefix: string | undefined): number | undefined {
  if (scopePrefix === undefined) return undefined;
  return toIndex(scopePrefix.slice(scopePrefix.lastIndexOf('/') + 1)) ?? undefined;
}

/**
 * Evaluate a logic call {@link logicCallFault} has passed. Each operand is read
 * through {@link coerceBoolean}: an unset path, `null` and any string but
 * `"true"` count as false — so `not` of a path nobody has written yet is `true`.
 */
function evaluateLogic(
  call: Record<string, unknown>,
  model: unknown,
  scopePrefix: string | undefined,
  catalogs: A2uiCallCatalogs
): boolean {
  const args = call.args as Record<string, unknown>;
  const operand = (value: unknown): boolean =>
    isLogicCall(value)
      ? evaluateLogic(value, model, scopePrefix, catalogs)
      : coerceBoolean(resolveDynamic(value, model, scopePrefix, catalogs).value);
  const name = call[A2UI_CALL_KEY];
  if (name === 'not') return !operand(args.value);
  const values = args.values as unknown[];
  return name === 'and' ? values.every(operand) : values.some(operand);
}

/**
 * Resolve a Dynamic value union to a concrete value.
 * - `{ "@path" }` (data binding) → the pointed-at model value (relative paths
 *   are resolved against `scopePrefix`, the current template item).
 * - `{ "@call": "not" | "and" | "or", args }` → the boolean it computes; a
 *   malformed one, or one whose catalog does not resolve → `undefined` + a
 *   warning.
 * - `{ "@call": "@index" }` → the template item's position plus `args.offset`;
 *   outside a template → `undefined` + a warning.
 * - any other `{ "@call", ... }` → `undefined` + a warning (unsupported).
 * - a literal object → itself, `@@`-escaped keys unescaped; one that holds a
 *   reserved single-`@` key → `undefined` + a warning.
 * - anything else (string/number/boolean/array) → returned as-is.
 *
 * Never throws; unresolved bindings yield `undefined` for graceful rendering.
 */
export function resolveDynamic(
  value: unknown,
  model: unknown,
  scopePrefix: string | undefined,
  catalogs: A2uiCallCatalogs
): { value: unknown; issue?: A2uiValidationIssue } {
  if (!isPlainRecord(value)) return { value };
  const name = callName(value);

  if (name !== undefined && A2UI_LOGIC_FUNCTIONS.has(name)) {
    const fault = logicCallFault(value, catalogs);
    if (fault) {
      return {
        value: undefined,
        issue: {
          severity: 'warning',
          code: fault.code,
          message: `Malformed "${name}" call resolved to undefined: ${fault.message}`
        }
      };
    }
    return { value: evaluateLogic(value, model, scopePrefix, catalogs) };
  }

  if (name === A2UI_INDEX_FUNCTION) {
    const fault = indexCallFault(value);
    const index = templateIndex(scopePrefix);
    if (fault || index === undefined) {
      return {
        value: undefined,
        issue: {
          severity: 'warning',
          code: fault?.code ?? A2UI_ISSUE_CODES.INDEX_OUTSIDE_TEMPLATE,
          message: fault
            ? `Malformed "${A2UI_INDEX_FUNCTION}" call resolved to undefined: ${fault.message}`
            : `"${A2UI_INDEX_FUNCTION}" resolved to undefined outside a list template`
        }
      };
    }
    const args = value.args as Record<string, unknown> | undefined;
    const offset = resolveDynamic(args?.offset, model, scopePrefix, catalogs).value;
    return { value: index + (typeof offset === 'number' && Number.isFinite(offset) ? offset : 0) };
  }

  if (name !== undefined) {
    return {
      value: undefined,
      issue: {
        severity: 'warning',
        code: A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
        message: `Function call "${name}" is not supported; resolved to undefined`
      }
    };
  }

  const relative = bindingPath(value);
  if (relative !== undefined) {
    const full = relative.startsWith('/') ? relative : `${scopePrefix ?? ''}/${relative}`;
    const { issue } = parsePointer(full);
    if (issue) return { value: undefined, issue };
    return { value: getAtPointer(model, full) };
  }

  const reserved = reservedKeyOf(value);
  if (reserved !== undefined) {
    return {
      value: undefined,
      issue: {
        severity: 'warning',
        code: A2UI_ISSUE_CODES.INVALID_RESERVED_KEY,
        message: `Reserved key "${reserved}" in a literal object; resolved to undefined`
      }
    };
  }
  return { value: unescapeLiteral(value) };
}

/**
 * Whether every rule of a stored `@checks` list passes: its `condition`, passed
 * through `resolve` (the dispatcher's `resolveDynamic`), counts as true under
 * {@link coerceBoolean} — so an unset path, a validation result with
 * `valid: false` and a call the engine does not run all fail. No list passes; a
 * value that is not a list of rules fails.
 */
export function checksPass(checks: unknown, resolve: (value: unknown) => unknown): boolean {
  if (checks === undefined) return true;
  if (!Array.isArray(checks)) return false;
  return checks.every((rule) => isPlainRecord(rule) && coerceBoolean(resolve(rule.condition)));
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
