/**
 * The A2UI processor: incremental, whitelist-only, fail-loud validation that
 * turns a stream of Server→Client envelopes into per-surface component maps and
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
import { cloneData, deleteAtPointer, getAtPointer, setAtPointer } from './a2ui-data';
import {
  A2UI_SUPPORTED_VERSIONS,
  A2UI_SVG_PATH_RE,
  type A2uiPropSpec,
  ownEntry
} from './a2ui-registry';
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
  /** Only registry-declared props; the raw payload values (dynamics resolved at render). */
  props: ReadonlyMap<string, unknown>;
  /** Index of the envelope that last defined this component. */
  sourceIndex: number;
}

export interface A2uiSurfaceState {
  surfaceId: string;
  components: Map<string, A2uiComponentInstance>;
  /** Root of the surface data model (mutated in place by two-way edits). */
  dataModel: unknown;
  issues: A2uiValidationIssue[];
  /**
   * The catalog resolved from `createSurface.catalogId` (or the default when the
   * id names no configured catalog). Every downstream check — registry lookup,
   * icon set, flex containers, per-component checks — reads it, so surfaces on
   * different catalogs validate and render independently.
   */
  catalog: A2uiCatalogSpec;
  /**
   * `createSurface.sendDataModel` — when true, every action dispatched from this
   * surface carries the full data model (see `A2uiActionEvent.dataModel`), so
   * the agent sees the user's input even for fields it left out of `context`.
   */
  sendDataModel: boolean;
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
   * The catalogs this processor understands, in priority order. `catalogs[0]`
   * is the default/fallback. Defaults to `[basicA2uiCatalogSpec]` — a
   * single-catalog processor accepts any `catalogId` string silently
   * (back-compat); an unknown id only warns once there are ≥ 2 catalogs.
   */
  catalogs?: readonly A2uiCatalogSpec[];
  /**
   * Optional data schema. When set, every `updateDataModel` write is validated
   * against it — a type mismatch on a declared pointer is a `SCHEMA_TYPE_MISMATCH`
   * error, a write to an undeclared top-level branch a `SCHEMA_UNDECLARED_PATH`
   * warning. Omitting it disables schema validation entirely (back-compat).
   */
  dataSchema?: A2uiDataSchema;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === 'object';
}

function issue(
  severity: A2uiIssueSeverity,
  code: string,
  message: string,
  extra?: { surfaceId?: string; path?: string }
): A2uiValidationIssue {
  return { severity, code, message, ...extra };
}

const OP_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'] as const;

// ── Dynamic-value shape guards ───────────────────────────────────────────────

function isDataBinding(value: unknown): boolean {
  return isPlainObject(value) && typeof value.path === 'string';
}
function isFunctionCall(value: unknown): boolean {
  return isPlainObject(value) && typeof value.call === 'string';
}
function isDynamicRef(value: unknown): boolean {
  return isDataBinding(value) || isFunctionCall(value);
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
 * needs). A function-call binding is unsupported (renders to nothing → warning);
 * a `{ path }` binding whose pointer contains a prototype-pollution segment is a
 * hard error (position-independent, so scope need not be resolved here). Plain
 * literals return no issues.
 */
function dynamicRefIssues(value: unknown, path: string, surfaceId: string): A2uiValidationIssue[] {
  if (isFunctionCall(value)) {
    const call = (value as Record<string, unknown>).call;
    return [
      issue(
        'warning',
        A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
        `Function-call binding "${String(call)}" is not supported; it resolves to nothing`,
        { surfaceId, path }
      )
    ];
  }
  if (isDataBinding(value)) {
    const raw = (value as Record<string, unknown>).path as string;
    const tokens = (raw.startsWith('/') ? raw.slice(1) : raw).split('/');
    for (const token of tokens) {
      const segment = token.replaceAll('~1', '/').replaceAll('~0', '~');
      if (PROTO_KEYS.has(segment)) {
        return [
          issue(
            'error',
            A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
            `Prohibited property name "${segment}" in binding path "${raw}"`,
            { surfaceId, path }
          )
        ];
      }
    }
  }
  return [];
}

// ── Per-prop validation ──────────────────────────────────────────────────────

interface PropResult {
  store: boolean;
  issues: A2uiValidationIssue[];
}

