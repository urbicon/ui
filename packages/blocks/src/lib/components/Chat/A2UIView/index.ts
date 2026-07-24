import type { HTMLAttributes } from 'svelte/elements';
import type { MarkdownUrlPolicy } from '../markdown/types';
import type { A2uiActionEvent, A2uiValidationIssue } from './a2ui.types';
import type { A2UIViewSlots } from './a2ui-view.variants';

/**
 * @description Renders a trusted-catalog A2UI (Agent-to-UI, v0.9.1 `basic`
 * subset) payload into live, interactive Urbicon components. Fail-loud and
 * whitelist-only: only the 12 mapped components and their declared props ever
 * reach the DOM — unknown components/props, prototype-pollution keys and
 * function-call bindings are rejected, never rendered, and surfaced through
 * `onValidationError` (spec-compatible issues a consumer can relay to the agent
 * as a `VALIDATION_FAILED` error). Inputs are two-way (typing writes into the
 * local data model; bound text updates live); actions dispatch a spec-exact
 * `A2uiActionEvent`. Images and links are gated by the same strict-by-default
 * `urlPolicy` as StreamingMarkdown. It is deliberately NOT a default ChatMessage
 * renderer — wire it in per surface via `partRenderers.a2ui` to keep it out of
 * the base bundle. Generate the agent-side prompt with the shipped
 * `a2uiSystemPrompt()`; validate a payload without a DOM with
 * `createA2uiProcessor()` — never hand-roll either.
 * @tag ai
 * @related ChatMessage
 * @stability experimental
 *
 * @example Wire it into ChatMessage as the `a2ui` part renderer
 * ```svelte
 * <ChatMessage {message} {urlPolicy}>
 *   {#snippet a2ui(part)}
 *     <A2UIView
 *       payload={part.payload}
 *       streaming={message.status === 'streaming'}
 *       {urlPolicy}
 *       onAction={(event) => sendUserTurn(`[ui-action] ${JSON.stringify(event)}`)}
 *       onValidationError={(issues) => reportToAgent(issues)}
 *     />
 *   {/snippet}
 * </ChatMessage>
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
export {
  type A2uiComponentInstance,
  type A2uiProcessor,
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
