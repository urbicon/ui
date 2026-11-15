/**
 * The A2UI processor: incremental, whitelist-only, fail-loud validation that
 * turns a stream of agent→renderer envelopes into per-surface component maps and
 * data models. Pure TS, no Svelte — deliberately NOT reactive (the house
 * pattern of the streaming-markdown engine: plain Maps mutated in place; the
 * Svelte layer bumps a version counter to re-derive the render tree).
 *
 * Security posture (untrusted-payload path):
 * - Whitelist-only: only registry-declared props reach the render layer, so
 *   handler injection (`onclick`, …) and prop smuggling are structurally
 *   impossible — there is no payload spread.
 * - `__proto__`/`constructor`/`prototype` are rejected as component ids, prop
 *   keys, pointer segments and action-context keys.
 * - Never merges or spreads payload objects; everything flows through `Map`s.
 * - `collectGraphIssues` bounds traversal (depth 32, nodes 512) to cap DoS.
 *
 * Issue routing: envelope-level faults (bad version, unknown envelope type,
 * op-before-createSurface) land in `globalIssues`; everything scoped to a known
 * surface lands in that surface's `issues`. Graph-level faults (cycle, depth,
 * node count, dangling refs) are computed on demand by `collectGraphIssues`,
 * because "dangling" is a warning mid-stream and an error once settled.
 */

import { A2UI_ISSUE_CODES, type A2uiIssueSeverity, type A2uiValidationIssue } from './a2ui.types';
import { type A2uiCatalogSpec, basicA2uiCatalogSpec, resolveCatalog } from './a2ui-catalog';
import {
  A2UI_CALL_KEY,
  A2UI_INDEX_FUNCTION,
  A2UI_LOGIC_FUNCTION_NAMES,
  A2UI_MAX_DATA_DEPTH,
  A2UI_MAX_LOGIC_DEPTH,
  A2UI_MAX_LOGIC_OPERANDS,
  A2UI_PATH_KEY,
  type A2uiCallCatalogs,
  type A2uiCallFault,
  bindingPath,
  callName,
  catalogFault,
  exceedsDataDepth,
  getAtPointer,
  indexCallFault,
  isIndexCall,
  isLogicCall,
  logicCallFault,
  type OperandBudget,
  pointerIssue,
  pointerSegmentCount,
  reservedKeyOf,
  resolveDynamic,
  scopedPointer,
  writeDataModel
} from './a2ui-data';
import { readHidden } from './a2ui-node-common';
import {
  A2UI_ACCESSIBILITY_PROP,
  A2UI_ACCESSIBILITY_SPEC,
  A2UI_CHECKS_PROP,
  A2UI_IDENTIFIER_RE,
  A2UI_MESSAGE_KEYS,
  A2UI_PROTOCOL_VERSION,
  A2UI_SVG_PATH_RE,
  type A2uiComponentSpec,
  type A2uiPropSpec,
  acceptsLogicCall,
  checksGates,
  ownEntry
} from './a2ui-registry';
import {
  type A2uiSurfaceRequirement,
  type A2uiSurfaceRequirements,
  describeRequirement,
  meetsRequirement,
  requirementFault
} from './a2ui-requirements';
import { type A2uiDataSchema, validateSchemaWrite } from './a2ui-schema';

const PROTO_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

// DoS caps. The per-surface render walk is already bounded (depth 32, nodes
// 512), but that leaves the *number* of surfaces and the per-message component
// count unbounded — an attacker-streamed flood of tiny createSurface pairs (the
// render tree re-derives every surface on each version bump) or one giant
// updateComponents array would otherwise pin the main thread. Capping surface
// count keeps the whole-processor re-derive O(surfaces·nodes) with a constant,
// and capping the component list bounds each message's validation work.
const MAX_SURFACES = 64;
const MAX_COMPONENTS_PER_UPDATE = 1024;

// ── Public state shapes ──────────────────────────────────────────────────────

export interface A2uiComponentInstance {
  id: string;
  component: string;
  /**
   * The catalog the component resolved to: its own `@catalogId`, else the
   * surface's `catalogId`. `undefined` when neither names a configured
   * catalog — it then holds no props and renders as a fault chip.
   */
  catalog: A2uiCatalogSpec | undefined;
  /**
   * Only registry-declared props, plus `@accessibility` and — where a gate
   * reads it (`readsChecks`) — `@checks`; the raw payload values (dynamics
   * resolved at render), except a gate whose value or `@checks` cannot be
   * evaluated, which holds its `failsafe`.
   */
  props: ReadonlyMap<string, unknown>;
  /** Whether a stored prop holds an `@index` call, which resolves only inside a list template. */
  usesIndex: boolean;
  /** Index of the envelope that last defined this component. */
  sourceIndex: number;
}

export interface A2uiSurfaceState {
  surfaceId: string;
  components: Map<string, A2uiComponentInstance>;
  /** Root of the surface data model (mutated in place by two-way edits). */
  dataModel: unknown;
  issues: A2uiValidationIssue[];
  /** `createSurface.catalogId` as the message wrote it; `undefined` when it named none. */
  catalogId: string | undefined;
  /**
   * The surface's default catalog — `catalogId`, resolved — fixed for the
   * surface's life. `undefined` when the message named none or one that is not
   * configured; a component then renders only with its own `@catalogId`.
   */
  catalog: A2uiCatalogSpec | undefined;
  /** Whether a function call's catalog resolves on this surface (see `A2uiCallCatalogs`). */
  callCatalogs: A2uiCallCatalogs;
  /**
   * `createSurface.sendDataModel` — when true, every action dispatched from this
   * surface carries the full data model (see `A2uiActionEvent.dataModel`), so
   * the agent sees the user's input even for fields it left out of `context`.
   */
  sendDataModel: boolean;
  /**
   * The components this surface must contain — the entries of the processor's
   * `surfaceRequirements` for its id that some configured catalog can meet,
   * taken at `createSurface`. `collectGraphIssues` checks them against the
   * settled tree; absent means none.
   */
  requirements?: readonly A2uiSurfaceRequirement[];
}

export interface A2uiProcessor {
  surfaces: Map<string, A2uiSurfaceState>;
  globalIssues: A2uiValidationIssue[];
  /** Validate + apply one envelope. `index` positions it as `/messages/<index>` in issue paths. */
  apply(envelope: unknown, index: number): void;
}

