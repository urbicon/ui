/**
 * Public type contracts for the A2UI engine (AI-Kit P4).
 *
 * A2UI is Google/A2UI-project's "Agent to UI" protocol. This engine targets the
 * **v0.9.1 `basic` catalog**, rendering a curated 12-component subset (see
 * `a2ui-registry.ts`). These types are the boundary between the pure-TS engine
 * (WP-A) and the Svelte renderer (WP-B) — keep them Svelte-free.
 *
 * The `A2uiValidationIssue` shape is deliberately spec-compatible with the A2UI
 * client→server `error` message (`{ code, surfaceId?, path?, message }`) so a
 * consumer can relay error-severity issues back to the agent verbatim as a
 * `VALIDATION_FAILED` error. `severity` is our addition, so warnings and errors
 * travel on one channel; the consumer filters.
 */

/**
 * A single Server→Client envelope. Structurally validated at runtime, never
 * type-enforced — the wire payload is untrusted, so the engine treats every
 * envelope as an opaque record and validates field-by-field.
 */
export type A2uiEnvelope = Record<string, unknown>;

/**
 * A resolved user action, spec-exact for the A2UI client→server `action`
 * message. All five fields are required; `context` bindings are resolved
 * against the data model in the source component's scope before dispatch.
 */
export interface A2uiActionEvent {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  /** ISO 8601 timestamp (`new Date().toISOString()`). */
  timestamp: string;
  context: Record<string, unknown>;
}

/** Severity of a validation issue. `error` renders a fault chip; `warning` degrades. */
export type A2uiIssueSeverity = 'error' | 'warning';

/**
 * A validation finding. `code` is one of {@link A2UI_ISSUE_CODES} (a superset of
 * the spec's `VALIDATION_FAILED`); `path` is a JSON Pointer into the *payload*
 * (e.g. `/messages/3/updateComponents/components/0/text`) where determinable.
 */
export interface A2uiValidationIssue {
  severity: A2uiIssueSeverity;
  code: string;
  surfaceId?: string;
  path?: string;
  message: string;
}

/**
 * Canonical issue codes. Error-severity codes are relay-able to the agent as a
 * `VALIDATION_FAILED` A2UI error (the consumer maps `code`→detail, keeping
 * `message`/`path`/`surfaceId`).
 */
export const A2UI_ISSUE_CODES = {
  /** Envelope is not a plain object. */
  INVALID_ENVELOPE: 'INVALID_ENVELOPE',
  /** `version` missing or not `v0.9`/`v0.9.1`. */
  INVALID_VERSION: 'INVALID_VERSION',
  /** Envelope has none, or more than one, of the four operation keys. */
  UNKNOWN_ENVELOPE_TYPE: 'UNKNOWN_ENVELOPE_TYPE',
  /** A required field is missing or has the wrong primitive type. */
  MISSING_FIELD: 'MISSING_FIELD',
  /** `updateComponents`/`updateDataModel`/`deleteSurface` before `createSurface`. */
  NO_SURFACE: 'NO_SURFACE',
  /** `createSurface` for an id that already exists. */
  DUPLICATE_SURFACE: 'DUPLICATE_SURFACE',
  /** `component` is a string but not in any catalog. */
  UNKNOWN_COMPONENT: 'UNKNOWN_COMPONENT',
  /** A real catalog component outside the rendered subset (Modal, Tabs, …). */
  UNSUPPORTED_COMPONENT: 'UNSUPPORTED_COMPONENT',
  /** A prop not declared for the component (whitelist violation). */
  UNKNOWN_PROP: 'UNKNOWN_PROP',
  /** A recognized-but-ignored prop (`checks`, `validationRegexp`). */
  IGNORED_PROP: 'IGNORED_PROP',
  /** A prop value's shape does not match its declared kind. */
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  /** An enum prop value is outside the allowed set. */
  UNKNOWN_ENUM: 'UNKNOWN_ENUM',
  /** Two components share an id inside a single `updateComponents` list. */
  DUPLICATE_ID: 'DUPLICATE_ID',
  /** Two `ChoicePicker` options share a `value` — the second is dropped (values must be unique). */
  DUPLICATE_OPTION: 'DUPLICATE_OPTION',
  /** `DateTimeInput` with neither `enableDate` nor `enableTime` — rendered as a date input. */
  DATETIME_NO_MODE: 'DATETIME_NO_MODE',
  /** More surfaces than the engine renders at once — the extra `createSurface` is refused. */
  MAX_SURFACES: 'MAX_SURFACES',
  /** A single `updateComponents` exceeds the per-message component cap — the surplus is dropped. */
  MAX_COMPONENTS: 'MAX_COMPONENTS',
  /** A component object has no usable `id`. */
  MISSING_ID: 'MISSING_ID',
  /** `__proto__`/`constructor`/`prototype` as an id, prop, pointer or context key. */
  PROTOTYPE_POLLUTION: 'PROTOTYPE_POLLUTION',
  /** A JSON Pointer was malformed. */
  POINTER_ERROR: 'POINTER_ERROR',
  /** The component graph contains a cycle. */
  CYCLE: 'CYCLE',
  /** Tree depth exceeds the limit (default 32). */
  MAX_DEPTH: 'MAX_DEPTH',
  /** Rendered node count exceeds the limit (default 512). */
  MAX_NODES: 'MAX_NODES',
  /** A child id references a component that was never defined. */
  DANGLING_REF: 'DANGLING_REF',
  /** No `root` component after the stream ended. */
  MISSING_ROOT: 'MISSING_ROOT',
  /** A `children` template `path` resolved to a non-array, non-undefined value. */
  TEMPLATE_PATH_NOT_ARRAY: 'TEMPLATE_PATH_NOT_ARRAY',
  /** `weight` set on a component that is not a direct Row/Column child. */
  WEIGHT_CONTEXT: 'WEIGHT_CONTEXT',
  /** A `{ call, args }` function-call binding — unsupported, resolves to `undefined`. */
  FUNCTION_CALL_UNSUPPORTED: 'FUNCTION_CALL_UNSUPPORTED',
  /** An `Icon.name` string outside the mapped set — a fallback glyph is drawn. */
  ICON_UNMAPPED: 'ICON_UNMAPPED',
  /** An `Icon.name.svgPath` failed the path grammar guard. */
  ICON_INVALID_SVG: 'ICON_INVALID_SVG',
  /** `ChoicePicker` `displayStyle: 'chips'` / `filterable` — rendered with a fallback. */
  CHOICEPICKER_FALLBACK: 'CHOICEPICKER_FALLBACK',
  /** A `createSurface`-only prop (`theme`, `sendDataModel`) that the engine ignores. */
  SURFACE_PROP_IGNORED: 'SURFACE_PROP_IGNORED'
} as const;

export type A2uiIssueCode = (typeof A2UI_ISSUE_CODES)[keyof typeof A2UI_ISSUE_CODES];
