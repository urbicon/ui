import type { HTMLAttributes } from 'svelte/elements';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { A2uiActionEvent, A2uiValidationIssue } from './a2ui.types';
import type { A2uiCatalog } from './a2ui-catalog';
import type { A2uiDataSchema } from './a2ui-schema';
import type { A2UIViewSlots } from './a2ui-view.variants';

/**
 * @summary Turns a model's UI description into live components — the agent proposes, your design system renders.
 * @description Renders a trusted-catalog A2UI (Agent-to-UI, v0.9.1 `basic`
 * subset) payload into live, interactive Urbicon components. Fail-loud and
 * whitelist-only: only the mapped catalog components and their declared props
 * ever reach the DOM — unknown components/props, prototype-pollution keys and
 * function-call bindings are rejected, never rendered, and surfaced through
 * `onValidationError` (spec-compatible issues a consumer can relay to the agent
 * as a `VALIDATION_FAILED` error). Inputs are two-way (typing writes into the
 * local data model; bound text updates live); actions dispatch a spec-exact
 * `A2uiActionEvent`. Images and links are gated by the same strict-by-default
 * `urlPolicy` as StreamingMarkdown. It is deliberately NOT a default ChatMessage
 * renderer — wire it in per surface via `partRenderers.a2ui` to keep it out of
 * the base bundle. Generate the agent-side prompt with the shipped
 * `a2uiSystemPrompt()`; validate a payload without a DOM with
 * `createA2uiProcessor()` — never hand-roll either. Opt into the richer
 * Urbicon-native catalog (real intents/variants, Section, RichText, Accordion)
 * by passing `catalogs={[urbiconA2uiCatalog]}` (tree-shaken out otherwise), and
 * type-check the data model with an optional `dataSchema`. One view owns the
 * surfaces of ONE payload; to let an agent patch a surface it sent in an earlier
 * chat turn (multi-step forms), route the later envelopes into that payload with
 * `A2uiSurfaceRouter` — never give a second view the same surfaceId.
 * @tag ai
 * @related ChatMessage
 * @stability experimental
 *
 * @example Wire it in as the `a2ui` part renderer (via `partRenderers`, which
 * ChatMessage/ChatMessageList forward to each part — a plain `a2ui` snippet on
 * `<ChatMessage>` is NOT consumed)
 * ```svelte
 * {#snippet a2uiPart(part)}
 *   <A2UIView
 *     payload={part.payload}
 *     streaming={message.status === 'streaming'}
 *     {urlPolicy}
 *     onAction={(event) => sendUserTurn(`[ui-action] ${JSON.stringify(event)}`)}
 *     onValidationError={(issues) => reportToAgent(issues)}
 *   />
 * {/snippet}
 * <ChatMessage {message} {urlPolicy} partRenderers={{ a2ui: a2uiPart }} />
 * ```
 *
 * @example Standalone with an accumulated envelope array
 * ```svelte
 * <A2UIView payload={envelopes} onAction={(e) => console.log(e)} />
 * ```
 */