/** Options for {@link createA2uiProcessor}. Omitting them yields the Basic-only default. */
export interface A2uiProcessorOptions {
  /**
   * The catalogs this processor understands. A surface names its default with
   * `createSurface.catalogId`, a component its own with `@catalogId`; an id
   * that matches none of them resolves to nothing — no catalog is a fallback.
   * Defaults to `[basicA2uiCatalogSpec]`.
   */
  catalogs?: readonly A2uiCatalogSpec[];
  /**
   * Optional data schema. When set, every `updateDataModel` write is validated
   * against it — a type mismatch on a declared pointer is a `SCHEMA_TYPE_MISMATCH`
   * error, a write to an undeclared top-level branch a `SCHEMA_UNDECLARED_PATH`
   * warning. Omitting it disables schema validation entirely (back-compat).
   */
  dataSchema?: A2uiDataSchema;
  /**
   * Components a surface must contain, keyed by surfaceId — the consumer's rule
   * for one form (a consent box on `booking`), not the catalog's, so a surface
   * without an entry is unaffected. `collectGraphIssues` reports each one not
   * rendered from `root` as a `MISSING_REQUIRED_COMPONENT` error, and only when
   * called with `streaming: false` (its default) — also when the surface's
   * default catalog cannot meet it, and then the error names one that can. An
   * entry no configured catalog can meet is an
   * `INVALID_REQUIREMENT` warning at `createSurface` and is not checked. Tell the model with `a2uiSurfaceRequirementsSection(sameObject,
   * catalog)`: the model chooses surfaceIds, and the section pins the ones
   * listed here.
   */
  surfaceRequirements?: A2uiSurfaceRequirements;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(
  severity: A2uiIssueSeverity,
  code: string,
  message: string,
  extra?: { surfaceId?: string; functionCallId?: string; path?: string }
): A2uiValidationIssue {
  return { severity, code, message, ...extra };
}

// ── Dynamic-value shape guards ───────────────────────────────────────────────

function isDataBinding(value: unknown): boolean {
  return bindingPath(value) !== undefined;
}
function isFunctionCall(value: unknown): boolean {
  return callName(value) !== undefined;
}
// A logic call is no ref here. Stored outside a prop that takes one, it would
// leave the prop silently empty — every text path renders a boolean as no text —
// so it is refused instead, which gives the agent an error to act on.
function isDynamicRef(value: unknown): boolean {
  return isDataBinding(value) || (isFunctionCall(value) && !isLogicCall(value));
}
function isDynamicString(value: unknown): boolean {
  return typeof value === 'string' || isDynamicRef(value);
}
function isDynamicNumber(value: unknown): boolean {
  return (typeof value === 'number' && Number.isFinite(value)) || isDynamicRef(value);
}
function isDynamicBoolean(value: unknown): boolean {
  return typeof value === 'boolean' || isDynamicRef(value);
}
function isDynamicStringList(value: unknown): boolean {
  return (
    (Array.isArray(value) && value.every((item) => typeof item === 'string')) || isDynamicRef(value)
  );
}

/**
 * Faults that only a dynamic *reference* value can carry, surfaced at validation
 * time so they reach `onValidationError` (the render layer resolves with only
 * `.value` and drops the issue — this is the closed feedback loop the agent
 * needs). A function-call binding is unsupported (renders to nothing → warning),
 * except a well-formed `@index`; a `{ "@path" }` binding whose pointer the
 * engine refuses ({@link pointerIssue}: a prototype-pollution segment, an
 * invalid escape, more segments than the data model nests) is a hard error.
 * That is position-independent — a template scope only adds segments — so
 * scope need not be resolved here; `collectGraphIssues` checks a relative
 * binding against each scope it renders in. Plain literals return no issues.
 */
function dynamicRefIssues(value: unknown, path: string, surfaceId: string): A2uiValidationIssue[] {
  if (isIndexCall(value)) {
    const fault = indexCallFault(value);
    if (!fault) return [];
    return [
      issue('error', fault.code, `${fault.message}; it resolves to nothing`, {
        surfaceId,
        path: `${path}${fault.at}`
      })
    ];
  }
  const call = callName(value);
  if (call !== undefined) {
    return [
      issue(
        'warning',
        A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
        `Function-call binding "${call}" is not supported; it resolves to nothing`,
        { surfaceId, path }
      )
    ];
  }
  const raw = bindingPath(value);
  const refused = raw === undefined ? undefined : pointerIssue(raw);
  if (refused) {
    return [
      issue('error', refused.code, `Binding refused: ${refused.message}; it resolves to nothing`, {
        surfaceId,
        path
      })
    ];
  }
  return [];
}

/**
 * What an object written the pre-1.0 way should have been. A2UI 1.0 reads
 * `{ path }` and `{ call }` as literal objects, so on a dynamic prop they are a
 * type mismatch whose cause the agent would otherwise have to guess.
 */
function legacyDirectiveHint(value: unknown): string {
  if (!isPlainObject(value)) return '';
  if (typeof value.path === 'string')
    return `; a data binding is written { "${A2UI_PATH_KEY}": … }`;
  if (typeof value.call === 'string')
    return `; a function call is written { "${A2UI_CALL_KEY}": … }`;
  return '';
}

const PRE_V1_CALL_KEYS: ReadonlySet<string> = new Set(['call', 'args', 'returnType']);

/**
 * Whether a literal object has exactly the keys of a pre-1.0 binding
 * (`{ path }`) or call (`{ call, args?, returnType? }`). Where a literal object
 * is legal it is sent as written, so this shape is the one worth a warning.
 */
function hasPreV1DirectiveShape(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  if (keys.length === 1 && typeof value.path === 'string') return true;
  return typeof value.call === 'string' && keys.every((key) => PRE_V1_CALL_KEYS.has(key));
}

// ── Per-prop validation ──────────────────────────────────────────────────────

interface PropResult {
  store: boolean;
  issues: A2uiValidationIssue[];
  /** Stored in place of the payload's value — a gate's `failsafe`. */
  substitute?: { value: unknown };
}

/**
 * Validate one prop. A prop with a `failsafe` (a gate such as `disabled`) never
 * falls back to its default when its value cannot be used — a wrong type, a
 * poisoned path, a call the engine cannot evaluate: it holds the failsafe, and
 * each error says so, so a broken consent gate keeps its button disabled.
 */
function validateProp(
  componentName: string,
  key: string,
  spec: A2uiPropSpec,
  value: unknown,
  path: string,
  surfaceId: string,
  iconNames: readonly string[],
  callCatalogs: A2uiCallCatalogs
): PropResult {
  const result = validatePropValue(
    componentName,
    key,
    spec,
    value,
    path,
    surfaceId,
    iconNames,
    callCatalogs
  );
  if (typeof spec.failsafe !== 'boolean') return result;
  if (result.store && result.issues.every((i) => i.severity !== 'error')) return result;
  const held = `; ${heldAt(key, spec)} until it is fixed`;
  return {
    store: true,
    substitute: { value: spec.failsafe },
    issues: result.issues.map((i) =>
      i.severity === 'error' ? { ...i, message: `${i.message}${held}` } : i
    )
  };
}

/** How an error names the state it leaves a gate in: `"disabled" is held at true`. */
function heldAt(key: string, spec: A2uiPropSpec): string {
  return `"${key}" is held at ${spec.failsafe}`;
}

/** {@link heldAt} for every gate a component's unusable `@checks` hold. */
function heldGates(spec: A2uiComponentSpec, gates: readonly string[]): string {
  return gates.map((gate) => heldAt(gate, spec.props[gate])).join(' and ');
}

/** `budget`: a logic call's operands count against it (see {@link logicCallFault}). */
function validatePropValue(
  componentName: string,
  key: string,
  spec: A2uiPropSpec,
  value: unknown,
  path: string,
  surfaceId: string,
  iconNames: readonly string[],
  callCatalogs: A2uiCallCatalogs,
  budget?: OperandBudget
): PropResult {
  const issues: A2uiValidationIssue[] = [];
  const mismatch = (detail: string): PropResult => {
    issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `${detail}${spec.dynamic ? legacyDirectiveHint(value) : ''}`,
        { surfaceId, path }
      )
    );
    return { store: false, issues };
  };

  if (spec.dynamic && isFunctionCall(value)) {
    const call = value as Record<string, unknown>;
    if (acceptsLogicCall(spec)) {
      return validateGate(componentName, key, call, path, surfaceId, callCatalogs, budget);
    }
    if (isLogicCall(call)) return refuseLogicCall(componentName, key, spec, call, path, surfaceId);
  }

  switch (spec.kind) {
    case 'string':
      if (spec.dynamic ? isDynamicString(value) : typeof value === 'string')
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(
        `"${key}" on ${componentName} must be a string${spec.dynamic ? ' or { "@path" } binding' : ''}`
      );

    case 'number':
      if (
        spec.dynamic ? isDynamicNumber(value) : typeof value === 'number' && Number.isFinite(value)
      )
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(
        `"${key}" on ${componentName} must be a finite number${spec.dynamic ? ' or { "@path" } binding' : ''}`
      );

    case 'boolean':
      if (spec.dynamic ? isDynamicBoolean(value) : typeof value === 'boolean')
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(
        `"${key}" on ${componentName} must be a boolean${spec.dynamic ? ' or { "@path" } binding' : ''}`
      );

    case 'stringList':
      if (isDynamicStringList(value))
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(`"${key}" on ${componentName} must be a string array or { "@path" } binding`);

    case 'enum':
      if (typeof value === 'string' && spec.values?.includes(value)) return { store: true, issues };
      issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_ENUM,
          `"${key}" on ${componentName} must be one of: ${(spec.values ?? []).join(', ')}`,
          { surfaceId, path }
        )
      );
      return { store: false, issues };

    case 'childId':
      if (typeof value === 'string') return { store: true, issues };
      return mismatch(`"${key}" on ${componentName} must be a component id (string)`);

    case 'childList':
      return validateChildList(componentName, key, value, path, surfaceId);

    case 'labeledChildren':
      return validateLabeledChildren(
        componentName,
        key,
        value,
        path,
        surfaceId,
        spec.labelKey ?? 'label'
      );

    case 'action':
      return validateAction(componentName, key, value, path, surfaceId, callCatalogs);

    case 'options':
      // A dynamic options prop may be a { "@path" } binding to a list the agent
      // fetched — the shape is checked when it resolves (see collectGraphIssues),
      // because at envelope time the data model may not carry it yet.
      if (spec.dynamic && isDynamicRef(value)) {
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      }
      return validateOptions(componentName, key, value, path, surfaceId, spec.dynamic);

    case 'icon':
      return validateIcon(value, path, surfaceId, iconNames);
  }

  // Unreachable for a registry-declared spec — `kind` is a closed union and every
  // member has a case above, which is why TypeScript accepts the switch as the
  // whole function body. It became reachable in #134, when a payload-supplied
  // prop name resolved an INHERITED `Object.prototype` member as its "spec":
  // `kind` was then undefined, the switch matched nothing, and the function
  // returned `undefined` into `result.issues` — killing the surface from a prop
  // called `toString` on an otherwise valid component. `lookupTable` removes the
  // inheritance that produced it; this keeps the return type honest either way.
  return mismatch(`"${key}" on ${componentName} has an unrecognised prop kind`);
}

/**
 * A function call on a gate — a prop that takes a logic call and declares the
 * `failsafe` it fails closed to. A well-formed logic call (`logicCallFault`,
 * the definition `resolveDynamic` evaluates by) is stored as written. Anything
 * else — malformed, over a cap, or a function the engine does not run, such as
 * the `required` upstream's own examples nest inside `and` — is refused, and
 * `validateProp` holds the failsafe in its place.
 */
function validateGate(
  componentName: string,
  key: string,
  call: Record<string, unknown>,
  path: string,
  surfaceId: string,
  callCatalogs: A2uiCallCatalogs,
  budget?: OperandBudget
): PropResult {
  const fault: A2uiCallFault | undefined = isLogicCall(call)
    ? logicCallFault(call, callCatalogs, budget)
    : {
        code: A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
        at: '',
        message: `function "${callName(call)}" is not supported (only ${A2UI_LOGIC_FUNCTION_NAMES} are evaluated)`
      };
  if (!fault) return { store: true, issues: [] };
  return {
    store: false,
    issues: [
      issue('error', fault.code, `"${key}" on ${componentName}: ${fault.message}`, {
        surfaceId,
        path: `${path}${fault.at}`
      })
    ]
  };
}

/**
 * A check rule's `condition` takes what a gate takes, less the literal, so it
 * is validated as one. `failsafe: false` is what an unusable condition means —
 * the check fails — but nothing is substituted for it: `checksIssues`' caller
 * holds the gates themselves.
 */
const CHECK_CONDITION_SPEC: A2uiPropSpec = {
  kind: 'boolean',
  dynamic: true,
  failsafe: false,
  description: 'The condition a check rule requires to be true.'
};
const CHECK_RULE_KEYS: ReadonlySet<string> = new Set(['condition', 'message']);

/**
 * `@checks` where a gate reads it: a list of `{ condition, message? }` rules
 * and no other key, as A2UI's `CheckRule` defines them — `condition` a
 * `{ "@path" }` binding or a function call, never a literal. The gate
 * re-evaluates every condition on every render, so the list is held to the
 * operand cap of one call tree, counted as one `and` over its conditions: each
 * condition counts one, and a call's operands count as well. Reports each
 * rule's first fault, and stops at the condition that runs past the cap; an
 * error means the list cannot be used.
 */
function checksIssues(
  componentName: string,
  value: unknown,
  path: string,
  surfaceId: string,
  iconNames: readonly string[],
  callCatalogs: A2uiCallCatalogs
): A2uiValidationIssue[] {
  const fault = (code: string, at: string, message: string) =>
    issue('error', code, message, { surfaceId, path: `${path}${at}` });
  const overCap = () =>
    fault(
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '',
      `"${A2UI_CHECKS_PROP}" on ${componentName} holds more than ${A2UI_MAX_LOGIC_OPERANDS} operands in all, counted as one "and" over its conditions`
    );
  if (!Array.isArray(value)) {
    return [
      fault(
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        '',
        `"${A2UI_CHECKS_PROP}" on ${componentName} must be an array of { condition, message? } rules`
      )
    ];
  }
  // Every condition counts one at least, so a longer list cannot fit; refused
  // before a fault is reported for each of its rules.
  if (value.length > A2UI_MAX_LOGIC_OPERANDS) return [overCap()];
  const budget: OperandBudget = { used: 0 };
  const issues: A2uiValidationIssue[] = [];
  for (let i = 0; i < value.length; i++) {
    const rule: unknown = value[i];
    const label = `${A2UI_CHECKS_PROP}[${i}]`;
    if (!isPlainObject(rule)) {
      issues.push(
        fault(
          A2UI_ISSUE_CODES.TYPE_MISMATCH,
          `/${i}`,
          `"${label}" on ${componentName} must be a { condition, message? } rule`
        )
      );
      continue;
    }
    const extra = Object.keys(rule).find((key) => !CHECK_RULE_KEYS.has(key));
    if (extra !== undefined) {
      issues.push(
        fault(
          PROTO_KEYS.has(extra)
            ? A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION
            : A2UI_ISSUE_CODES.UNKNOWN_PROP,
          `/${i}/${extra}`,
          `Unexpected key "${extra}" in "${label}" on ${componentName}; a rule is { condition, message? }`
        )
      );
      continue;
    }
    if (!Object.hasOwn(rule, 'condition')) {
      issues.push(
        fault(
          A2UI_ISSUE_CODES.MISSING_FIELD,
          `/${i}/condition`,
          `"${label}" on ${componentName} needs a condition`
        )
      );
      continue;
    }
    if (rule.message !== undefined && typeof rule.message !== 'string') {
      issues.push(
        fault(
          A2UI_ISSUE_CODES.TYPE_MISMATCH,
          `/${i}/message`,
          `"${label}.message" on ${componentName} must be a string`
        )
      );
      continue;
    }
    if (!isDataBinding(rule.condition) && !isFunctionCall(rule.condition)) {
      issues.push(
        fault(
          A2UI_ISSUE_CODES.TYPE_MISMATCH,
          `/${i}/condition`,
          `"${label}.condition" on ${componentName} must be a { "@path" } binding or a function call${legacyDirectiveHint(rule.condition)}`
        )
      );
      continue;
    }
    budget.used++; // the condition itself, as an operand of the list's `and`
    const condition = validatePropValue(
      componentName,
      `${label}.condition`,
      CHECK_CONDITION_SPEC,
      rule.condition,
      `${path}/${i}/condition`,
      surfaceId,
      iconNames,
      callCatalogs,
      budget
    );
    // Past the cap, the list's fault is reported in place of this condition's.
    if (budget.used > A2UI_MAX_LOGIC_OPERANDS) {
      issues.push(overCap());
      break;
    }
    for (const conditionIssue of condition.issues) issues.push(conditionIssue);
  }
  return issues;
}

