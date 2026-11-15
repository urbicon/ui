/**
 * Data-model primitives for the A2UI engine: RFC 6901 JSON Pointer reads, the
 * one write path into a surface's data model, and the `resolveDynamic` union
 * resolver. Pure TS, no Svelte.
 *
 * Security posture (this file is on the untrusted-payload path):
 * - `__proto__` / `constructor` / `prototype` are rejected at **every** pointer
 *   segment — prototype pollution never reaches the model.
 * - Writes never merge or spread payload objects; they navigate and assign a
 *   single leaf, creating intermediate containers explicitly.
 * - Array index deletion leaves a hole (length preserved), matching the spec's
 *   sparse-array semantics.
 *
 * Pointers follow RFC 6901 except that empty segments collapse, as upstream's
 * A2UI conformance suite defines (`test_data_model_normalizes_empty_path_segments`):
 * `/foo/` is `/foo`, `//a///b//` is `/a/b`, and `/`, like `''`, is the whole
 * model. RFC 6901 reads an empty segment as the key `""`, which therefore no
 * pointer addresses here.
 */

import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';

/** Property names that must never be used as an object key on the write path. */
export const PROTO_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * How deep a surface's data model may nest, however it is written: a message,
 * or a user's edit through a binding. It is also the most segments a pointer
 * may have, since a longer one addresses nothing the model can hold. What walks
 * the model — the copy a write makes, `JSON.stringify` of the data model an
 * action carries — recurses, so a write that would nest it deeper is refused
 * rather than run the engine out of stack.
 */
export const A2UI_MAX_DATA_DEPTH = 64;

/**
 * The highest index a write adds a list item at. An index at or past the end of
 * a list adds the item and leaves the gap as holes, up to this one; above it the
 * write is refused. An item the list already holds is written at any index.
 * Upstream's bound — the A2UI conformance case
 * `test_data_model_rejects_excessive_list_index`.
 */
export const A2UI_MAX_NEW_ITEM_INDEX = 10_000;