export interface A2UIViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
  /**
   * The A2UI payload. Accepts an array of envelopes (the accumulated JSONL
   * sequence — stream by extending it immutably: `[...prev, envelope]`), a
   * single envelope object, or the golden-file `{ messages: [...] }` wrapper.
   */
  payload: unknown;
  /**
   * While true, a reference to a not-yet-defined component renders a placeholder
   * instead of a fault chip (mid-stream tolerance). Flip to false when the
   * stream settles so dangling references become errors. @default false
   * @summary Whether a reference to a component that has not arrived yet is tolerated or an error.
   */
  streaming?: boolean;
  /**
   * URL policy for `Image` sources (and Text markdown links). Strict by default:
   * every external image is blocked unless its prefix is allowlisted. Keep the
   * object referentially stable.
   */
  urlPolicy?: MarkdownUrlPolicy;
  /** Fired when a Button is activated, with the spec-exact resolved action event. */
  onAction?: (event: A2uiActionEvent) => void;
  /**
   * Fired whenever the validation-issue list changes (errors AND warnings, each
   * with a `severity`). Relay error-severity issues to the agent as an A2UI
   * `error` message.
   */
  onValidationError?: (issues: A2uiValidationIssue[]) => void;
  /** Title of the top-level error Alert for envelope-level faults. @default 'Invalid UI payload' */
  errorTitle?: string;
  /** Fault-chip label for an unknown/unsupported/incomplete component. @default 'Unsupported component' */
  unsupportedLabel?: string;
  /** Chip label shown in place of a policy-blocked image. @default 'Image blocked' */
  blockedImageLabel?: string;
  /** Screen-reader label of the streaming placeholder. @default 'Loading UI' */
  pendingLabel?: string;
  /**
   * Additional A2UI catalogs this view can render, beyond the always-present
   * Basic catalog (which is prepended automatically as the default/fallback). A
   * surface renders through the catalog whose id its `createSurface.catalogId`
   * names. Pass the shipped `urbiconA2uiCatalog` to enable the Urbicon-native
   * catalog. Resolved once at init (icon setup reads context) — keep it
   * referentially stable.
   */
  catalogs?: readonly A2uiCatalog[];
  /**
   * Optional surface data schema. When set, every `updateDataModel` write is
   * validated against it (type mismatch on a declared pointer → error;
   * undeclared top-level branch → warning), reported via `onValidationError`.
   * Document the same schema to the agent with `a2uiDataSchemaSection`. Keep it
   * referentially stable.
   */
  dataSchema?: A2uiDataSchema;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Strip the component's default tv() classes. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides. Slots: `root`, `surface`, `errorList`,
   * `errorChip`, `errorIcon`, `pending`, `column`, `row`, `list`, `listItem`,
   * `heading`, `caption`, `inlineText`, `image`, `blockedChip`, `icon`,
   * `svgIcon`, `choiceGroup`, `choiceLabel`.
   */
  slotClasses?: Partial<Record<A2UIViewSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ A2UIView: {...} }}>`.
   * Prefer this over `class` overrides for reusable custom looks.
   */
  preset?: string;
}

export { default as A2UIView } from './A2UIView.svelte';
// ── Engine surface (Svelte-free; a server building the prompt has no DOM) ────
export {
  A2UI_ISSUE_CODES,
  type A2uiActionEvent,
  type A2uiEnvelope,
  type A2uiIssueCode,
  type A2uiIssueSeverity,
  type A2uiValidationIssue
} from './a2ui.types';
export { basicA2uiCatalog } from './a2ui-basic-catalog';
// ── Catalog abstraction (the seam for a second, custom catalog) ──────────────
export {
  type A2uiCatalog,
  type A2uiCatalogSpec,
  type A2uiComponentCheck,
  type A2uiComponentCheckContext,
  basicA2uiCatalogSpec,
  resolveCatalog
} from './a2ui-catalog';
export { a2uiSystemPrompt } from './a2ui-prompt';
export {
  A2UI_CATALOG_ID,
  A2UI_ICON_NAMES,
  A2UI_REGISTRY,
  A2UI_SUPPORTED_VERSIONS,
  type A2uiComponentSpec,
  type A2uiPropKind,
  type A2uiPropSpec,
  UNSUPPORTED_A2UI_COMPONENTS
} from './a2ui-registry';
// ── Cross-message surface routing (keeps a surface patchable after its turn) ──
export {
  type A2uiRoutePatch,
  type A2uiRouteResult,
  A2uiSurfaceRouter
} from './a2ui-router';
export {
  type A2uiDataSchema,
  type A2uiSchemaField,
  type A2uiSchemaType,
  a2uiDataSchemaSection,
  validateSchemaWrite
} from './a2ui-schema';
// ── Fenced-JSONL transport: the token-stream parser and the prompt that feeds it ──
export {
  A2UI_FENCE_TAG,
  type A2uiStreamIssue,
  type A2uiStreamPart,
  A2uiStreamSplitter,
  type A2uiStreamTextPart,
  type A2uiStreamUiPart,
  type A2uiTransportSectionOptions,
  a2uiFencedTransportSection
} from './a2ui-stream';
// ── Transcript wiring: deliver routed envelopes into the messages that own them ─
export {
  editA2uiPayload,
  type PatchedSurface,
  type RouteMessageResult,
  revokeMessage,
  routeMessageParts,
  sourceKey
} from './a2ui-transcript';
export {
  type A2uiComponentInstance,
  type A2uiProcessor,
  type A2uiProcessorOptions,
  type A2uiSurfaceState,
  collectGraphIssues,
  createA2uiProcessor,
  normalizeA2uiPayload
} from './a2ui-validate';
export {
  type A2UIViewSlots,
  type A2UIViewVariants,
  a2uiViewVariants
} from './a2ui-view.variants';
// ── Urbicon-native catalog (opt-in; tree-shaken out unless imported) ─────────
export { urbiconA2uiCatalog } from './urbicon/a2ui-urbicon-catalog';
export {
  SHARED_AXES,
  UNSUPPORTED_URBICON_A2UI_COMPONENTS,
  URBICON_A2UI_CATALOG_ID,
  URBICON_A2UI_ICON_NAMES,
  URBICON_A2UI_REGISTRY,
  type UrbiconComponentSpec,
  type UrbiconPropSpec,
  urbiconA2uiCatalogSpec
} from './urbicon/a2ui-urbicon-registry';