/** A logic call on a dynamic prop that takes none — refused, so the agent hears why. */
function refuseLogicCall(
  componentName: string,
  key: string,
  spec: A2uiPropSpec,
  call: Record<string, unknown>,
  path: string,
  surfaceId: string
): PropResult {
  const name = callName(call);
  return {
    store: false,
    issues: [
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        spec.kind === 'boolean'
          ? `"${key}" on ${componentName} takes a boolean or a { "@path" } binding, not a "${name}" call`
          : `"${key}" on ${componentName} is not a boolean prop, but "${name}" computes a boolean`,
        { surfaceId, path }
      )
    ]
  };
}

function validateChildList(
  componentName: string,
  key: string,
  value: unknown,
  path: string,
  surfaceId: string
): PropResult {
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === 'string')) return { store: true, issues: [] };
    return {
      store: false,
      issues: [
        issue(
          'error',
          A2UI_ISSUE_CODES.TYPE_MISMATCH,
          `"${key}" on ${componentName} must be an array of component ids`,
          {
            surfaceId,
            path
          }
        )
      ]
    };
  }
  if (
    isPlainObject(value) &&
    typeof value.componentId === 'string' &&
    typeof value.path === 'string'
  ) {
    return { store: true, issues: [] };
  }
  return {
    store: false,
    issues: [
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `"${key}" on ${componentName} must be an array of ids or a template { componentId, path }`,
        { surfaceId, path }
      )
    ]
  };
}

/**
 * A `labeledChildren` value is an array of `{ <labelKey>, child }` items: the
 * label is a (dynamic) string, `child` a component id referenced by the
 * labelled slot. `labelKey` comes from the prop spec because the catalogs
 * disagree on it (Basic `Tabs` uses `title`, Urbicon `Accordion` uses `label`);
 * the child key is always `child`. The whole prop is rejected if ANY item is
 * malformed, so the render/graph layers may assume every stored item is a valid
 * `{ <labelKey>, child: string }` — this keeps the item→child index alignment
 * the dispatcher relies on when pairing labels with resolved child nodes.
 */
function validateLabeledChildren(
  componentName: string,
  key: string,
  value: unknown,
  path: string,
  surfaceId: string,
  labelKey: string
): PropResult {
  const bad = (detail: string): PropResult => ({
    store: false,
    issues: [issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, detail, { surfaceId, path })]
  });
  if (!Array.isArray(value))
    return bad(`"${key}" on ${componentName} must be an array of { ${labelKey}, child } items`);
  const issues: A2uiValidationIssue[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (
      !isPlainObject(item) ||
      typeof item.child !== 'string' ||
      !isDynamicString(item[labelKey])
    ) {
      return bad(`item ${i} on ${componentName} must be { ${labelKey}, child: string }`);
    }
    for (const labelIssue of dynamicRefIssues(
      item[labelKey],
      `${path}/${i}/${labelKey}`,
      surfaceId
    )) {
      issues.push(labelIssue);
    }
  }
  return { store: true, issues };
}

/**
 * Faults of one `action.event.context` value. Context is resolved at click
 * time and never stored as a prop, so a fault cannot fail closed — the key is
 * sent as `undefined` — and is reported for the agent to fix: a malformed logic
 * call or a literal object holding a reserved `@` key as an error, a literal
 * written like a pre-1.0 directive as a warning (it is sent as written), any
 * other function call or a poisoned path as a prop's would be.
 */
function contextValueIssues(
  componentName: string,
  contextKey: string,
  value: unknown,
  path: string,
  surfaceId: string,
  callCatalogs: A2uiCallCatalogs
): A2uiValidationIssue[] {
  if (isLogicCall(value)) {
    const fault = logicCallFault(value, callCatalogs);
    if (!fault) return [];
    return [
      issue(
        'error',
        fault.code,
        `action context "${contextKey}" on ${componentName}: ${fault.message}; it is sent as undefined`,
        { surfaceId, path: `${path}${fault.at}` }
      )
    ];
  }
  if (isPlainObject(value) && !isFunctionCall(value) && !isDataBinding(value)) {
    const reserved = reservedKeyOf(value);
    if (reserved === undefined) {
      if (!hasPreV1DirectiveShape(value)) return [];
      return [
        issue(
          'warning',
          A2UI_ISSUE_CODES.TYPE_MISMATCH,
          `action context "${contextKey}" on ${componentName} is a literal object written like a pre-1.0 directive${legacyDirectiveHint(value)}; it is sent as written`,
          { surfaceId, path }
        )
      ];
    }
    return [
      issue(
        'error',
        A2UI_ISSUE_CODES.INVALID_RESERVED_KEY,
        `action context "${contextKey}" on ${componentName} holds the reserved key "${reserved}" (a literal "@" key is written doubled: "@${reserved}"); it is sent as undefined`,
        { surfaceId, path: `${path}/${reserved}` }
      )
    ];
  }
  return dynamicRefIssues(value, path, surfaceId);
}

/** The function a Button's `functionCall` action may run; every other one leaves it inert. */
const OPEN_URL_FUNCTION = 'openUrl';
const OPEN_URL_CALL_KEYS: ReadonlySet<string> = new Set([A2UI_CALL_KEY, 'args', 'catalogId']);

/**
 * A `functionCall` action. `openUrl` is stored only when the call carries no
 * other key, its catalog resolves and its `url` is a string or a binding, so the
 * dispatcher never opens what the validator refused. A refused one drops the
 * action: a Basic Button, which requires one, renders as a fault chip. Any other
 * function is stored and reported, and the button renders inert.
 */
function validateFunctionCallAction(
  componentName: string,
  call: Record<string, unknown>,
  name: string,
  path: string,
  surfaceId: string,
  callCatalogs: A2uiCallCatalogs
): PropResult {
  const at = `${path}/functionCall`;
  if (name !== OPEN_URL_FUNCTION) {
    return {
      store: true,
      issues: [
        issue(
          'warning',
          A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
          `action.functionCall "${name}" on ${componentName} is not supported; the button is inert`,
          { surfaceId, path: `${at}/${A2UI_CALL_KEY}` }
        )
      ]
    };
  }
  const refuse = (code: string, message: string, where: string): PropResult => ({
    store: false,
    issues: [
      issue('error', code, `${message}; the action is dropped`, {
        surfaceId,
        path: `${at}${where}`
      })
    ]
  });
  const unexpected = (key: string) =>
    PROTO_KEYS.has(key) ? A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION : A2UI_ISSUE_CODES.UNKNOWN_PROP;
  for (const key of Object.keys(call)) {
    if (OPEN_URL_CALL_KEYS.has(key)) continue;
    return refuse(
      unexpected(key),
      `Unexpected key "${key}" in the "${name}" call on ${componentName}`,
      `/${key}`
    );
  }
  const fault = catalogFault(call, name, callCatalogs);
  if (fault) {
    return refuse(
      fault.code,
      `action.functionCall on ${componentName}: ${fault.message}`,
      fault.at
    );
  }
  const args = isPlainObject(call.args) ? call.args : {};
  for (const key of Object.keys(args)) {
    if (key === 'url') continue;
    return refuse(
      unexpected(key),
      `Unexpected key "${key}" in the args of the "${name}" call on ${componentName}`,
      `/args/${key}`
    );
  }
  const url = args.url;
  if (!isDynamicString(url)) {
    return refuse(
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      `args.url of the "${name}" call on ${componentName} must be a string or { "${A2UI_PATH_KEY}" } binding${legacyDirectiveHint(url)}`,
      '/args/url'
    );
  }
  return { store: true, issues: dynamicRefIssues(url, `${at}/args/url`, surfaceId) };
}