function validateProp(
  componentName: string,
  key: string,
  spec: A2uiPropSpec,
  value: unknown,
  path: string,
  surfaceId: string,
  iconNames: readonly string[]
): PropResult {
  const issues: A2uiValidationIssue[] = [];
  const mismatch = (detail: string): PropResult => {
    issues.push(issue('error', A2UI_ISSUE_CODES.TYPE_MISMATCH, detail, { surfaceId, path }));
    return { store: false, issues };
  };

  switch (spec.kind) {
    case 'string':
      if (spec.dynamic ? isDynamicString(value) : typeof value === 'string')
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(
        `"${key}" on ${componentName} must be a string${spec.dynamic ? ' or { path } binding' : ''}`
      );

    case 'number':
      if (
        spec.dynamic ? isDynamicNumber(value) : typeof value === 'number' && Number.isFinite(value)
      )
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(
        `"${key}" on ${componentName} must be a finite number${spec.dynamic ? ' or { path } binding' : ''}`
      );

    case 'boolean':
      if (spec.dynamic ? isDynamicBoolean(value) : typeof value === 'boolean')
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(
        `"${key}" on ${componentName} must be a boolean${spec.dynamic ? ' or { path } binding' : ''}`
      );

    case 'stringList':
      if (isDynamicStringList(value))
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      return mismatch(`"${key}" on ${componentName} must be a string array or { path } binding`);

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
      return validateAction(componentName, key, value, path, surfaceId);

    case 'options':
      // A dynamic options prop may be a { path } binding to a list the agent
      // fetched — the shape is checked when it resolves (see collectGraphIssues),
      // because at envelope time the data model may not carry it yet.
      if (spec.dynamic && isDynamicRef(value)) {
        return { store: true, issues: dynamicRefIssues(value, path, surfaceId) };
      }
      return validateOptions(componentName, key, value, path, surfaceId, spec.dynamic);

    case 'icon':
      return validateIcon(value, path, surfaceId, iconNames);

    case 'accessibility':
      if (isPlainObject(value)) return { store: true, issues };
      return mismatch(`"${key}" on ${componentName} must be an object { label?, description? }`);
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

function validateAction(
  componentName: string,
  key: string,
  value: unknown,
  path: string,
  surfaceId: string
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
      for (const contextKey of Object.keys(event.context)) {
        if (PROTO_KEYS.has(contextKey)) {
          issues.push(
            issue(
              'error',
              A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
              `Prohibited action context key "${contextKey}" on ${componentName}`,
              { surfaceId, path: `${path}/event/context/${contextKey}` }
            )
          );
        }
      }
    }
    // Store even with a context-key error: the renderer builds context on a
    // null-prototype object, so the flagged key is inert. The error still relays.
    return { store: issues.every((i) => i.code !== A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION), issues };
  }
  if (isPlainObject(value.functionCall)) {
    if (typeof value.functionCall.call === 'string') return { store: true, issues };
    issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.MISSING_FIELD,
        `action.functionCall.call is required on ${componentName}`,
        {
          surfaceId,
          path: `${path}/functionCall/call`
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
        dynamic ? ' or a { path } binding to one' : ''
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
    if (typeof value.path === 'string')
      return { store: true, issues: dynamicRefIssues(value, path, surfaceId) }; // dynamic binding
  }
  return {
    store: false,
    issues: [
      issue(
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        'Icon name must be a mapped name, { svgPath } or { path }',
        { surfaceId, path }
      )
    ]
  };
}

// ── Component validation ─────────────────────────────────────────────────────

function validateComponent(
  surface: A2uiSurfaceState,
  raw: unknown,
  envelopeIndex: number,
  compIndex: number,
  idsSeen: Set<string>
): void {
  const base = `/messages/${envelopeIndex}/updateComponents/components/${compIndex}`;
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
  if (idsSeen.has(id)) {
    surface.issues.push(
      issue(
        'error',
        A2UI_ISSUE_CODES.DUPLICATE_ID,
        `Duplicate component id "${id}" in one updateComponents (last wins)`,
        {
          surfaceId,
          path: `${base}/id`
        }
      )
    );
  }
  idsSeen.add(id);

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
    surface.components.set(id, { id, component: '', props: new Map(), sourceIndex: envelopeIndex });
    return;
  }

  const catalog = surface.catalog;
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
    surface.components.set(id, {
      id,
      component: componentName,
      props: new Map(),
      sourceIndex: envelopeIndex
    });
    return;
  }

  const props = new Map<string, unknown>();
  for (const key of Object.keys(comp)) {
    if (key === 'id' || key === 'component') continue;
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
    if (catalog.ignoredProps.has(key)) {
      surface.issues.push(
        issue(
          'warning',
          A2UI_ISSUE_CODES.IGNORED_PROP,
          `Property "${key}" on ${componentName} is not supported and is ignored`,
          {
            surfaceId,
            path: `${base}/${key}`
          }
        )
      );
      continue;
    }
    const propSpec = ownEntry(spec.props, key);
    if (!propSpec) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_PROP,
          `Unknown property "${key}" on ${componentName}`,
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
      catalog.iconNames
    );
    for (const propIssue of result.issues) surface.issues.push(propIssue);
    if (result.store) props.set(key, comp[key]);
  }

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
  // stays free of catalog-specific branches. Message strings and issue paths are
  // byte-identical to the pre-refactor hardcoded blocks.
  const check = ownEntry(catalog.componentChecks, componentName);
  if (check) {
    for (const checkIssue of check({ id, props, surfaceId, base })) surface.issues.push(checkIssue);
  }

  surface.components.set(id, { id, component: componentName, props, sourceIndex: envelopeIndex });
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
  'theme',
  'sendDataModel'
]);
const UPDATE_COMPONENTS_KEYS: ReadonlySet<string> = new Set(['surfaceId', 'components']);
const UPDATE_DATA_MODEL_KEYS: ReadonlySet<string> = new Set(['surfaceId', 'path', 'value']);
const DELETE_SURFACE_KEYS: ReadonlySet<string> = new Set(['surfaceId']);

