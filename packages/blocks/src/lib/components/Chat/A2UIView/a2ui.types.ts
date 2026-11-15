/**
 * Public type contracts for the A2UI engine.
 *
 * A2UI is the A2UI project's "Agent to UI" protocol. This engine speaks
 * **protocol 1.0** and renders a curated subset of the `basic` catalog (see
 * `a2ui-registry.ts`). These types are the boundary between the pure-TS engine
 * and the Svelte renderer — keep them Svelte-free.
 *
 * The `A2uiValidationIssue` shape is deliberately spec-compatible with the A2UI
 * renderer→agent `error` message (`{ code, message, surfaceId?, path? }`, or
 * `functionCallId` in place of `surfaceId`) so a consumer can relay
 * error-severity issues back to the agent verbatim as a `VALIDATION_FAILED`
 * error. `severity` is our addition, so warnings and errors travel on one
 * channel; the consumer filters.
 */

/**
 * A single agent→renderer envelope. Structurally validated at runtime, never
 * type-enforced — the wire payload is untrusted, so the engine treats every
 * envelope as an opaque record and validates field-by-field.
 */
export type A2uiEnvelope = Record<string, unknown>;

/**
 * A resolved user action, spec-exact for the body of the A2UI renderer→agent
 * `action` message. `context` bindings are resolved against the data model in
 * the source component's scope before dispatch.
 */