function validateAction(
  componentName: string,
  key: string,
  value: unknown,
  path: string,
  surfaceId: string,
  callCatalogs: A2uiCallCatalogs
): PropResult {
  const issues: A2uiValidationIssue[] = [];
  if (!isPlainObject(value)) {
    issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `"${key}" on ${componentName} must be an action object`,
        {
          surfaceId,
          path
        }
      )
    );
    return { store: false, issues };
  }
  if (isPlainObject(value.event)) {
    const event = value.event;
    const valueIssues: A2uiValidationIssue[] = [];
    if (typeof event.name !== 'string') {
      issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MISSING_FIELD,
          `action.event.name is required on ${componentName}`,
          {
            surfaceId,
            path: `${path}/event/name`
          }
        )
      );
      return { store: false, issues };
    }
    // A faulty userMessage never costs the button its action: the event is
    // dispatched without one.
    if ('userMessage' in event) {
      if (isDynamicString(event.userMessage)) {
        for (const messageIssue of dynamicRefIssues(
          event.userMessage,
          `${path}/event/userMessage`,
          surfaceId
        )) {
          valueIssues.push(messageIssue);
        }
      } else {
        valueIssues.push(
          issue(
            'error',
            A2UI_ISSUE_CODES.TYPE_MISMATCH,
            `action.event.userMessage on ${componentName} must be a string or { "@path" } binding${legacyDirectiveHint(event.userMessage)}; the action is sent without it`,
            { surfaceId, path: `${path}/event/userMessage` }
          )
        );
      }
    }
    if ('context' in event) {
      if (!isPlainObject(event.context)) {
        issues.push(
          issue(
            'error',
            A2UI_ISSUE_CODES.TYPE_MISMATCH,
            `action.event.context on ${componentName} must be an object`,
            {
              surfaceId,
              path: `${path}/event/context`
            }
          )
        );
        return { store: false, issues };
      }
      const context = event.context as Record<string, unknown>;
      for (const contextKey of Object.keys(context)) {
        if (PROTO_KEYS.has(contextKey)) {
          issues.push(
            issue(
              'error',
              A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
              `Prohibited action context key "${contextKey}" on ${componentName}`,
              { surfaceId, path: `${path}/event/context/${contextKey}` }
            )
          );
          continue;
        }
        // A literal is sent as written, and serialising it recurses. Dropping
        // the key instead would change the event the agent receives unasked.
        const contextValue = context[contextKey];
        if (
          !isDynamicRef(contextValue) &&
          !isLogicCall(contextValue) &&
          exceedsDataDepth(contextValue, A2UI_MAX_DATA_DEPTH)
        ) {
          issues.push(
            issue(
              'error',
              A2UI_ISSUE_CODES.MAX_DEPTH,
              `action context "${contextKey}" on ${componentName} nests deeper than ${A2UI_MAX_DATA_DEPTH} levels; the action is dropped`,
              { surfaceId, path: `${path}/event/context/${contextKey}` }
            )
          );
          continue;
        }
        for (const valueIssue of contextValueIssues(
          componentName,
          contextKey,
          context[contextKey],
          `${path}/event/context/${contextKey}`,
          surfaceId,
          callCatalogs
        )) {
          valueIssues.push(valueIssue);
        }
      }
    }
    // A prototype context key and a literal too deep to serialise drop the
    // action. Any other faulty context VALUE, and a faulty userMessage, only
    // travels as `undefined`.
    const store = issues.every(
      (i) =>
        i.code !== A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION && i.code !== A2UI_ISSUE_CODES.MAX_DEPTH
    );
    return { store, issues: [...issues, ...valueIssues] };
  }
  if (isPlainObject(value.functionCall)) {
    const call = value.functionCall;
    const name = callName(call);
    if (name !== undefined)
      return validateFunctionCallAction(componentName, call, name, path, surfaceId, callCatalogs);
    issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.MISSING_FIELD,
        `action.functionCall["${A2UI_CALL_KEY}"] is required on ${componentName}${legacyDirectiveHint(value.functionCall)}`,
        {
          surfaceId,
          path: `${path}/functionCall/${A2UI_CALL_KEY}`
        }
      )
    );
    return { store: false, issues };
  }
  issues.push(
    issue(
      'error',
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      `"${key}" on ${componentName} must have an "event" or "functionCall"`,
      {
        surfaceId,
        path
      }
    )
  );
  return { store: false, issues };
}

function validateOptions(
  componentName: string,
  key: string,
  value: unknown,
  path: string,
  surfaceId: string,
  dynamic?: boolean
): PropResult {
  const bad = (detail: string): PropResult => ({
    store: false,
    issues: [issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, detail, { surfaceId, path })]
  });
  if (!Array.isArray(value))
    return bad(
      `"${key}" on ${componentName} must be an array of { label, value } options${
        dynamic ? ` or a { "@path" } binding to one${legacyDirectiveHint(value)}` : ''
      }`
    );
  const issues: A2uiValidationIssue[] = [];
  const seenValues = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const option = value[i];
    if (
      !isPlainObject(option) ||
      typeof option.value !== 'string' ||
      !isDynamicString(option.label)
    ) {
      return bad(`option ${i} on ${componentName} must be { label, value:string }`);
    }
    // Duplicate option values must be flagged AND deduped downstream: a keyed
    // `{#each}` on option.value would otherwise throw `each_key_duplicate` (a
    // hard render crash that breaks the "never throw" contract).
    if (seenValues.has(option.value)) {
      issues.push(
        issue(
          'warning',
          A2UI_ISSUE_CODES.DUPLICATE_OPTION,
          `Duplicate option value "${option.value}" on ${componentName} (the later option is dropped)`,
          { surfaceId, path: `${path}/${i}/value` }
        )
      );
    }
    seenValues.add(option.value);
    for (const labelIssue of dynamicRefIssues(option.label, `${path}/${i}/label`, surfaceId)) {
      issues.push(labelIssue);
    }
  }
  return { store: true, issues };
}

function validateIcon(
  value: unknown,
  path: string,
  surfaceId: string,
  iconNames: readonly string[]
): PropResult {
  if (typeof value === 'string') {
    if (iconNames.includes(value)) return { store: true, issues: [] };
    return {
      store: true,
      issues: [
        issue(
          'warning',
          A2UI_ISSUE_CODES.ICON_UNMAPPED,
          `Icon "${value}" is not mapped; a fallback glyph is drawn`,
          {
            surfaceId,
            path
          }
        )
      ]
    };
  }
  if (isPlainObject(value)) {
    // A bound svgPath is guarded where it resolves: the dispatcher applies the
    // same grammar before inlining.
    if (isDataBinding(value.svgPath)) {
      return { store: true, issues: dynamicRefIssues(value.svgPath, `${path}/svgPath`, surfaceId) };
    }
    if (typeof value.svgPath === 'string') {
      if (A2UI_SVG_PATH_RE.test(value.svgPath)) return { store: true, issues: [] };
      return {
        store: true,
        issues: [
          issue(
            'warning',
            A2UI_ISSUE_CODES.ICON_INVALID_SVG,
            'Icon svgPath failed the path grammar guard; a fallback glyph is drawn',
            {
              surfaceId,
              path
            }
          )
        ]
      };
    }
    if (isDataBinding(value))
      return { store: true, issues: dynamicRefIssues(value, path, surfaceId) }; // dynamic binding
  }
  return {
    store: false,
    issues: [
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `Icon name must be a mapped name, { svgPath } or { "@path" }${legacyDirectiveHint(value)}`,
        { surfaceId, path }
      )
    ]
  };
}

// ── Component envelope mixins (`@` keys) ─────────────────────────────────────

/**
 * `@accessibility`: an object of the keys `A2UI_ACCESSIBILITY_SPEC` declares and
 * no other. It is stored whole or not at all, so the dispatchers read a value
 * every key of which passed.
 */
function validateAccessibility(
  componentName: string,
  value: unknown,
  path: string,
  surfaceId: string,
  iconNames: readonly string[],
  callCatalogs: A2uiCallCatalogs
): PropResult {
  if (!isPlainObject(value)) {
    return {
      store: false,
      issues: [
        issue(
          'error',
          A2UI_ISSUE_CODES.TYPE_MISMATCH,
          `"${A2UI_ACCESSIBILITY_PROP}" on ${componentName} must be an object { label?, description?, live?, hidden? }`,
          { surfaceId, path }
        )
      ]
    };
  }
  const issues: A2uiValidationIssue[] = [];
  for (const key of Object.keys(value)) {
    const spec = ownEntry(A2UI_ACCESSIBILITY_SPEC, key);
    if (!spec) {
      issues.push(
        issue(
          'error',
          PROTO_KEYS.has(key)
            ? A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION
            : A2UI_ISSUE_CODES.UNKNOWN_PROP,
          `Unexpected key "${key}" in "${A2UI_ACCESSIBILITY_PROP}" on ${componentName}; it takes ${Object.keys(A2UI_ACCESSIBILITY_SPEC).join(', ')}`,
          { surfaceId, path: `${path}/${key}` }
        )
      );
      continue;
    }
    const result = validatePropValue(
      componentName,
      `${A2UI_ACCESSIBILITY_PROP}.${key}`,
      spec,
      value[key],
      `${path}/${key}`,
      surfaceId,
      iconNames,
      callCatalogs
    );
    for (const keyIssue of result.issues) issues.push(keyIssue);
  }
  return { store: issues.every((i) => i.severity !== 'error'), issues };
}

const METADATA_KEYS: ReadonlySet<string> = new Set(['extensions']);

/**
 * Faults of a `metadata` / `@metadata` object: `{ extensions? }`, the
 * extensions keyed by identifiers. The engine reads no extension, and A2UI has
 * a renderer ignore the ones it does not know, so a well-formed one is neither
 * stored nor reported.
 */
function metadataIssues(
  value: unknown,
  path: string,
  surfaceId: string,
  name: string
): A2uiValidationIssue[] {
  if (!isPlainObject(value)) {
    return [
      issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, `${name} must be an object { extensions? }`, {
        surfaceId,
        path
      })
    ];
  }
  const issues: A2uiValidationIssue[] = [];
  flagExtraKeys(value, METADATA_KEYS, issues, surfaceId, path, name);
  const extensions = value.extensions;
  if (extensions === undefined) return issues;
  if (!isPlainObject(extensions)) {
    issues.push(
      issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, `${name}.extensions must be an object`, {
        surfaceId,
        path: `${path}/extensions`
      })
    );
    return issues;
  }
  for (const key of Object.keys(extensions)) {
    if (A2UI_IDENTIFIER_RE.test(key) && !PROTO_KEYS.has(key)) continue;
    issues.push(
      issue(
        'error',
        PROTO_KEYS.has(key) ? A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION : A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `Extension key "${key}" in ${name} must be an identifier (letters, digits and "_", no leading digit)`,
        { surfaceId, path: `${path}/extensions/${key}` }
      )
    );
  }
  return issues;
}

/** A component's own catalog, overriding the surface's default. */
const A2UI_CATALOG_ID_KEY = '@catalogId';
/** Extension metadata; validated, then dropped (see {@link metadataIssues}). */
const A2UI_METADATA_KEY = '@metadata';
/** The `@` keys a component takes, as a message names them. */
const COMPONENT_MIXIN_KEYS = [
  A2UI_CATALOG_ID_KEY,
  A2UI_ACCESSIBILITY_PROP,
  A2UI_CHECKS_PROP,
  A2UI_METADATA_KEY
]
  .map((key) => `"${key}"`)
  .join(', ');

/** The mixin names a pre-1.0 payload wrote bare; an unknown prop of that name gets a hint. */
const LEGACY_MIXIN_KEYS: ReadonlySet<string> = new Set([
  'accessibility',
  'checks',
  'catalogId',
  'metadata'
]);

/**
 * Whether a stored prop value holds an `@index` call where the dispatcher
 * resolves one: the value itself, an item label, an action's context. Depth 4
 * reaches the deepest of those (`action.event.context.<key>`).
 */
function holdsIndexCall(value: unknown, depth = 0): boolean {
  if (depth > 4 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => holdsIndexCall(item, depth + 1));
  if (isIndexCall(value)) return true;
  return Object.values(value).some((item) => holdsIndexCall(item, depth + 1));
}

/**
 * The deepest place below a stored prop where a dispatcher resolves a binding:
 * an operand of a logic call nested `A2UI_MAX_LOGIC_DEPTH` deep — three levels
 * per call (the call, its `args`, `values`) — in an action's context value,
 * itself three levels below the prop.
 */
const BINDING_SITE_DEPTH = 3 + 3 * A2UI_MAX_LOGIC_DEPTH;
const relativeSegmentsMemo = new WeakMap<A2uiComponentInstance, number>();