/** RFC 6901 token unescape: `~1`→`/` then `~0`→`~` (order is significant). */
function unescapeToken(token: string): string {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

/** A `~` that RFC 6901 does not define: one not followed by `0` or `1`. */
const INVALID_ESCAPE_RE = /~(?![01])/;

/** Non-negative array index per RFC 6901 (`0` or `[1-9][0-9]*`); else `null`. */
function toIndex(segment: string): number | null {
  return /^(?:0|[1-9]\d*)$/.test(segment) ? Number(segment) : null;
}

/** A pointer's tokens, still escaped, its empty segments collapsed; absolute or relative alike. */
function pointerTokens(pointer: string): string[] {
  return pointer.split('/').filter((token) => token !== '');
}

/** How many segments `pointer` addresses, its empty ones collapsed (`//a///b//` → 2). */
export function pointerSegmentCount(pointer: string): number {
  return pointerTokens(pointer).length;
}

/**
 * `pointer` as an absolute pointer, its empty segments collapsed and its escapes
 * as written (`''` for the root): one spelling per place, so two pointers that
 * address the same place compare equal.
 */
export function collapsePointer(pointer: string): string {
  const tokens = pointerTokens(pointer);
  return tokens.length === 0 ? '' : `/${tokens.join('/')}`;
}

interface ParsedPointer {
  segments: string[];
  issue?: A2uiValidationIssue;
}

/**
 * Parse a pointer into decoded segments, its empty ones collapsed. Absolute
 * pointers start with `/`; anything else is treated as relative. `''` and `/`
 * yield zero segments. Refused, with the issue that says why: a `~` RFC 6901
 * does not define, a prototype-pollution segment, and more segments than
 * {@link A2UI_MAX_DATA_DEPTH}.
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
  const rawTokens = pointerTokens(pointer);

  // Counted before any token is read, and the pointer is not echoed: a refused
  // one can be the whole payload.
  if (rawTokens.length > A2UI_MAX_DATA_DEPTH) {
    return {
      segments: [],
      issue: {
        severity: 'error',
        code: A2UI_ISSUE_CODES.MAX_DEPTH,
        message: `A pointer of ${rawTokens.length} segments reaches deeper than the ${A2UI_MAX_DATA_DEPTH} levels a data model nests`
      }
    };
  }
  const segments: string[] = [];
  for (const token of rawTokens) {
    if (INVALID_ESCAPE_RE.test(token)) {
      return {
        segments: [],
        issue: {
          severity: 'error',
          code: A2UI_ISSUE_CODES.POINTER_ERROR,
          message: `Invalid escape in pointer "${pointer}": "~" must be followed by 0 or 1`
        }
      };
    }
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
 * Read the value at `pointer`. A pointer of no segments (`''`, `'/'`) returns
 * the whole model. Missing paths, holes, a key the object does not own
 * (`/toString`) and type-mismatches resolve to `undefined` (never throw) — the
 * spec renders an empty string / skeleton for unresolved bindings.
 */
export function getAtPointer(model: unknown, pointer: string): unknown {
  const { segments, issue } = parsePointer(pointer);
  if (issue) return undefined;

  let node: unknown = model;
  for (const segment of segments) {
    if (node == null) return undefined;
    if (Array.isArray(node)) {
      const index = toIndex(segment);
      node = index === null ? undefined : node[index];
    } else if (typeof node === 'object') {
      node = Object.hasOwn(node, segment) ? (node as Record<string, unknown>)[segment] : undefined;
    } else {
      return undefined;
    }
  }
  return node;
}

/**
 * The issue a pointer is refused with ({@link getAtPointer} reads nothing
 * through it, {@link writeDataModel} writes nothing), or `undefined` for a
 * pointer the engine reads. A relative one is checked on its own segments; its
 * template scope adds more.
 */
export function pointerIssue(pointer: string): A2uiValidationIssue | undefined {
  return parsePointer(pointer).issue;
}

/** The outcome of {@link writeDataModel}. */
export type A2uiDataWrite =
  | { ok: true; model: unknown }
  | {
      ok: false;
      /** What the write is refused for: its pointer, or the value it would place. */
      refused: 'pointer' | 'value';
      code: string;
      message: string;
    };

/**
 * Write `value` into a surface's data model at `pointer` — the one path every
 * write takes: a message's (`updateDataModel`, an inline `createSurface.
 * dataModel`) and a user's edit through a two-way binding. `undefined` deletes:
 * an object key is removed, an array item leaves a hole, and at the root the
 * model is emptied to `{}`. A pointer of no segments (`''`, `'/'`) replaces the
 * whole model, with any value. Containers the pointer passes through are created
 * where they are missing or `null` — an array where the next segment is an index
 * or `-`. An index past the end of an array leaves the gap as holes, which read
 * as missing, as a deleted item does; `-` appends.
 *
 * Nothing is written, and the outcome says why, for: a pointer that is neither
 * `''` nor starts with `/`, or that {@link pointerIssue} refuses; a pointer that
 * runs through a string, number or boolean — at any level, the root included;
 * an array segment that is no index (`01`, `x`); a new array item above
 * {@link A2UI_MAX_NEW_ITEM_INDEX}; a value that would nest the model deeper than
 * {@link A2UI_MAX_DATA_DEPTH}, counting a level per segment.
 *
 * The value is copied in, so a later edit never reaches the payload, and own
 * prototype keys are dropped from the copy. `model` is mutated in place and
 * returned, unless the write replaced the root or created it for a model that
 * was `null` or `undefined`.
 */
export function writeDataModel(model: unknown, pointer: string, value: unknown): A2uiDataWrite {
  if (typeof pointer !== 'string' || (pointer !== '' && !pointer.startsWith('/'))) {
    return {
      ok: false,
      refused: 'pointer',
      code: A2UI_ISSUE_CODES.POINTER_ERROR,
      message: `Pointer ${typeof pointer === 'string' ? `"${pointer}" ` : ''}must be "" or start with "/"`
    };
  }
  const { segments, issue } = parsePointer(pointer);
  if (issue) return { ok: false, refused: 'pointer', code: issue.code, message: issue.message };
  if (segments.length === 0) {
    if (value === undefined) return { ok: true, model: {} };
    const copy = copyWithin(value, A2UI_MAX_DATA_DEPTH);
    return copy === TOO_DEEP
      ? tooDeep('The value would nest the data model')
      : { ok: true, model: copy };
  }
  if (value === undefined) {
    deleteAt(model, segments);
    return { ok: true, model };
  }
  // The value lands one level below each segment of its pointer.
  const copy = copyWithin(value, A2UI_MAX_DATA_DEPTH - segments.length);
  if (copy === TOO_DEEP)
    return tooDeep(`The value written at "${pointer}" would nest the data model`);
  return assignAt(model, segments, copy, pointer);
}

function tooDeep(subject: string): A2uiDataWrite {
  return {
    ok: false,
    refused: 'value',
    code: A2UI_ISSUE_CODES.MAX_DEPTH,
    message: `${subject} deeper than ${A2UI_MAX_DATA_DEPTH} levels`
  };
}

type Container = Record<string, unknown> | unknown[];

/** Whether a segment addresses an array item, so a container created for it is an array. */
function isListSegment(segment: string): boolean {
  return segment === '-' || toIndex(segment) !== null;
}

/** The key `segment` addresses in `node`, or the refusal of it. `-` appends, as the last segment. */
function keyIn(
  node: Container,
  segment: string,
  last: boolean,
  pointer: string
): { key: string | number } | Extract<A2uiDataWrite, { ok: false }> {
  if (!Array.isArray(node)) return { key: segment };
  const index = last && segment === '-' ? node.length : toIndex(segment);
  if (index === null) {
    return {
      ok: false,
      refused: 'pointer',
      code: A2UI_ISSUE_CODES.POINTER_ERROR,
      message: `Segment "${segment}" is not a valid array index in pointer "${pointer}"`
    };
  }
  if (index >= node.length && index > A2UI_MAX_NEW_ITEM_INDEX) {
    return {
      ok: false,
      refused: 'pointer',
      code: A2UI_ISSUE_CODES.POINTER_ERROR,
      message: `Index ${index} in pointer "${pointer}" would add an item to a list of ${node.length} above index ${A2UI_MAX_NEW_ITEM_INDEX}, the highest a write adds one at`
    };
  }
  return { key: index };
}

/** The refusal of a write whose pointer runs through `held`, which no write replaces with a container. */
function throughValue(pointer: string, where: string, held: unknown): A2uiDataWrite {
  return {
    ok: false,
    refused: 'pointer',
    code: A2UI_ISSUE_CODES.POINTER_ERROR,
    message: `Pointer "${pointer}" runs through ${where}, which holds a ${typeof held}, not an object or list`
  };
}

/**
 * Place `value` at `segments`. Every key is checked before the model changes:
 * the walk descends through the containers that exist, builds the missing rest
 * detached, and attaches it with one assignment — so a refused write leaves no
 * container behind. A key the node does not own counts as missing, so
 * `/toString/x` creates an own `toString`.
 */
function assignAt(
  model: unknown,
  segments: string[],
  value: unknown,
  pointer: string
): A2uiDataWrite {
  if (model != null && !isContainer(model)) return throughValue(pointer, 'the root', model);
  const root: Container = isContainer(model) ? model : isListSegment(segments[0]) ? [] : {};
  const last = segments.length - 1;
  let node = root;
  let at = 0;
  let key: string | number;
  for (;;) {
    const found = keyIn(node, segments[at], at === last, pointer);
    if (!('key' in found)) return found;
    key = found.key;
    if (at === last) break;
    const child = Object.hasOwn(node, key)
      ? (node as Record<string | number, unknown>)[key]
      : undefined;
    if (child != null && !isContainer(child)) {
      return throughValue(pointer, `"${segments[at]}"`, child);
    }
    if (!isContainer(child)) break;
    node = child;
    at++;
  }
  let leaf = value;
  for (let j = last; j > at; j--) {
    const container: Container = isListSegment(segments[j]) ? [] : {};
    const found = keyIn(container, segments[j], j === last, pointer);
    if (!('key' in found)) return found;
    (container as Record<string | number, unknown>)[found.key] = leaf;
    leaf = container;
  }
  (node as Record<string | number, unknown>)[key] = leaf;
  return { ok: true, model: root };
}

/** Delete the leaf at `segments`; a no-op for a missing path or a non-container parent. */
function deleteAt(model: unknown, segments: string[]): void {
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

const TOO_DEEP: unique symbol = Symbol('too deep');

/**
 * Deep-copy JSON data within `levels` of nesting (a scalar takes none, `{}`
 * one), or {@link TOO_DEEP}. The copy recurses, and the bound is what keeps
 * that recursion off a hostile depth: it stops one level past `levels`. Own
 * `__proto__`/`constructor`/`prototype` keys are dropped (harmless as own
 * props, but never addressable), functions and symbols become `undefined`,
 * array holes stay holes.
 */
function copyWithin(value: unknown, levels: number): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value;
  }
  if (levels < 1) return TOO_DEEP;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) continue;
      const item = copyWithin(value[i], levels - 1);
      if (item === TOO_DEEP) return TOO_DEEP;
      out[i] = item;
    }
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (PROTO_KEYS.has(key)) continue;
    const item = copyWithin((value as Record<string, unknown>)[key], levels - 1);
    if (item === TOO_DEEP) return TOO_DEEP;
    out[key] = item;
  }
  return out;
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
export function catalogFault(
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
 * The absolute JSON Pointer a binding or template path addresses. A path that
 * starts with `/` is absolute; any other is relative to the template item
 * `scopePrefix` addresses (to the data-model root outside a template), and `""`
 * is the item itself — how a template over strings shows each one.
 */
export function scopedPointer(path: string, scopePrefix: string | undefined): string {
  if (path.startsWith('/')) return path;
  if (path === '') return scopePrefix ?? '';
  return `${scopePrefix ?? ''}/${path}`;
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
 * An operand whose binding is refused in this scope — its pointer too deep once
 * the template scope is added — leaves the whole call unresolved, with that
 * issue, rather than counting as false: a gate reads it as one it cannot
 * evaluate. Every operand is read for that reason, not just the ones up to the
 * first that decides.
 */
function evaluateLogic(
  call: Record<string, unknown>,
  model: unknown,
  scopePrefix: string | undefined,
  catalogs: A2uiCallCatalogs
): { value: unknown; issue?: A2uiValidationIssue } {
  const args = call.args as Record<string, unknown>;
  const name = call[A2UI_CALL_KEY];
  const operands = name === 'not' ? [args.value] : (args.values as unknown[]);
  const results: boolean[] = [];
  for (const operand of operands) {
    const resolved = isLogicCall(operand)
      ? evaluateLogic(operand, model, scopePrefix, catalogs)
      : resolveDynamic(operand, model, scopePrefix, catalogs);
    if (resolved.issue) return { value: undefined, issue: resolved.issue };
    results.push(coerceBoolean(resolved.value));
  }
  if (name === 'not') return { value: !results[0] };
  return { value: name === 'and' ? results.every(Boolean) : results.some(Boolean) };
}

/**
 * Resolve a Dynamic value union to a concrete value.
 * - `{ "@path" }` (data binding) → the pointed-at model value (relative paths
 *   are resolved against `scopePrefix`, the current template item); a pointer
 *   {@link pointerIssue} refuses, once scoped → `undefined` + that error.
 * - `{ "@call": "not" | "and" | "or", args }` → the boolean it computes; a
 *   malformed one, or one whose catalog does not resolve → `undefined` + a
 *   warning; one with a refused operand binding → `undefined` + its error.
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
    return evaluateLogic(value, model, scopePrefix, catalogs);
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
    const full = scopedPointer(relative, scopePrefix);
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
 * Whether JSON data nests deeper than `max` levels (a scalar is 0 deep, `{}` 1),
 * counted without recursion so the count itself survives hostile depth.
 */
export function exceedsDataDepth(value: unknown, max: number): boolean {
  if (max < 0) return true;
  const stack: Array<[unknown, number]> = [[value, 1]];
  while (stack.length > 0) {
    const [node, level] = stack.pop() as [unknown, number];
    if (node === null || typeof node !== 'object') continue;
    if (level > max) return true;
    for (const child of Object.values(node)) stack.push([child, level + 1]);
  }
  return false;
}
