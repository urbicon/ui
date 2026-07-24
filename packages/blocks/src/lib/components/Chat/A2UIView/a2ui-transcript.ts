/**
 * Transcript-side wiring for {@link A2uiSurfaceRouter}.
 *
 * The router decides WHERE an envelope belongs; these functions carry it there.
 * They are pure over `ChatMessageData[]` — every one returns a new message list
 * and never touches component state — so the whole cross-message patch flow is
 * testable without mounting the chat.
 *
 * Addressing: a source key is `` `${messageId}#${n}` ``, where `n` counts the
 * a2ui parts of that message in render order. Message ids may contain `#`, so
 * the key is always split at the LAST one.
 */

import type { ChatMessageData, ChatMessagePart } from '../chat.types';
import type { A2uiValidationIssue } from './a2ui.types';
import type { A2uiRoutePatch, A2uiSurfaceRouter } from './a2ui-router';

/** A surface that a later message patched, and the message it lives in. */
export interface PatchedSurface {
  surfaceId: string;
  targetMessageId: string;
}

export interface RouteMessageResult {
  /** The transcript with every delivered/withdrawn patch applied. */
  messages: ChatMessageData[];
  /** The routed message's own parts — foreign envelopes removed. */
  parts: ChatMessagePart[];
  /** Router findings (e.g. a re-created surfaceId) for the agent's error channel. */
  issues: A2uiValidationIssue[];
  /** Surfaces this call promoted to long-lived, with their home message. */
  promoted: PatchedSurface[];
  /**
   * Ids of the messages that received envelopes in this call — every target,
   * not just newly promoted ones.
   *
   * A patched message must render as if it were streaming for as long as the
   * patch is still arriving: envelopes land one by one, and a container that
   * names children from the NEXT envelope is normal mid-stream (the agent is
   * even told to send containers first). Without that grace the settled message
   * flags each intermediate state as a dangling reference, the user watches
   * error chips appear and vanish, and the agent gets told to repair UI that was
   * never broken.
   */
  targets: string[];
}

export const sourceKey = (messageId: string, partIndex: number) => `${messageId}#${partIndex}`;
export const messageIdOf = (key: string) => key.slice(0, key.lastIndexOf('#'));
const partIndexOf = (key: string) => Number(key.slice(key.lastIndexOf('#') + 1));

/** Rewrite the payload of the one a2ui part a source key addresses. */
export function editA2uiPayload(
  messages: ChatMessageData[],
  key: string,
  edit: (payload: unknown[]) => unknown[]
): ChatMessageData[] {
  const messageId = messageIdOf(key);
  const partIndex = partIndexOf(key);
  return messages.map((message) => {
    if (message.id !== messageId) return message;
    let seen = -1;
    return {
      ...message,
      parts: message.parts.map((part) => {
        if (part.type !== 'a2ui') return part;
        seen += 1;
        if (seen !== partIndex) return part;
        return { ...part, payload: edit((part.payload as unknown[]) ?? []) };
      })
    };
  });
}

const deliver = (messages: ChatMessageData[], patch: A2uiRoutePatch) =>
  editA2uiPayload(messages, patch.targetKey, (payload) => [...payload, ...patch.envelopes]);

// Removal is by reference: the router hands back the very objects it delivered,
// so a withdrawn patch leaves the surviving envelopes (and their order) alone.
const withdraw = (messages: ChatMessageData[], patch: A2uiRoutePatch) =>
  editA2uiPayload(messages, patch.targetKey, (payload) =>
    payload.filter((envelope) => !patch.envelopes.includes(envelope))
  );

/**
 * Route one message's a2ui parts: keep what belongs to it, deliver the rest to
 * the payloads that own those surfaces.
 *
 * A part whose envelopes ALL travelled elsewhere is dropped — it would render
 * as an empty surface. A part that is merely still empty (fence open, no
 * complete envelope yet) is kept, so the streaming placeholder survives.
 */
export function routeMessageParts(
  router: A2uiSurfaceRouter,
  messages: ChatMessageData[],
  messageId: string,
  parts: ChatMessagePart[]
): RouteMessageResult {
  let next = messages;
  let partIndex = -1;
  const issues: A2uiValidationIssue[] = [];
  const promoted: PatchedSurface[] = [];
  const targets = new Set<string>();

  const routed: ChatMessagePart[] = [];
  for (const part of parts) {
    if (part.type !== 'a2ui') {
      routed.push(part);
      continue;
    }
    partIndex += 1;
    const payload = (part.payload as unknown[]) ?? [];
    const result = router.route(sourceKey(messageId, partIndex), payload);

    for (const patch of result.revoked) next = withdraw(next, patch);
    for (const patch of result.patches) {
      next = deliver(next, patch);
      targets.add(messageIdOf(patch.targetKey));
    }
    issues.push(...result.issues);

    // Every patch in this call went to a target; a promoted surface is hosted by
    // the target its own envelopes travelled to.
    for (const surfaceId of result.promoted) {
      const owner = router.ownerOf(surfaceId);
      if (owner) promoted.push({ surfaceId, targetMessageId: messageIdOf(owner) });
    }

    if (payload.length > 0 && result.own.length === 0) continue;
    routed.push({ ...part, payload: result.own });
  }

  return { messages: next, parts: routed, issues, promoted, targets: [...targets] };
}

/**
 * Drop a message from the router's books and take back everything it had
 * patched into other messages — for regenerate, retry and deletion.
 *
 * The sources come from the router, not from counting the message's parts: a
 * message whose envelopes all travelled elsewhere keeps no a2ui part, and its
 * patches would otherwise outlive it.
 */
export function revokeMessage(
  router: A2uiSurfaceRouter,
  messages: ChatMessageData[],
  messageId: string
): ChatMessageData[] {
  let next = messages;
  for (const key of router.sourceKeys()) {
    if (messageIdOf(key) !== messageId) continue;
    for (const patch of router.revoke(key)) next = withdraw(next, patch);
  }
  return next;
}