/**
 * The most segments a relative `{ "@path" }` binding in a component's stored
 * props has — what a template scope adds its own segments to. One refused on
 * its own segments was reported where it was validated and is not counted. The
 * walk also enters literals no dispatcher resolves, so a binding-shaped literal
 * counts too. Memoised per instance: the graph walk asks once per template item.
 */
function relativeBindingSegments(comp: A2uiComponentInstance): number {
  let deepest = relativeSegmentsMemo.get(comp);
  if (deepest === undefined) {
    deepest = 0;
    for (const value of comp.props.values()) deepest = Math.max(deepest, deepestRelative(value, 0));
    relativeSegmentsMemo.set(comp, deepest);
  }
  return deepest;
}

function deepestRelative(value: unknown, depth: number): number {
  if (depth > BINDING_SITE_DEPTH || value === null || typeof value !== 'object') return 0;
  const path = bindingPath(value);
  if (path !== undefined) {
    if (path.startsWith('/')) return 0;
    const segments = pointerSegmentCount(path);
    return segments > A2UI_MAX_DATA_DEPTH ? 0 : segments;
  }
  let deepest = 0;
  for (const item of Object.values(value)) {
    deepest = Math.max(deepest, deepestRelative(item, depth + 1));
  }
  return deepest;
}

// ── Component validation ─────────────────────────────────────────────────────

function validateComponent(
  surface: A2uiSurfaceState,
  catalogs: readonly A2uiCatalogSpec[],
  raw: unknown,
  base: string,
  envelopeIndex: number,
  idsSeen: Set<string>
): void {
  const surfaceId = surface.surfaceId;

  if (!isPlainObject(raw)) {
    surface.issues.push(
      issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, 'Component entry must be an object', {
        surfaceId,
        path: base
      })
    );
    return;
  }
  const comp = raw;

  const id = comp.id;
  if (typeof id !== 'string' || id === '') {
    surface.issues.push(
      issue('error', A2UI_ISSUE_CODES.MISSING_ID, 'Component is missing a string "id"', {
        surfaceId,
        path: `${base}/id`
      })
    );
    return;
  }
  if (PROTO_KEYS.has(id)) {
    surface.issues.push(
      issue('error', A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION, `Prohibited component id "${id}"`, {
        surfaceId,
        path: `${base}/id`
      })
    );
    return;
  }
  if (!A2UI_IDENTIFIER_RE.test(id)) {
    surface.issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.INVALID_ID,
        `Component id "${id}" must be an identifier (letters, digits and "_", no leading digit)`,
        { surfaceId, path: `${base}/id` }
      )
    );
  }
  if (idsSeen.has(id)) {
    surface.issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.DUPLICATE_ID,
        `Duplicate component id "${id}" in one components list (last wins)`,
        {
          surfaceId,
          path: `${base}/id`
        }
      )
    );
  }
  idsSeen.add(id);

  // A component that cannot be validated is still stored, without props: its
  // references then resolve to a fault chip instead of dangling.
  const unrendered = (component: string, resolved: A2uiCatalogSpec | undefined): void => {
    surface.components.set(id, {
      id,
      component,
      catalog: resolved,
      props: new Map(),
      usesIndex: false,
      sourceIndex: envelopeIndex
    });
  };

  const componentName = comp.component;
  if (typeof componentName !== 'string') {
    surface.issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.MISSING_FIELD,
        `Component "${id}" is missing a string "component"`,
        { surfaceId, path: `${base}/component` }
      )
    );
    unrendered('', undefined);
    return;
  }

  // A2UI 1.0 resolves a component through its own `@catalogId`, else through
  // the surface's default, and through nothing else.
  const ownCatalogId = comp[A2UI_CATALOG_ID_KEY];
  let catalog: A2uiCatalogSpec | undefined;
  if (ownCatalogId === undefined) {
    catalog = surface.catalog;
    // An unknown default was reported at createSurface, with this consequence.
    if (!catalog && surface.catalogId === undefined) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MISSING_FIELD,
          `Component "${id}" names no "${A2UI_CATALOG_ID_KEY}" and surface "${surfaceId}" has no default catalogId; it is not rendered`,
          { surfaceId, path: `${base}/${A2UI_CATALOG_ID_KEY}` }
        )
      );
    }
  } else if (typeof ownCatalogId === 'string') {
    catalog = resolveCatalog(catalogs, ownCatalogId);
    if (!catalog) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
          `Unknown "${A2UI_CATALOG_ID_KEY}" "${ownCatalogId}" on "${id}"; it is not rendered`,
          { surfaceId, path: `${base}/${A2UI_CATALOG_ID_KEY}` }
        )
      );
    }
  } else {
    surface.issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `"${A2UI_CATALOG_ID_KEY}" on "${id}" must be a string; it is not rendered`,
        { surfaceId, path: `${base}/${A2UI_CATALOG_ID_KEY}` }
      )
    );
  }
  if (!catalog) {
    unrendered(componentName, undefined);
    return;
  }

  const spec = ownEntry(catalog.registry, componentName);
  if (!spec) {
    if (catalog.unsupportedComponents.has(componentName)) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNSUPPORTED_COMPONENT,
          `Component "${componentName}" is not part of the rendered subset`,
          {
            surfaceId,
            path: `${base}/component`
          }
        )
      );
    } else {
      surface.issues.push(
        issue('error', A2UI_ISSUE_CODES.UNKNOWN_COMPONENT, `Unknown component "${componentName}"`, {
          surfaceId,
          path: `${base}/component`
        })
      );
    }
    unrendered(componentName, catalog);
    return;
  }

  const props = new Map<string, unknown>();
  const checkedGates = checksGates(spec);
  let checksHeld = false;
  for (const key of Object.keys(comp)) {
    if (key === 'id' || key === 'component' || key === A2UI_CATALOG_ID_KEY) continue;
    if (PROTO_KEYS.has(key)) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
          `Prohibited property "${key}" on "${id}"`,
          { surfaceId, path: `${base}/${key}` }
        )
      );
      continue;
    }
    if (key === A2UI_CHECKS_PROP) {
      if (checkedGates.length === 0) {
        surface.issues.push(
          issue(
            'warning',
            A2UI_ISSUE_CODES.IGNORED_PROP,
            `"${key}" on ${componentName} is not evaluated and is ignored`,
            { surfaceId, path: `${base}/${key}` }
          )
        );
        continue;
      }
      const checkIssues = checksIssues(
        componentName,
        comp[key],
        `${base}/${key}`,
        surfaceId,
        catalog.iconNames,
        surface.callCatalogs
      );
      checksHeld ||= checkIssues.some((i) => i.severity === 'error');
      const held = `; ${heldGates(spec, checkedGates)} until it is fixed`;
      for (const checkIssue of checkIssues) {
        surface.issues.push(
          checkIssue.severity === 'error'
            ? { ...checkIssue, message: `${checkIssue.message}${held}` }
            : checkIssue
        );
      }
      if (!checksHeld) props.set(key, comp[key]);
      continue;
    }
    if (key === A2UI_ACCESSIBILITY_PROP) {
      const result = validateAccessibility(
        componentName,
        comp[key],
        `${base}/${key}`,
        surfaceId,
        catalog.iconNames,
        surface.callCatalogs
      );
      for (const a11yIssue of result.issues) surface.issues.push(a11yIssue);
      if (result.store) props.set(key, comp[key]);
      continue;
    }
    if (key === A2UI_METADATA_KEY) {
      for (const metadataIssue of metadataIssues(
        comp[key],
        `${base}/${key}`,
        surfaceId,
        `"${key}" on "${id}"`
      )) {
        surface.issues.push(metadataIssue);
      }
      continue;
    }
    if (key.startsWith('@')) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.INVALID_RESERVED_KEY,
          `Unknown reserved key "${key}" on "${id}"; a component takes ${COMPONENT_MIXIN_KEYS}`,
          { surfaceId, path: `${base}/${key}` }
        )
      );
      continue;
    }
    const propSpec = ownEntry(spec.props, key);
    if (!propSpec) {
      // A bare `checks` is a gate rule the payload meant to apply: dropping it
      // must not leave the gate open.
      const heldLegacyChecks = key === 'checks' && checkedGates.length > 0;
      if (heldLegacyChecks) checksHeld = true;
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_PROP,
          `Unknown property "${key}" on ${componentName}${
            LEGACY_MIXIN_KEYS.has(key) ? `; A2UI 1.0 writes it "@${key}"` : ''
          }${heldLegacyChecks ? `; ${heldGates(spec, checkedGates)} until it is fixed` : ''}`,
          { surfaceId, path: `${base}/${key}` }
        )
      );
      continue;
    }
    const result = validateProp(
      componentName,
      key,
      propSpec,
      comp[key],
      `${base}/${key}`,
      surfaceId,
      catalog.iconNames,
      surface.callCatalogs
    );
    for (const propIssue of result.issues) surface.issues.push(propIssue);
    if (result.store) props.set(key, result.substitute ? result.substitute.value : comp[key]);
  }
  // After the loop, so a gate the payload lists after `@checks` cannot reopen it.
  if (checksHeld) for (const gate of checkedGates) props.set(gate, spec.props[gate].failsafe);

  for (const [key, propSpec] of Object.entries(spec.props)) {
    if (propSpec.required && !props.has(key)) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MISSING_FIELD,
          `Required property "${key}" is missing on ${componentName} "${id}"`,
          {
            surfaceId,
            path: `${base}/${key}`
          }
        )
      );
    }
  }

  // Per-component post-validation checks are catalog DATA (the Basic catalog
  // owns ChoicePicker chips-fallback and DateTimeInput missing-mode); the engine
  // stays free of catalog-specific branches.
  const check = ownEntry(catalog.componentChecks, componentName);
  if (check) {
    for (const checkIssue of check({ id, props, surfaceId, base })) surface.issues.push(checkIssue);
  }

  let usesIndex = false;
  for (const value of props.values()) {
    if (holdsIndexCall(value)) {
      usesIndex = true;
      break;
    }
  }
  surface.components.set(id, {
    id,
    component: componentName,
    catalog,
    props,
    usesIndex,
    sourceIndex: envelopeIndex
  });
}

// ── Envelope handlers ────────────────────────────────────────────────────────

function flagExtraKeys(
  object: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  sink: A2uiValidationIssue[],
  surfaceId: string | undefined,
  base: string,
  container: string
): void {
  for (const key of Object.keys(object)) {
    if (allowed.has(key)) continue;
    const code = PROTO_KEYS.has(key)
      ? A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION
      : A2UI_ISSUE_CODES.UNKNOWN_PROP;
    sink.push(
      issue('error', code, `Unexpected key "${key}" in ${container}`, {
        surfaceId,
        path: `${base}/${key}`
      })
    );
  }
}