function createProcessor(
  catalogs: readonly A2uiCatalogSpec[],
  dataSchema: A2uiDataSchema | undefined
): A2uiProcessor {
  const surfaces = new Map<string, A2uiSurfaceState>();
  const globalIssues: A2uiValidationIssue[] = [];
  const defaultCatalog = catalogs[0];

  function handleCreateSurface(env: Record<string, unknown>, base: string): void {
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
    const surface: A2uiSurfaceState = {
      surfaceId,
      components: new Map(),
      dataModel: undefined,
      issues: [],
      catalog: defaultCatalog,
      sendDataModel: false
    };
    surfaces.set(surfaceId, surface);

    if (typeof cs.catalogId !== 'string') {
      surface.issues.push(
        issue('error', A2UI_ISSUE_CODES.MISSING_FIELD, 'createSurface.catalogId is required', {
          surfaceId,
          path: `${base}/createSurface/catalogId`
        })
      );
    } else {
      const resolved = resolveCatalog(catalogs, cs.catalogId);
      if (resolved) {
        surface.catalog = resolved;
      } else if (catalogs.length >= 2) {
        // Only a multi-catalog processor can meaningfully reject an id; a single
        // catalog accepts any string (back-compat) and uses the default silently.
        surface.issues.push(
          issue(
            'warning',
            A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
            `Unknown catalogId "${cs.catalogId}"; falling back to "${defaultCatalog.catalogId}"`,
            { surfaceId, path: `${base}/createSurface/catalogId` }
          )
        );
      }
    }
    if ('theme' in cs) {
      surface.issues.push(
        issue('warning', A2UI_ISSUE_CODES.SURFACE_PROP_IGNORED, 'theme is ignored', {
          surfaceId,
          path: `${base}/createSurface/theme`
        })
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
    flagExtraKeys(
      cs,
      CREATE_SURFACE_KEYS,
      surface.issues,
      surfaceId,
      `${base}/createSurface`,
      'createSurface'
    );
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

    const components = uc.components;
    if (!Array.isArray(components) || components.length === 0) {
      surface.issues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.MISSING_FIELD,
          'updateComponents.components must be a non-empty array',
          {
            surfaceId,
            path: `${base}/updateComponents/components`
          }
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
          `updateComponents carries ${components.length} components; only the first ${MAX_COMPONENTS_PER_UPDATE} are processed`,
          { surfaceId, path: `${base}/updateComponents/components` }
        )
      );
      limit = MAX_COMPONENTS_PER_UPDATE;
    }
    const idsSeen = new Set<string>();
    for (let i = 0; i < limit; i++) {
      validateComponent(surface, components[i], index, i, idsSeen);
    }
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
    const hasValue = 'value' in udm;

    // Schema validation (opt-in): a type mismatch on a declared pointer is an
    // error, a write to an undeclared top-level branch a warning — both relayed
    // to the agent. Runs on the raw written value before it enters the model.
    if (dataSchema) {
      const schemaIssues = validateSchemaWrite(
        dataSchema,
        pathValue,
        hasValue ? udm.value : undefined,
        surfaceId
      );
      for (const schemaIssue of schemaIssues) surface.issues.push(schemaIssue);
    }

    const whole = pathValue === undefined || pathValue === '' || pathValue === '/';

    if (whole) {
      surface.dataModel = hasValue ? cloneData(udm.value) : undefined;
      return;
    }

    const pointer = pathValue as string;
    if (!isContainer(surface.dataModel)) {
      const firstSegment = pointer.replace(/^\//, '').split('/')[0];
      surface.dataModel = /^(?:0|[1-9]\d*|-)$/.test(firstSegment) ? [] : {};
    }
    if (hasValue) {
      const { issue: setIssue } = setAtPointer(surface.dataModel, pointer, cloneData(udm.value));
      if (setIssue) surface.issues.push({ ...setIssue, surfaceId });
    } else {
      deleteAtPointer(surface.dataModel, pointer);
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

    if (typeof env.version !== 'string' || !A2UI_SUPPORTED_VERSIONS.includes(env.version)) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.INVALID_VERSION,
          `Unsupported envelope version (expected one of: ${A2UI_SUPPORTED_VERSIONS.join(', ')})`,
          {
            path: `${base}/version`
          }
        )
      );
      return;
    }

    const present = OP_KEYS.filter((key) => key in env);
    if (present.length !== 1) {
      globalIssues.push(
        issue(
          'error',
          A2UI_ISSUE_CODES.UNKNOWN_ENVELOPE_TYPE,
          `Envelope must contain exactly one of: ${OP_KEYS.join(', ')} (found ${present.length})`,
          { path: base }
        )
      );
      return;
    }

    const allowedTop: ReadonlySet<string> = new Set(['version', present[0]]);
    flagExtraKeys(env, allowedTop, globalIssues, undefined, base, 'envelope');

    switch (present[0]) {
      case 'createSurface':
        handleCreateSurface(env, base);
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
    }
  }

  return { surfaces, globalIssues, apply };
}

