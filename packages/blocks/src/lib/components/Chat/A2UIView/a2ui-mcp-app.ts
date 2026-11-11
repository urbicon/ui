// The MCP-App transport for A2UI: a tool whose arguments are the envelopes,
// `{ messages: Envelope[] }`, and whose call the host shows as a view running
// A2UIView. Two halves, shipped together like the fenced transport's section
// and splitter: the prompt section that tells the agent what holds when every
// call is a new view, and the stabilizer that turns the host's streamed
// partial arguments into a payload A2UIView can append to.
//
// The host side of that protocol (postMessage, JSON-RPC, the notifications
// themselves) is the consumer's and lives nowhere in this package.

import { type A2uiTransportSectionOptions, transportPrefixes } from './a2ui-stream';
import { normalizeA2uiPayload } from './a2ui-validate';

/**
 * The prompt half of the MCP-App transport: the section that tells an agent how
 * to show UI through a tool whose arguments are `{ messages: Envelope[] }` and
 * whose every call the host renders as its own view. Put it, after
 * `a2uiSystemPrompt()`, into that tool's description. The client half is
 * {@link A2uiToolInputStabilizer}.
 *
 * Every call is a new view and an earlier view is out of reach, so a correction
 * or a next step is a whole new surface — the opposite of what
 * `a2uiFencedTransportSection()` asks for, where a later turn patches the
 * surface in place. Use one of the two, never both.
 *
 * The round channel takes the options of the chat transport. An action reaches
 * the agent as a user message whose text is {@link a2uiActionMessage}; a payload
 * that fails validation is the call's error result, whose text is
 * {@link a2uiErrorMessage} — validate the arguments in the tool handler with
 * `validateA2uiPayload()`, so the agent learns of the fault in the same turn.
 *
 * @example
 * ```ts
 * const description = [
 *   a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
 *   a2uiMcpAppTransportSection()
 * ].join('\n\n');
 * ```
 */
export function a2uiMcpAppTransportSection(options?: A2uiTransportSectionOptions): string {
  const { action: actionPrefix, error: errorPrefix } = transportPrefixes(options);

  const lines = [
    '## Transport — how your UI reaches this client',
    '',
    'You show UI by calling this tool. Its "messages" argument is the list of A2UI',
    'envelopes, in order: one JSON object per envelope, createSurface FIRST, then',
    'the updateComponents / updateDataModel envelopes. Every envelope has',
    '"version":"v0.9.1".',
    '',
    'Each call opens a NEW view, and that view shows exactly what the call sent:',
    '',
    '- One call is one complete, self-contained surface — every component and',
    '  every value it needs. Nothing from an earlier call carries over into it.',
    '- A view you already showed can never be changed: no later call reaches it.',
    '  To correct a surface or take the next step, call again with the COMPLETE',
    '  surface, not just what changed, and say in prose what you changed. A',
    '  surfaceId only has to be unique within one call.',
    '- Never send deleteSurface for a surface of an earlier call: that surface is',
    '  not in the new view, so the envelope fails.',
    '- If an action arrives with required fields still empty, do NOT carry it',
    '  out — call again with the complete surface and a short message next to the',
    '  offending field. You are the only validator; the client submits whatever',
    '  it is given.'
  ];

  if (actionPrefix || errorPrefix) {
    lines.push('', '## Interaction round-channel', '');
  }
  if (actionPrefix) {
    lines.push(
      'When the user activates a control on a surface you sent, you receive a new',
      `user message whose text begins with \`${actionPrefix} \` followed by a compact`,
      'JSON object: { name, surfaceId, sourceComponentId, timestamp, context }, plus',
      "`dataModel` (the surface's full state) when you created it with",
      '"sendDataModel": true. The view the user acted in stays as it is: answer in',
      'prose, or call again with the surface the next step needs.'
    );
  }
  if (errorPrefix) {
    if (actionPrefix) lines.push('');
    lines.push(
      'If the envelopes of a call fail validation, the call returns an error result',
      `whose text begins with \`${errorPrefix} \` followed by the validation issues as`,
      'JSON. Read it, correct the offending envelopes, and call again with the',
      'complete corrected surface.'
    );
  }

  return lines.join('\n');
}