const CREATE_SURFACE_KEYS: ReadonlySet<string> = new Set([
  'surfaceId',
  'catalogId',
  'sendDataModel',
  'components',
  'dataModel',
  'metadata'
]);
/** `createSurface.theme` left the protocol with 1.0; it gets a message of its own. */
const REMOVED_THEME_KEY = 'theme';
const CREATE_SURFACE_KNOWN_KEYS: ReadonlySet<string> = new Set([
  ...CREATE_SURFACE_KEYS,
  REMOVED_THEME_KEY
]);
const UPDATE_COMPONENTS_KEYS: ReadonlySet<string> = new Set(['surfaceId', 'components']);
const UPDATE_DATA_MODEL_KEYS: ReadonlySet<string> = new Set(['surfaceId', 'path', 'value']);
const DELETE_SURFACE_KEYS: ReadonlySet<string> = new Set(['surfaceId']);

function createProcessor(
  catalogs: readonly A2uiCatalogSpec[],
  dataSchema: A2uiDataSchema | undefined,
  surfaceRequirements: A2uiSurfaceRequirements | undefined
): A2uiProcessor {
  const surfaces = new Map<string, A2uiSurfaceState>();
  const globalIssues: A2uiValidationIssue[] = [];

  // A component may come from any configured catalog (`@catalogId`), so an
  // entry is the consumer's mistake only when none of them can meet it. One the
  // surface's default cannot meet stays checked, and its error names a catalog
  // that can.
  function applyRequirements(surface: A2uiSurfaceState): void {
    // An own entry only: `a2uiSurfaceRequirementsSection` reads `Object.entries`,
    // so an inherited one was never in the prompt and must not be checked.
    const requested = ownEntry(surfaceRequirements, surface.surfaceId);
    if (!Array.isArray(requested) || requested.length === 0) return;
    const checked: A2uiSurfaceRequirement[] = [];
    for (const requirement of requested) {
      const able = catalogs.find((catalog) => requirementFault(requirement, catalog) === undefined);
      if (!able) {
        const fault = requirementFault(requirement, surface.catalog ?? catalogs[0]);
        surface.issues.push(
          issue(
            'warning',
            A2UI_ISSUE_CODES.INVALID_REQUIREMENT,
            `surfaceRequirements for "${surface.surfaceId}" ask for ${describeRequirement(requirement)}, which no configured catalog can meet (${fault}); it is not checked`,
            { surfaceId: surface.surfaceId }
          )
        );
        continue;
      }
      const onDefault =
        surface.catalog !== undefined &&
        requirementFault(requirement, surface.catalog) === undefined;
      checked.push(onDefault ? { requirement } : { requirement, catalogId: able.catalogId });
    }
    surface.requirements = checked;
  }

  function applyComponents(
    surface: A2uiSurfaceState,
    components: unknown,
    listPath: string,
    index: number,
    container: string
  ): void {
    const surfaceId = surface.surfaceId;
    if (!Array.isArray(components) || components.length === 0) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MISSING_FIELD,
          `${container}.components must be a non-empty array`,
          { surfaceId, path: listPath }
        )
      );
      return;
    }
    let limit = components.length;
    if (limit > MAX_COMPONENTS_PER_UPDATE) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MAX_COMPONENTS,
          `${container} carries ${components.length} components; only the first ${MAX_COMPONENTS_PER_UPDATE} are processed`,
          { surfaceId, path: listPath }
        )
      );
      limit = MAX_COMPONENTS_PER_UPDATE;
    }
    const idsSeen = new Set<string>();
    for (let i = 0; i < limit; i++) {
      validateComponent(surface, catalogs, components[i], `${listPath}/${i}`, index, idsSeen);
    }
  }

  function handleCreateSurface(env: Record<string, unknown>, base: string, index: number): void {
    const cs = env.createSurface;
    if (!isPlainObject(cs)) {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'createSurface must be an object', {
          path: `${base}/createSurface`
        })
      );
      return;
    }
    const surfaceId = cs.surfaceId;
    if (typeof surfaceId !== 'string' || surfaceId === '') {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'createSurface.surfaceId is required', {
          path: `${base}/createSurface/surfaceId`
        })
      );
      return;
    }
    const existing = surfaces.get(surfaceId);
    if (existing) {
      existing.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.DUPLICATE_SURFACE,
          `Surface "${surfaceId}" already exists; delete it before recreating`,
          {
            surfaceId,
            path: `${base}/createSurface/surfaceId`
          }
        )
      );
      return;
    }
    if (surfaces.size >= MAX_SURFACES) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MAX_SURFACES,
          `Surface count exceeds the limit of ${MAX_SURFACES}; "${surfaceId}" was not created`,
          { surfaceId, path: `${base}/createSurface/surfaceId` }
        )
      );
      return;
    }

    const catalogId = typeof cs.catalogId === 'string' ? cs.catalogId : undefined;
    const catalog = catalogId === undefined ? undefined : resolveCatalog(catalogs, catalogId);
    const surface: A2uiSurfaceState = {
      surfaceId,
      components: new Map(),
      dataModel: undefined,
      issues: [],
      catalogId,
      catalog,
      callCatalogs: (id) =>
        (id === undefined ? catalog : resolveCatalog(catalogs, id)) !== undefined,
      sendDataModel: false
    };

    if (catalogId === undefined) {
      if (cs.catalogId !== undefined) {
        surface.issues.push(
          issue(
            'error',
            A2UI_ISSUE_CODES.TYPE_MISMATCH,
            'createSurface.catalogId must be a string',
            {
              surfaceId,
              path: `${base}/createSurface/catalogId`
            }
          )
        );
      }
    } else if (!catalog) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
          `Unknown catalogId "${catalogId}"; a component of this surface renders only with a known "${A2UI_CATALOG_ID_KEY}" of its own`,
          { surfaceId, path: `${base}/createSurface/catalogId` }
        )
      );
    }
    applyRequirements(surface);
    if (REMOVED_THEME_KEY in cs) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_PROP,
          `createSurface.theme is not part of A2UI ${A2UI_PROTOCOL_VERSION}; the host styles the surface`,
          { surfaceId, path: `${base}/createSurface/${REMOVED_THEME_KEY}` }
        )
      );
    }
    if ('sendDataModel' in cs) {
      if (typeof cs.sendDataModel === 'boolean') {
        surface.sendDataModel = cs.sendDataModel;
      } else {
        surface.issues.push(
          issue('warning', A2UI_ISSUE_CODES.TYPE_MISMATCH, 'sendDataModel must be a boolean', {
            surfaceId,
            path: `${base}/createSurface/sendDataModel`
          })
        );
      }
    }
    if ('metadata' in cs) {
      for (const metadataIssue of metadataIssues(
        cs.metadata,
        `${base}/createSurface/metadata`,
        surfaceId,
        'createSurface.metadata'
      )) {
        surface.issues.push(metadataIssue);
      }
    }
    flagExtraKeys(
      cs,
      CREATE_SURFACE_KNOWN_KEYS,
      surface.issues,
      surfaceId,
      `${base}/createSurface`,
      'createSurface'
    );

    // A2UI applies `dataModel` before `components`. No binding resolves before
    // the render, so the order shows only in the order of the issues.
    if ('dataModel' in cs) {
      if (isPlainObject(cs.dataModel)) {
        const write = writeDataModel(undefined, '', cs.dataModel);
        if (!write.ok) {
          surface.issues.push(
            issue(
              'error',
              write.code,
              `createSurface.dataModel: ${write.message}; it is not applied`,
              {
                surfaceId,
                path: `${base}/createSurface/dataModel`
              }
            )
          );
        } else {
          surface.dataModel = write.model;
          if (dataSchema) {
            for (const schemaIssue of validateSchemaWrite(
              dataSchema,
              undefined,
              cs.dataModel,
              surfaceId
            )) {
              surface.issues.push(schemaIssue);
            }
          }
        }
      } else {
        surface.issues.push(
          issue(
            'error',
            A2UI_ISSUE_CODES.TYPE_MISMATCH,
            'createSurface.dataModel must be an object',
            { surfaceId, path: `${base}/createSurface/dataModel` }
          )
        );
      }
    }
    if ('components' in cs) {
      applyComponents(
        surface,
        cs.components,
        `${base}/createSurface/components`,
        index,
        'createSurface'
      );
    }
    // Registered last: a createSurface the engine fails on midway leaves no
    // half-built surface behind that would refuse the retry as a duplicate.
    surfaces.set(surfaceId, surface);
  }

  function handleUpdateComponents(env: Record<string, unknown>, base: string, index: number): void {
    const uc = env.updateComponents;
    if (!isPlainObject(uc)) {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'updateComponents must be an object', {
          path: `${base}/updateComponents`
        })
      );
      return;
    }
    const surfaceId = uc.surfaceId;
    if (typeof surfaceId !== 'string') {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'updateComponents.surfaceId is required', {
          path: `${base}/updateComponents/surfaceId`
        })
      );
      return;
    }
    const surface = surfaces.get(surfaceId);
    if (!surface) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.NO_SURFACE,
          `updateComponents for unknown surface "${surfaceId}" (createSurface must come first)`,
          {
            surfaceId,
            path: `${base}/updateComponents`
          }
        )
      );
      return;
    }
    flagExtraKeys(
      uc,
      UPDATE_COMPONENTS_KEYS,
      surface.issues,
      surfaceId,
      `${base}/updateComponents`,
      'updateComponents'
    );
    applyComponents(
      surface,
      uc.components,
      `${base}/updateComponents/components`,
      index,
      'updateComponents'
    );
  }

  function handleUpdateDataModel(env: Record<string, unknown>, base: string): void {
    const udm = env.updateDataModel;
    if (!isPlainObject(udm)) {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'updateDataModel must be an object', {
          path: `${base}/updateDataModel`
        })
      );
      return;
    }
    const surfaceId = udm.surfaceId;
    if (typeof surfaceId !== 'string') {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'updateDataModel.surfaceId is required', {
          path: `${base}/updateDataModel/surfaceId`
        })
      );
      return;
    }
    const surface = surfaces.get(surfaceId);
    if (!surface) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.NO_SURFACE,
          `updateDataModel for unknown surface "${surfaceId}" (createSurface must come first)`,
          {
            surfaceId,
            path: `${base}/updateDataModel`
          }
        )
      );
      return;
    }
    flagExtraKeys(
      udm,
      UPDATE_DATA_MODEL_KEYS,
      surface.issues,
      surfaceId,
      `${base}/updateDataModel`,
      'updateDataModel'
    );

    const pathValue = udm.path;
    if (pathValue !== undefined && typeof pathValue !== 'string') {
      surface.issues.push(
        issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, 'updateDataModel.path must be a string', {
          surfaceId,
          path: `${base}/updateDataModel/path`
        })
      );
      return;
    }
    if (!('value' in udm)) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MISSING_FIELD,
          'updateDataModel.value is required; send null to delete the key at "path"',
          { surfaceId, path: `${base}/updateDataModel/value` }
        )
      );
      return;
    }
    // A2UI 1.0: null is how a message deletes, so it is never a value to store.
    const deletes = udm.value === null;
    const write = writeDataModel(
      surface.dataModel,
      pathValue ?? '',
      deletes ? undefined : udm.value
    );
    if (!write.ok) {
      surface.issues.push(
        issue('error', write.code, `updateDataModel: ${write.message}; nothing is written`, {
          surfaceId,
          path: `${base}/updateDataModel/${write.refused === 'pointer' ? 'path' : 'value'}`
        })
      );
      return;
    }
    surface.dataModel = write.model;

    // Schema validation (opt-in): a type mismatch on a declared pointer is an
    // error, a write to an undeclared top-level branch a warning — both relayed
    // to the agent. It reports and never refuses, so it runs on what was written.
    if (dataSchema) {
      const schemaIssues = validateSchemaWrite(
        dataSchema,
        pathValue,
        deletes ? undefined : udm.value,
        surfaceId
      );
      for (const schemaIssue of schemaIssues) surface.issues.push(schemaIssue);
    }
  }

  function handleDeleteSurface(env: Record<string, unknown>, base: string): void {
    const ds = env.deleteSurface;
    if (!isPlainObject(ds)) {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'deleteSurface must be an object', {
          path: `${base}/deleteSurface`
        })
      );
      return;
    }
    const surfaceId = ds.surfaceId;
    if (typeof surfaceId !== 'string') {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'deleteSurface.surfaceId is required', {
          path: `${base}/deleteSurface/surfaceId`
        })
      );
      return;
    }
    if (!surfaces.has(surfaceId)) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.NO_SURFACE,
          `deleteSurface for unknown surface "${surfaceId}"`,
          { surfaceId, path: `${base}/deleteSurface` }
        )
      );
      return;
    }
    flagExtraKeys(
      ds,
      DELETE_SURFACE_KEYS,
      globalIssues,
      surfaceId,
      `${base}/deleteSurface`,
      'deleteSurface'
    );
    surfaces.delete(surfaceId);
  }

  // The two function-call messages of A2UI 1.0 are recognised and refused. The
  // functions this engine evaluates (`not`, `and`, `or`, `@index`) are for the
  // renderer's own bindings, none may be called by the agent, and it routes no
  // call to the agent — so there is nothing to run and nothing to be answered.
  // The issue carries the functionCallId, which is what a transport needs to
  // answer the call with a `rendererFunctionResponse` error.
  function handleCallRendererFunction(env: Record<string, unknown>, base: string): void {
    const call = env.callRendererFunction;
    const functionCallId =
      isPlainObject(call) && typeof call.functionCallId === 'string'
        ? call.functionCallId
        : undefined;
    const name = isPlainObject(call) ? callName(call.callFunction) : undefined;
    globalIssues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.INVALID_FUNCTION_CALL,
        `${
          name === undefined ? 'callRendererFunction' : `Function "${name}"`
        } cannot be called by the agent: this renderer runs no function on the agent's behalf`,
        { functionCallId, path: `${base}/callRendererFunction` }
      )
    );
  }

  function handleAgentFunctionResponse(env: Record<string, unknown>, base: string): void {
    const response = env.agentFunctionResponse;
    const functionCallId =
      isPlainObject(response) && typeof response.functionCallId === 'string'
        ? response.functionCallId
        : undefined;
    globalIssues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.INVALID_FUNCTION_CALL,
        'agentFunctionResponse answers no call: this renderer calls no function on the agent',
        { functionCallId, path: `${base}/agentFunctionResponse` }
      )
    );
  }

  function apply(envelope: unknown, index: number): void {
    const base = `/messages/${index}`;
    if (!isPlainObject(envelope)) {
      globalIssues.push(
        issue('error', A2UI_ISSUE_CODES.INVALID_ENVELOPE, 'Envelope must be a JSON object', {
          path: base
        })
      );
      return;
    }
    const env = envelope;

    if (env.version !== A2UI_PROTOCOL_VERSION) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.INVALID_VERSION,
          `Unsupported envelope version${
            typeof env.version === 'string' ? ` "${env.version}"` : ''
          } (expected "${A2UI_PROTOCOL_VERSION}")`,
          {
            path: `${base}/version`
          }
        )
      );
      return;
    }

    const present = A2UI_MESSAGE_KEYS.filter((key) => key in env);
    if (present.length !== 1) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_ENVELOPE_TYPE,
          `Envelope must contain exactly one of: ${A2UI_MESSAGE_KEYS.join(', ')} (found ${present.length})`,
          { path: base }
        )
      );
      return;
    }

    const allowedTop: ReadonlySet<string> = new Set(['version', present[0]]);
    flagExtraKeys(env, allowedTop, globalIssues, undefined, base, 'envelope');

    switch (present[0]) {
      case 'createSurface':
        handleCreateSurface(env, base, index);
        break;
      case 'updateComponents':
        handleUpdateComponents(env, base, index);
        break;
      case 'updateDataModel':
        handleUpdateDataModel(env, base);
        break;
      case 'deleteSurface':
        handleDeleteSurface(env, base);
        break;
      case 'callRendererFunction':
        handleCallRendererFunction(env, base);
        break;
      case 'agentFunctionResponse':
        handleAgentFunctionResponse(env, base);
        break;
    }
  }

  return { surfaces, globalIssues, apply };
}