export function createA2uiProcessor(options?: A2uiProcessorOptions): A2uiProcessor {
  const catalogs = options?.catalogs?.length ? options.catalogs : [basicA2uiCatalogSpec];
  return createProcessor(catalogs, options?.dataSchema);
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
 * Walk the component graph from `root` and collect structural faults that only
 * exist once components are assembled: cycles, excessive depth/nodes, dangling
 * child references, non-array template paths, and mis-placed `weight`.
 *
 * NOTE — contract extension. The design's published `a2ui-validate.ts` surface
 * is `createA2uiProcessor` + `normalizeA2uiPayload`. This function is an
 * additive export (no existing signature changed): the renderer (WP-B) needs
 * render-time graph faults whose severity depends on the `streaming` flag, and
 * the test suite exercises them here. Traversal is bounded by `maxNodes` so a
 * template over a huge array cannot DoS the walk itself.
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
  let nodeCount = 0;
  let overflowReported = false;
  let aborted = false;

  // Child references are discovered by prop KIND (childId / childList) from the
  // surface catalog's registry, not by fixed `child`/`children` names — so a
  // catalog may name its child slots freely. Behaviour is unchanged for Basic,
  // whose only child props ARE `child`/`children`.
  const registry = surface.catalog.registry;
  const childTargets = (
    comp: A2uiComponentInstance,
    scopePrefix: string | undefined
  ): Array<{ id: string; scope: string | undefined }> => {
    const out: Array<{ id: string; scope: string | undefined }> = [];
    const spec = ownEntry(registry, comp.component);
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
          for (const childId of children)
            if (typeof childId === 'string') out.push({ id: childId, scope: scopePrefix });
        } else if (children && typeof children === 'object') {
          const template = children as { componentId?: unknown; path?: unknown };
          if (typeof template.componentId === 'string' && typeof template.path === 'string') {
            const absPath = template.path.startsWith('/')
              ? template.path
              : `${scopePrefix ?? ''}/${template.path}`;
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

  const visit = (
    id: string,
    depth: number,
    stack: Set<string>,
    parentComponent: string | null,
    scopePrefix: string | undefined
  ): void => {
    if (aborted) return;
    nodeCount++;
    if (nodeCount > maxNodes) {
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
      return;
    }
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

    // A bound `options` list is only checkable once it resolves — the envelope
    // validator saw a { path }, not a list. Silent while the path is still
    // undefined (the agent fills it in with a later updateDataModel); a warning
    // once it holds something that is not an option list, because the control
    // then renders empty and the user is stuck with no way to choose.
    for (const [key, propSpec] of Object.entries(ownEntry(registry, comp.component)?.props ?? {})) {
      if (propSpec.kind !== 'options' || !propSpec.dynamic) continue;
      const bound = comp.props.get(key);
      if (!isPlainObject(bound) || typeof bound.path !== 'string') continue;
      // Same absolute/relative rule as a childList template path.
      const pointer = bound.path.startsWith('/')
        ? bound.path
        : `${scopePrefix ?? ''}/${bound.path}`;
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

    if (comp.props.has('weight') && !surface.catalog.flexContainers.has(parentComponent ?? '')) {
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
        issues.push(
          issue('error', A2UI_ISSUE_CODES.CYCLE, `Cycle detected at component "${target.id}"`, {
            surfaceId
          })
        );
        continue;
      }
      visit(target.id, depth + 1, nextStack, comp.component, target.scope);
    }
  };

  visit('root', 0, new Set(), null, undefined);
  return issues;
}