/**
 * The client half of the MCP-App transport: turns the arguments of successive
 * `ui/notifications/tool-input-partial` notifications, then those of the final
 * `ui/notifications/tool-input`, into one `payload` for `A2UIView` that only
 * ever grows.
 *
 * A host sends each partial as a freshly parsed object — the incomplete JSON
 * with its open structures closed — so every notification brings a new array
 * of new envelope objects. A2UIView appends only while the envelopes it already
 * consumed are the very same objects, and rebuilds otherwise, which remounts
 * the surface and drops what the user typed. The last envelope of a partial
 * can also be cut short and still parse (half a label, half a URL). So the
 * stabilizer passes an envelope on only once a later envelope appears behind
 * it, or the final arguments arrive, and keeps every envelope it passed on as
 * the same object for as long as later arguments carry the same JSON value —
 * the same keys and values, in whatever order the keys come.
 *
 * When later arguments change an envelope already passed on, there is no
 * honest append: the stabilizer returns a new array of the new envelopes, and
 * A2UIView rebuilds the view, discarding the user's input on it.
 *
 * Arguments are read as `normalizeA2uiPayload` reads a payload — the
 * `{ messages }` wrapper, an envelope array, or one envelope. Final arguments
 * it cannot read are returned unchanged, so A2UIView reports them exactly as it
 * would without the stabilizer; a partial it cannot read changes nothing.
 *
 * One instance per view: a view belongs to one tool call.
 *
 * @example
 * ```ts
 * const input = new A2uiToolInputStabilizer();
 * let payload: unknown = [];
 * let streaming = true;
 * // on ui/notifications/tool-input-partial
 * payload = input.partial(params.arguments);
 * // on ui/notifications/tool-input
 * payload = input.complete(params.arguments);
 * streaming = false;
 * ```
 */
export class A2uiToolInputStabilizer {
  /** The payload last returned; its entries are the envelopes passed on. */
  private payload: unknown[] = [];
  /**
   * A JSON copy of each passed-on envelope, taken when it was passed on, so a
   * change to the object handed out cannot hide a change in later arguments.
   */
  private passedOn: unknown[] = [];

  /**
   * Take the arguments of one `tool-input-partial` notification. Returns the
   * payload to render with `streaming` set: the previous one, by reference,
   * when nothing new is complete.
   */
  partial(args: unknown): unknown[] {
    const { envelopes, issue } = normalizeA2uiPayload(args);
    if (issue) return this.payload;
    return this.advance(envelopes.slice(0, -1), false);
  }

  /**
   * Take the final arguments, from `tool-input`. Returns the payload to render
   * once `streaming` is off — or `args` itself when they are not a payload at
   * all, so the view reports that.
   */
  complete(args: unknown): unknown {
    const { envelopes, issue } = normalizeA2uiPayload(args);
    if (issue) {
      this.payload = [];
      this.passedOn = [];
      return args;
    }
    return this.advance(envelopes, true);
  }

  private advance(next: readonly unknown[], final: boolean): unknown[] {
    const overlap = Math.min(next.length, this.payload.length);
    for (let i = 0; i < overlap; i++) {
      if (!sameJsonValue(next[i], this.passedOn[i])) return this.rebuild(next);
    }
    // Fewer complete envelopes than already passed on: a partial that shows
    // less than an earlier one adds nothing, final arguments without them do.
    if (next.length < this.payload.length) return final ? this.rebuild(next) : this.payload;
    if (next.length === this.payload.length) return this.payload;
    const added = next.slice(this.payload.length);
    this.payload = [...this.payload, ...added];
    for (const envelope of added) this.passedOn.push(jsonCopy(envelope));
    return this.payload;
  }

  private rebuild(next: readonly unknown[]): unknown[] {
    this.payload = [...next];
    this.passedOn = next.map(jsonCopy);
    return this.payload;
  }
}

function jsonCopy(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value) ?? 'null');
}

/**
 * Whether two JSON values are equal: arrays item by item, objects key by key
 * whatever order the keys come in — JSON gives that order no meaning, so
 * `JSON.stringify` output is no test of it.
 */
function sameJsonValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => sameJsonValue(item, b[i]));
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(b, key) &&
      sameJsonValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
  );
}