export function createA2uiProcessor(options?: A2uiProcessorOptions): A2uiProcessor {
  const catalogs = options?.catalogs?.length ? options.catalogs : [basicA2uiCatalogSpec];
  return createProcessor(catalogs, options?.dataSchema, options?.surfaceRequirements);
}

/**
 * Normalize a render payload into an envelope list. Accepts an envelope array,
 * a single envelope, or the golden-file `{ messages: [...] }` wrapper. Returns
 * an `issue` (and no envelopes) only for wholly unusable input.
 */
export function normalizeA2uiPayload(payload: unknown): {
  envelopes: unknown[];
  issue?: A2uiValidationIssue;
} {
  if (Array.isArray(payload)) return { envelopes: payload };
  if (isPlainObject(payload)) {
    if (Array.isArray(payload.messages)) return { envelopes: payload.messages };
    return { envelopes: [payload] };
  }
  return {
    envelopes: [],
    issue: issue(
      'error',
      A2UI_ISSUE_CODES.INVALID_ENVELOPE,
      'A2UI payload must be an envelope, an array of envelopes, or { messages: [...] }'
    )
  };
}

// ── Graph-level validation (compatible extension, see report) ────────────────

export interface GraphIssueOptions {
  /** When true, dangling refs are warnings (still streaming); when false, errors. @default false */
  streaming?: boolean;
  /** @default 32 */
  maxDepth?: number;
  /** @default 512 */
  maxNodes?: number;
}

/**
 * Which requirements a maximum matching of requirements to rendered components
 * meets — one component meets one entry, so two Checkbox entries ask for two.
 * `candidates[r]` lists the components requirement `r` could use. Augmenting
 * paths (Kuhn), so the number left missing is the fewest any assignment
 * leaves. Requirements are tried in `order`; where the count is the same
 * either way, an earlier one stays met.
 */
function matchRequirements(candidates: readonly number[][], order: readonly number[]): Set<number> {
  const owner = new Map<number, number>();
  const assign = (requirement: number, seen: Set<number>): boolean => {
    for (const component of candidates[requirement]) {
      if (seen.has(component)) continue;
      seen.add(component);
      const holder = owner.get(component);
      if (holder === undefined || assign(holder, seen)) {
        owner.set(component, requirement);
        return true;
      }
    }
    return false;
  };
  const matched = new Set<number>();
  for (const requirement of order) {
    if (assign(requirement, new Set())) matched.add(requirement);
  }
  return matched;
}

/**
 * Walk the component graph from `root` and collect structural faults that only
 * exist once components are assembled: cycles, excessive depth/nodes, dangling
 * child references, non-array template paths, mis-placed `weight`, `@index`
 * outside a template, a relative binding a template scope takes deeper than the
 * data model nests, and — on a settled surface only — every `requirements`
 * entry no component rendered from `root` meets. A surface without a `root`
 * reports at most `MISSING_ROOT`.
 *
 * Their severity depends on `streaming`, which is why they are collected on
 * demand rather than stored. Traversal is bounded by `maxNodes` — every child
 * reference spends one, a cycle's back-reference too — so neither a template
 * over a huge array nor a fan-out of self-references can DoS the walk itself.
 */
