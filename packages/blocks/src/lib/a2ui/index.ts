/**
 * `@urbicon-ui/blocks/a2ui` — the A2UI engine without Svelte.
 *
 * Everything A2UI that a server, a tool handler or a test runner without the
 * Svelte compiler can import: the prompt and its sections, the catalog specs,
 * the processor and the validation `A2UIView` runs, the transport halves
 * (stream splitter, surface router) and the types. The package root loads
 * Svelte modules on import, so a runtime that does not compile them (plain Bun
 * or Node) fails there before reaching any of this.
 *
 * The renderable halves stay on the root: `A2UIView`, the wired catalogs
 * `basicA2uiCatalog` / `urbiconA2uiCatalog` and their `A2uiCatalog` type. The
 * root re-exports this entry whole, so the two cannot list different engines.
 * Nothing here may import a `.svelte` file or a runes module.
 *
 * @example
 * ```ts
 * import {
 *   a2uiFencedTransportSection,
 *   a2uiSystemPrompt,
 *   validateA2uiPayload
 * } from '@urbicon-ui/blocks/a2ui';
 * ```
 */

export {
  A2UI_ISSUE_CODES,
  type A2uiActionEvent,
  type A2uiEnvelope,
  type A2uiIssueCode,
  type A2uiIssueSeverity,
  type A2uiValidationIssue
} from '../components/Chat/A2UIView/a2ui.types';
// ── Catalog abstraction (the seam for a second, custom catalog) ──────────────
export {
  type A2uiCatalogSpec,
  type A2uiComponentCheck,
  type A2uiComponentCheckContext,
  basicA2uiCatalogSpec,
  resolveCatalog
} from '../components/Chat/A2UIView/a2ui-catalog';
export { a2uiSystemPrompt } from '../components/Chat/A2UIView/a2ui-prompt';
export {
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_REGISTRY,
  A2UI_SUPPORTED_VERSIONS,
  type A2uiComponentSpec,
  type A2uiPropKind,
  type A2uiPropSpec,
  UNSUPPORTED_A2UI_COMPONENTS
} from '../components/Chat/A2UIView/a2ui-registry';
export {
  type A2uiRequiredComponent,
  type A2uiSurfaceRequirement,
  type A2uiSurfaceRequirements,
  a2uiSurfaceRequirementsSection
} from '../components/Chat/A2UIView/a2ui-requirements';
// ── Cross-message surface routing (keeps a surface patchable after its turn) ──
export {
  type A2uiRoutePatch,
  type A2uiRouteResult,
  A2uiSurfaceRouter
} from '../components/Chat/A2UIView/a2ui-router';
export {
  type A2uiDataSchema,
  type A2uiSchemaField,
  type A2uiSchemaType,
  a2uiDataSchemaSection,
  validateSchemaWrite
} from '../components/Chat/A2UIView/a2ui-schema';
// ── Fenced-JSONL transport: the token-stream parser and the prompt that feeds it ──
export {
  A2UI_FENCE_TAG,
  type A2uiStreamIssue,
  type A2uiStreamPart,
  A2uiStreamSplitter,
  type A2uiStreamTextPart,
  type A2uiStreamUiPart,
  type A2uiTransportSectionOptions,
  a2uiActionMessage,
  a2uiErrorMessage,
  a2uiFencedTransportSection
} from '../components/Chat/A2UIView/a2ui-stream';
// ── Transcript wiring: deliver routed envelopes into the messages that own them ─
export {
  editA2uiPayload,
  type PatchedSurface,
  type RouteMessageResult,
  revokeMessage,
  routeMessageParts,
  sourceKey
} from '../components/Chat/A2UIView/a2ui-transcript';
export {
  type A2uiComponentInstance,
  type A2uiPayloadValidationOptions,
  type A2uiProcessor,
  type A2uiProcessorOptions,
  type A2uiSurfaceState,
  collectGraphIssues,
  createA2uiProcessor,
  normalizeA2uiPayload,
  validateA2uiPayload
} from '../components/Chat/A2UIView/a2ui-validate';
// ── Urbicon-native catalog, spec half (the wired one is on the package root) ──
export {
  SHARED_AXES,
  UNSUPPORTED_URBICON_A2UI_COMPONENTS,
  URBICON_A2UI_CATALOG_ID,
  URBICON_A2UI_ICON_NAMES,
  URBICON_A2UI_REGISTRY,
  type UrbiconComponentSpec,
  type UrbiconPropSpec,
  urbiconA2uiCatalogSpec
} from '../components/Chat/A2UIView/urbicon/a2ui-urbicon-registry';