export interface A2uiActionEvent {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  /** ISO 8601 timestamp (`new Date().toISOString()`). */
  timestamp: string;
  context: Record<string, unknown>;
  /**
   * What the user did, in the agent's own words — `action.event.userMessage`,
   * resolved at click time. Present only when the action carried one and it
   * resolved to a string.
   */
  userMessage?: string;
  /**
   * The surface's complete data model — present only when the surface was
   * created with `sendDataModel: true`.
   *
   * The spec calls this the renderer data model and has the renderer append it
   * to the metadata of every message sent to the agent, but leaves WHERE
   * metadata travels to the transport binding (A2A `metadata`, HTTP headers, …).
   * This field is that payload; put it wherever your transport carries metadata.
   *
   * It is the antidote to a half-filled `context`: the agent sees everything the
   * user entered, including fields it forgot to list on the action.
   */
  dataModel?: unknown;
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
  /** The call an `INVALID_FUNCTION_CALL` issue answers; never set together with `surfaceId`. */
  functionCallId?: string;
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
  /** `version` missing or not `"1.0"`. */
  INVALID_VERSION: 'INVALID_VERSION',
  /** Envelope has none, or more than one, of the six message keys. */
  UNKNOWN_ENVELOPE_TYPE: 'UNKNOWN_ENVELOPE_TYPE',
  /** A required field is missing or has the wrong primitive type. */
  MISSING_FIELD: 'MISSING_FIELD',
  /** `updateComponents`/`updateDataModel`/`deleteSurface` before `createSurface`. */
  NO_SURFACE: 'NO_SURFACE',
  /** `createSurface` for an id that already exists. */
  DUPLICATE_SURFACE: 'DUPLICATE_SURFACE',
  /** `component` is a string its catalog does not know. */
  UNKNOWN_COMPONENT: 'UNKNOWN_COMPONENT',
  /** A real catalog component outside the rendered subset (Modal, Video, …). */
  UNSUPPORTED_COMPONENT: 'UNSUPPORTED_COMPONENT',
  /** A prop not declared for the component (whitelist violation). */
  UNKNOWN_PROP: 'UNKNOWN_PROP',
  /** `@checks` on a component none of whose gates reads it. */
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
  /** `Tabs` with an empty `tabs` array (the spec requires at least one) — nothing renders. */
  TABS_EMPTY: 'TABS_EMPTY',
  /** More surfaces than the engine renders at once — the extra `createSurface` is refused. */
  MAX_SURFACES: 'MAX_SURFACES',
  /** A single `updateComponents` exceeds the per-message component cap — the surplus is dropped. */
  MAX_COMPONENTS: 'MAX_COMPONENTS',
  /** A component object has no usable `id`. */
  MISSING_ID: 'MISSING_ID',
  /**
   * A component `id` that is not an identifier (UAX #31: a letter or `_`, then
   * letters, digits and `_`) — `user-card` and `1st` are not. The component is
   * kept under that id, so the surface renders while the agent renames it.
   */
  INVALID_ID: 'INVALID_ID',
  /**
   * A key with a single leading `@` that names no protocol directive — on a
   * component, anything but `@catalogId`, `@accessibility`, `@checks` and
   * `@metadata`; in a literal object, anything at all (a literal `@` key is
   * written doubled: `"@@type"`).
   */
  INVALID_RESERVED_KEY: 'INVALID_RESERVED_KEY',
  /** `__proto__`/`constructor`/`prototype` as an id, prop, pointer or context key. */
  PROTOTYPE_POLLUTION: 'PROTOTYPE_POLLUTION',
  /**
   * The engine itself threw while processing an envelope — always a bug in the
   * engine, never a property of the payload. The surviving surfaces still render
   * and the failure is reported here rather than taking the whole view down with
   * it (#134). Never expected in a green suite: a hostile payload is supposed to
   * become issues, not exceptions.
   */
  ENGINE_ERROR: 'ENGINE_ERROR',
  /**
   * A JSON Pointer is malformed — a `~` not followed by `0` or `1`, a write path
   * that is neither `""` nor starts with `/` — or a write addresses an array
   * index past the array's length (`-` appends). The write is not applied.
   */
  POINTER_ERROR: 'POINTER_ERROR',
  /** The component graph contains a cycle; reported once per referencing edge. */
  CYCLE: 'CYCLE',
  /**
   * Tree depth exceeds the limit (default 32), or data would nest deeper than
   * the 64 levels a data model may: a write, which is not applied; a binding of
   * more pointer segments, its template scope included, which resolves to
   * nothing; an action's context literal, which drops the action.
   */
  MAX_DEPTH: 'MAX_DEPTH',
  /** Rendered node count exceeds the limit (default 512). */
  MAX_NODES: 'MAX_NODES',
  /** A child id references a component that was never defined. */
  DANGLING_REF: 'DANGLING_REF',
  /** No `root` component after the stream ended. */
  MISSING_ROOT: 'MISSING_ROOT',
  /** A `children` template `path` resolved to a non-array, non-undefined value. */
  TEMPLATE_PATH_NOT_ARRAY: 'TEMPLATE_PATH_NOT_ARRAY',
  /**
   * `@index` on a component that renders outside a list template, where there
   * is no item to count — it resolves to nothing.
   */
  INDEX_OUTSIDE_TEMPLATE: 'INDEX_OUTSIDE_TEMPLATE',
  /** `weight` set on a component that is not a direct Row/Column child. */
  WEIGHT_CONTEXT: 'WEIGHT_CONTEXT',
  /**
   * A `{ "@call", args }` function call other than the logic functions `not`,
   * `and`, `or` and the system function `@index` — unsupported. A warning where
   * it resolves to `undefined`; an error on a gate (`Button.disabled`), which
   * then holds its failsafe.
   */
  FUNCTION_CALL_UNSUPPORTED: 'FUNCTION_CALL_UNSUPPORTED',
  /** An `Icon.name` string outside the mapped set — a fallback glyph is drawn. */
  ICON_UNMAPPED: 'ICON_UNMAPPED',
  /** An `Icon.name.svgPath` failed the path grammar guard. */
  ICON_INVALID_SVG: 'ICON_INVALID_SVG',
  /** `ChoicePicker` `displayStyle: 'chips'` / `filterable` — rendered with a fallback. */
  CHOICEPICKER_FALLBACK: 'CHOICEPICKER_FALLBACK',
  /**
   * `createSurface.catalogId`, a component's `@catalogId` or a function call's
   * `catalogId` names no configured catalog. Nothing falls back: the component
   * renders as a fault chip, the call is not evaluated.
   */
  UNKNOWN_CATALOG: 'UNKNOWN_CATALOG',
  /**
   * `callRendererFunction` or `agentFunctionResponse`. No function of this
   * renderer may be called by the agent, and it calls none on the agent, so
   * the first is refused and the second answers nothing. Carries the
   * `functionCallId`.
   */
  INVALID_FUNCTION_CALL: 'INVALID_FUNCTION_CALL',
  /**
   * A `Text` value looks like it carries Markdown, but `Text` renders PLAIN.
   * A heuristic warning steering the agent to `RichText` (Urbicon catalog).
   */
  MARKDOWN_IN_TEXT: 'MARKDOWN_IN_TEXT',
  /**
   * An `updateDataModel` write's value type contradicts the surface data
   * schema's declared type at that pointer (opt-in `dataSchema`).
   */
  SCHEMA_TYPE_MISMATCH: 'SCHEMA_TYPE_MISMATCH',
  /**
   * An `updateDataModel` write targets a top-level path the surface data schema
   * does not declare (opt-in `dataSchema`; warning).
   */
  SCHEMA_UNDECLARED_PATH: 'SCHEMA_UNDECLARED_PATH',
  /**
   * `createSurface` re-used a surfaceId that another source (an earlier chat
   * message) already owns. The spec requires a surfaceId to be unique for the
   * renderer's lifetime, so this is a protocol violation the agent should hear
   * about; {@link A2uiSurfaceRouter} still transfers ownership to the newest
   * source so the fresh surface renders (last writer wins). Router-only —
   * a single processor reports the same case as `DUPLICATE_SURFACE`.
   */
  SURFACE_RECREATED: 'SURFACE_RECREATED',
  /**
   * An `options` `{ "@path" }` binding resolved to a value that is not an **array**
   * — the control renders empty. The check is `Array.isArray` and nothing more:
   * an array whose items are not `{ label, value }` passes here and surfaces in
   * the renderer instead. Not emitted while the path is still `undefined`: the
   * agent is expected to fill it in with a later `updateDataModel`, and an empty
   * chooser mid-flow is normal.
   */
  OPTIONS_NOT_A_LIST: 'OPTIONS_NOT_A_LIST',
  /**
   * A component the consumer requires on this surface (`surfaceRequirements`,
   * keyed by surfaceId) is not reachable from `root`, or renders only as a
   * fault chip — also when the surface's default catalog cannot hold it, and
   * then the message names a catalog that can. An error,
   * so it travels the channel that is relayed to the agent, which patches the
   * surface. Only reported once the surface has
   * settled (`streaming: false`): a surface arrives over several envelopes, and
   * mid-stream every requirement would read as missing.
   */
  MISSING_REQUIRED_COMPONENT: 'MISSING_REQUIRED_COMPONENT',
  /**
   * A `surfaceRequirements` entry that no catalog the processor holds can ever
   * meet — an unknown component, an undeclared prop or one that takes no
   * `{ "@path" }`, a relative path. The consumer's mistake, not the agent's (which
   * catalog the agent picks cannot cause it), so it is a warning (logged, not
   * relayed by the documented wiring),
   * reported once at `createSurface`, and the entry is left unchecked: the agent
   * is never asked for what it cannot build.
   */
  INVALID_REQUIREMENT: 'INVALID_REQUIREMENT'
} as const;

export type A2uiIssueCode = (typeof A2UI_ISSUE_CODES)[keyof typeof A2UI_ISSUE_CODES];