export function collectGraphIssues(
  surface: A2uiSurfaceState,
  options?: GraphIssueOptions
): A2uiValidationIssue[] {
  const streaming = options?.streaming ?? false;
  const maxDepth = options?.maxDepth ?? 32;
  const maxNodes = options?.maxNodes ?? 512;
  const surfaceId = surface.surfaceId;
  const components = surface.components;
  const issues: A2uiValidationIssue[] = [];

  if (!components.has('root')) {
    if (!streaming) {
      issues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_ROOT, 'No component with id "root" was defined', {
          surfaceId
        })
      );
    }
    return issues;
  }

  const reportedDangling = new Set<string>();
  const reportedIndex = new Set<string>();
  const reportedScopeDepth = new Set<string>();
  // Mid-stream every requirement would read as missing — the surface arrives
  // over several envelopes — so they are checked on the settled tree only.
  const required = streaming ? [] : (surface.requirements ?? []);
  // For each requirement, the rendered components (numbered in visit order)
  // that could meet it; matched after the walk.
  const candidates: number[][] = required.map(() => []);
  let renderedCount = 0;
  let nodeCount = 0;
  let overflowReported = false;
  let aborted = false;

  // Child references are discovered by prop KIND (childId / childList) from the
  // registry of the component's own catalog, not by fixed `child`/`children`
  // names — so a catalog may name its child slots freely.
  const childTargets = (
    comp: A2uiComponentInstance,
    scopePrefix: string | undefined
  ): Array<{ id: string; scope: string | undefined }> => {
    const out: Array<{ id: string; scope: string | undefined }> = [];
    const spec = ownEntry(comp.catalog?.registry, comp.component);
    if (!spec) return out;

    for (const [key, propSpec] of Object.entries(spec.props)) {
      if (propSpec.kind === 'childId') {
        const single = comp.props.get(key);
        if (typeof single === 'string') out.push({ id: single, scope: scopePrefix });
      } else if (propSpec.kind === 'labeledChildren') {
        const items = comp.props.get(key);
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && typeof item === 'object') {
              const child = (item as { child?: unknown }).child;
              if (typeof child === 'string') out.push({ id: child, scope: scopePrefix });
            }
            if (out.length > maxNodes) break; // bound expansion
          }
        }
      } else if (propSpec.kind === 'childList') {
        const children = comp.props.get(key);
        if (Array.isArray(children)) {
          for (const childId of children) {
            if (typeof childId === 'string') out.push({ id: childId, scope: scopePrefix });
            if (out.length > maxNodes) break; // bound expansion
          }
        } else if (children && typeof children === 'object') {
          const template = children as { componentId?: unknown; path?: unknown };
          if (typeof template.componentId === 'string' && typeof template.path === 'string') {
            const absPath = scopedPointer(template.path, scopePrefix);
            const list = getAtPointer(surface.dataModel, absPath);
            if (Array.isArray(list)) {
              for (let i = 0; i < list.length; i++) {
                out.push({ id: template.componentId, scope: `${absPath}/${i}` });
                if (out.length > maxNodes) break; // bound expansion
              }
            } else if (list !== undefined) {
              issues.push(
                issue(
                  'warning',
                  A2UI_ISSUE_CODES.TEMPLATE_PATH_NOT_ARRAY,
                  `Template path "${absPath}" did not resolve to an array`,
                  {
                    surfaceId
                  }
                )
              );
            }
            // list === undefined → data not present yet; render nothing (graceful).
          }
        }
      }
    }
    return out;
  };

  // Every child reference the walk takes spends one of `maxNodes`: a visited
  // node, and a reference refused as a cycle, which `buildRenderTree` counts
  // the same way — so in both walks a fan-out of back-references is as short
  // as a fan-out of nodes.
  const spend = (): boolean => {
    nodeCount++;
    if (nodeCount <= maxNodes) return true;
    if (!overflowReported) {
      issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MAX_NODES,
          `Rendered node count exceeds the limit of ${maxNodes}`,
          { surfaceId }
        )
      );
      overflowReported = true;
    }
    aborted = true;
    return false;
  };
  // One CYCLE per edge (parent id → ancestor id), however often it is reached.
  const reportedCycles = new Set<string>();

  const visit = (
    id: string,
    depth: number,
    stack: Set<string>,
    parent: A2uiComponentInstance | null,
    scopePrefix: string | undefined
  ): void => {
    if (aborted || !spend()) return;
    if (depth > maxDepth) {
      issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MAX_DEPTH,
          `Component tree depth exceeds the limit of ${maxDepth}`,
          { surfaceId }
        )
      );
      return;
    }

    const comp = components.get(id);
    if (!comp) {
      if (!reportedDangling.has(id)) {
        reportedDangling.add(id);
        issues.push(
          issue(
            streaming ? 'warning' : 'error',
            A2UI_ISSUE_CODES.DANGLING_REF,
            `Reference to undefined component "${id}"`,
            { surfaceId }
          )
        );
      }
      return;
    }

    if (required.length > 0) {
      const rendered = renderedCount++;
      // The view makes a hidden component inert: no one can operate it.
      const reachable =
        readHidden(
          comp.props.get(A2UI_ACCESSIBILITY_PROP),
          (value) =>
            resolveDynamic(value, surface.dataModel, scopePrefix, surface.callCatalogs).value
        ) !== true;
      required.forEach((entry, index) => {
        if (reachable && meetsRequirement(entry.requirement, comp, scopePrefix)) {
          candidates[index].push(rendered);
        }
      });
    }

    if (comp.usesIndex && scopePrefix === undefined && !reportedIndex.has(id)) {
      reportedIndex.add(id);
      issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.INDEX_OUTSIDE_TEMPLATE,
          `"${A2UI_INDEX_FUNCTION}" on "${id}" has no list template to count in; it resolves to nothing`,
          { surfaceId }
        )
      );
    }

    // A relative binding is checked on its own segments when it is validated;
    // the scope of each template item it renders in adds the item's.
    if (scopePrefix !== undefined && !reportedScopeDepth.has(id)) {
      const relative = relativeBindingSegments(comp);
      const scoped = pointerSegmentCount(scopePrefix) + relative;
      if (relative > 0 && scoped > A2UI_MAX_DATA_DEPTH) {
        reportedScopeDepth.add(id);
        issues.push(
          issue(
            'error',
            A2UI_ISSUE_CODES.MAX_DEPTH,
            `"${id}" binds a relative path of ${relative} segments, which in the template item "${scopePrefix}" reaches ${scoped} levels, deeper than the ${A2UI_MAX_DATA_DEPTH} a data model nests; it resolves to nothing`,
            { surfaceId }
          )
        );
      }
    }

    // A bound `options` list is only checkable once it resolves — the envelope
    // validator saw a { "@path" }, not a list. Silent while the path is still
    // undefined (the agent fills it in with a later updateDataModel); a warning
    // once it holds something that is not an option list, because the control
    // then renders empty and the user is stuck with no way to choose.
    for (const [key, propSpec] of Object.entries(
      ownEntry(comp.catalog?.registry, comp.component)?.props ?? {}
    )) {
      if (propSpec.kind !== 'options' || !propSpec.dynamic) continue;
      const bound = bindingPath(comp.props.get(key));
      if (bound === undefined) continue;
      const pointer = scopedPointer(bound, scopePrefix);
      const resolvedList = getAtPointer(surface.dataModel, pointer);
      if (resolvedList === undefined || Array.isArray(resolvedList)) continue;
      issues.push(
        issue(
          'warning',
          A2UI_ISSUE_CODES.OPTIONS_NOT_A_LIST,
          `"${key}" on "${id}" is bound to "${pointer}", which is not a list of options`,
          { surfaceId }
        )
      );
    }

    if (comp.props.has('weight') && !parent?.catalog?.flexContainers.has(parent.component)) {
      issues.push(
        issue(
          'warning',
          A2UI_ISSUE_CODES.WEIGHT_CONTEXT,
          `"weight" on "${id}" is only honored as a direct child of Row or Column`,
          {
            surfaceId
          }
        )
      );
    }

    const nextStack = new Set(stack);
    nextStack.add(id);
    for (const target of childTargets(comp, scopePrefix)) {
      if (aborted) return;
      if (nextStack.has(target.id)) {
        if (!spend()) return;
        const edge = `${id.length}:${id}${target.id}`;
        if (!reportedCycles.has(edge)) {
          reportedCycles.add(edge);
          issues.push(
            issue(
              'error',
              A2UI_ISSUE_CODES.CYCLE,
              `Cycle detected at component "${target.id}", referenced by "${id}"`,
              { surfaceId }
            )
          );
        }
        continue;
      }
      visit(target.id, depth + 1, nextStack, comp, target.scope);
    }
  };

  visit('root', 0, new Set(), null, undefined);
  // Bound entries first: a box bound to /agreed counts as the consent box, and a
  // name-only entry it could also meet is the one reported missing.
  const order = required
    .map((_, index) => index)
    .sort(
      (a, b) =>
        Number(required[b].requirement.path !== undefined) -
        Number(required[a].requirement.path !== undefined)
    );
  const matched = matchRequirements(candidates, order);
  required.forEach((entry, index) => {
    if (matched.has(index)) return;
    const elsewhere = entry.catalogId
      ? `; this surface's default catalog cannot hold it, so give the component "${A2UI_CATALOG_ID_KEY}": "${entry.catalogId}"`
      : '';
    issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT,
        `Surface "${surfaceId}" must contain ${describeRequirement(entry.requirement)}; none renders from "root" (a fault chip or a hidden one does not count)${elsewhere}`,
        { surfaceId }
      )
    );
  });
  return issues;
}

// ── Payload-level validation (the view's issue list, without the view) ───────

/**
 * Apply one envelope. The engine's contract is that a hostile payload becomes
 * issues, never an exception; when that contract breaks, the exception becomes
 * an `ENGINE_ERROR` issue instead, so the surfaces that already parsed survive
 * and the fault lands where every other one is reported.
 */
export function applyA2uiEnvelope(
  processor: A2uiProcessor,
  envelope: unknown,
  index: number
): void {
  try {
    processor.apply(envelope, index);
  } catch (error) {
    processor.globalIssues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.ENGINE_ERROR,
        `The A2UI engine failed on message ${index}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { path: `/messages/${index}` }
      )
    );
    if (import.meta.env?.DEV) console.error('[A2UI] engine error', error);
  }
}

/**
 * Every issue a processor's current state carries, in the order `A2UIView`
 * hands them to `onValidationError`: the payload-shape issue, the
 * envelope-level ones, then per surface its own issues and its graph issues.
 * `streaming` decides the graph issues as in {@link collectGraphIssues}.
 * A2UIView builds its list with this function.
 */
export function collectA2uiIssues(
  processor: A2uiProcessor,
  options?: { streaming?: boolean; payloadIssue?: A2uiValidationIssue }
): A2uiValidationIssue[] {
  const issues: A2uiValidationIssue[] = [];
  if (options?.payloadIssue) issues.push(options.payloadIssue);
  for (const globalIssue of processor.globalIssues) issues.push(globalIssue);
  for (const surface of processor.surfaces.values()) {
    for (const surfaceIssue of surface.issues) issues.push(surfaceIssue);
    for (const graphIssue of collectGraphIssues(surface, { streaming: options?.streaming })) {
      issues.push(graphIssue);
    }
  }
  return issues;
}

/** Options for {@link validateA2uiPayload} — `A2UIView`'s validation props, in spec form. */
export interface A2uiPayloadValidationOptions {
  /**
   * The catalogs beyond Basic, as `A2UIView`'s `catalogs` takes them: Basic is
   * always configured. Pass the specs (`urbiconA2uiCatalogSpec`) where the view
   * gets the wired catalogs (`urbiconA2uiCatalog`).
   */
  catalogs?: readonly A2uiCatalogSpec[];
  /** The view's `dataSchema`. */
  dataSchema?: A2uiDataSchema;
  /** The view's `surfaceRequirements`. */
  surfaceRequirements?: A2uiSurfaceRequirements;
}

/**
 * Validate a complete payload the way `A2UIView` does, without a DOM or
 * Svelte: the issues a view given the same payload and options reports through
 * `onValidationError` once `streaming` is false, in the same order. A tool
 * handler runs it on its arguments and answers with an error result when an
 * error-severity issue is among them, so the agent corrects the surface in the
 * same turn.
 *
 * What only the view can report: issues that read the data model after the
 * user changed it. When the user's input leaves a template path or an
 * `options` binding pointing at something that is not a list, the view reports
 * it on that edit; this function sees the data model as the payload wrote it.
 *
 * @example
 * ```ts
 * const issues = validateA2uiPayload(args, { catalogs: [urbiconA2uiCatalogSpec] });
 * const errors = issues.filter((issue) => issue.severity === 'error');
 * if (errors.length > 0) {
 *   return { isError: true, content: [{ type: 'text', text: a2uiErrorMessage(errors) }] };
 * }
 * ```
 */
export function validateA2uiPayload(
  payload: unknown,
  options?: A2uiPayloadValidationOptions
): A2uiValidationIssue[] {
  const { envelopes, issue: payloadIssue } = normalizeA2uiPayload(payload);
  const processor = createA2uiProcessor({
    catalogs: [basicA2uiCatalogSpec, ...(options?.catalogs ?? [])],
    dataSchema: options?.dataSchema,
    surfaceRequirements: options?.surfaceRequirements
  });
  envelopes.forEach((envelope, index) => {
    applyA2uiEnvelope(processor, envelope, index);
  });
  return collectA2uiIssues(processor, { streaming: false, payloadIssue });
}
