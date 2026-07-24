import { describe, expect, it } from 'vitest';
import type { ChatMessageData, ChatMessagePart } from '../chat.types';
import { A2uiSurfaceRouter } from './a2ui-router';
import { editA2uiPayload, revokeMessage, routeMessageParts, sourceKey } from './a2ui-transcript';

const V = 'v0.9.1';
const create = (surfaceId: string) => ({
  version: V,
  createSurface: { surfaceId, catalogId: 'urbicon-ui/urbicon-catalog/v1' }
});
const components = (surfaceId: string, id: string) => ({
  version: V,
  updateComponents: { surfaceId, components: [{ id, component: 'Text', text: id }] }
});
const setTime = (surfaceId: string, time: string) => ({
  version: V,
  updateDataModel: { surfaceId, path: '/time', value: time }
});

const text = (value: string): ChatMessagePart => ({ type: 'text', text: value });
const ui = (payload: unknown[]): ChatMessagePart => ({ type: 'a2ui', payload });

const message = (id: string, parts: ChatMessagePart[]): ChatMessageData => ({
  id,
  role: 'assistant',
  parts,
  status: 'complete'
});

const payloadOf = (messages: ChatMessageData[], id: string, index = 0) => {
  const parts = messages.find((m) => m.id === id)?.parts.filter((p) => p.type === 'a2ui') ?? [];
  return (parts[index] as Extract<ChatMessagePart, { type: 'a2ui' }>)?.payload as unknown[];
};

describe('editA2uiPayload', () => {
  it('addresses the nth a2ui part, counting only a2ui parts', () => {
    const messages = [message('m1', [ui(['a']), text('between'), ui(['b'])])];

    const next = editA2uiPayload(messages, sourceKey('m1', 1), (p) => [...p, 'appended']);

    expect(payloadOf(next, 'm1', 0)).toEqual(['a']);
    expect(payloadOf(next, 'm1', 1)).toEqual(['b', 'appended']);
    expect(next[0].parts[1]).toBe(messages[0].parts[1]); // untouched parts keep identity
  });

  it('splits the key at the LAST # so message ids may contain one', () => {
    const messages = [message('m#1', [ui(['a'])])];

    const next = editA2uiPayload(messages, sourceKey('m#1', 0), () => ['replaced']);

    expect(payloadOf(next, 'm#1')).toEqual(['replaced']);
  });

  it('leaves the transcript alone for an unknown message or part index', () => {
    const messages = [message('m1', [ui(['a'])])];

    expect(editA2uiPayload(messages, sourceKey('nope', 0), () => ['x'])[0]).toBe(messages[0]);
    expect(
      payloadOf(
        editA2uiPayload(messages, sourceKey('m1', 3), () => ['x']),
        'm1'
      )
    ).toEqual(['a']);
  });
});

describe('routeMessageParts', () => {
  // The scenario the demo actually failed on: a booking form is built in one
  // turn, and the next turn fills in the time the user picked.
  it('delivers a later turn’s patch into the form’s own payload', () => {
    const router = new A2uiSurfaceRouter();
    const built = [create('booking-h1'), components('booking-h1', 'root')];
    let messages = [message('m1', [text('Here is the form'), ui(built)])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;

    const patch = setTime('booking-h1', '13:45');
    const result = routeMessageParts(router, messages, 'm2', [text('Set to 13:45'), ui([patch])]);

    expect(payloadOf(result.messages, 'm1')).toEqual([...built, patch]);
    expect(result.promoted).toEqual([{ surfaceId: 'booking-h1', targetMessageId: 'm1' }]);
    // The patching message keeps its prose and drops the now-empty ui part.
    expect(result.parts).toEqual([text('Set to 13:45')]);
  });

  // A patch arrives envelope by envelope, and the agent is told to send
  // containers before their children — so the target needs streaming grace until
  // the patch has fully landed, or it flags each intermediate state as broken.
  it('names every message it delivered to, so the caller can grant that grace', () => {
    const router = new A2uiSurfaceRouter();
    let messages = [message('m1', [ui([create('s1')])]), message('m2', [ui([create('s2')])])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;
    messages = routeMessageParts(router, messages, 'm2', messages[1].parts).messages;

    const result = routeMessageParts(router, messages, 'm3', [
      ui([setTime('s1', '09:00'), setTime('s2', '10:00')])
    ]);

    expect(result.targets.sort()).toEqual(['m1', 'm2']);
  });

  it('names no target when nothing travelled', () => {
    const router = new A2uiSurfaceRouter();

    expect(routeMessageParts(router, [], 'm1', [ui([create('s1')])]).targets).toEqual([]);
  });

  it('keeps an appended patch out of the payload it came from', () => {
    const router = new A2uiSurfaceRouter();
    let messages = [message('m1', [ui([create('s1')])])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;

    const result = routeMessageParts(router, messages, 'm2', [ui([setTime('s1', '09:00')])]);

    expect(result.parts).toEqual([]);
    expect(payloadOf(result.messages, 'm1')).toHaveLength(2);
  });

  it('keeps a still-empty part so the streaming placeholder survives', () => {
    const result = routeMessageParts(new A2uiSurfaceRouter(), [], 'm1', [ui([])]);

    expect(result.parts).toEqual([ui([])]);
  });

  it('splits a mixed part: own surface stays, foreign patch travels', () => {
    const router = new A2uiSurfaceRouter();
    let messages = [message('m1', [ui([create('s1')])])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;

    const foreign = setTime('s1', '10:30');
    const own = create('s2');
    const result = routeMessageParts(router, messages, 'm2', [ui([foreign, own])]);

    expect(result.parts).toEqual([ui([own])]);
    expect(payloadOf(result.messages, 'm1')).toEqual([create('s1'), foreign]);
  });

  it('is idempotent while a turn streams', () => {
    const router = new A2uiSurfaceRouter();
    let messages = [message('m1', [ui([create('s1')])])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;

    // The same growing payload, routed on every token, as patchLive() does.
    const first = setTime('s1', '09:00');
    const second = setTime('s1', '09:45');
    let result = routeMessageParts(router, messages, 'm2', [ui([first])]);
    result = routeMessageParts(router, result.messages, 'm2', [ui([first, second])]);

    expect(payloadOf(result.messages, 'm1')).toEqual([create('s1'), first, second]);
    // Promotion is a transition — it does not re-fire on the second token.
    expect(result.promoted).toEqual([]);
  });

  it('reports a recreated surfaceId while still rendering the new surface', () => {
    const router = new A2uiSurfaceRouter();
    let messages = [message('m1', [ui([create('s1')])])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;

    const recreate = create('s1');
    const result = routeMessageParts(router, messages, 'm2', [ui([recreate])]);

    expect(result.parts).toEqual([ui([recreate])]);
    expect(result.issues.map((i) => i.code)).toEqual(['SURFACE_RECREATED']);
    expect(payloadOf(result.messages, 'm1')).toEqual([create('s1')]);
  });

  it('leaves an envelope for a never-created surface in place (fail loud)', () => {
    const router = new A2uiSurfaceRouter();
    const orphan = setTime('ghost', '09:00');

    const result = routeMessageParts(router, [], 'm1', [ui([orphan])]);

    expect(result.parts).toEqual([ui([orphan])]);
    expect(result.promoted).toEqual([]);
  });
});

describe('revokeMessage', () => {
  it('takes a regenerated turn’s patches back out of the earlier payload', () => {
    const router = new A2uiSurfaceRouter();
    const built = [create('s1')];
    let messages = [message('m1', [ui(built)])];
    messages = routeMessageParts(router, messages, 'm1', messages[0].parts).messages;

    const patch = setTime('s1', '13:45');
    const routed = routeMessageParts(router, messages, 'm2', [ui([patch])]);
    messages = [...routed.messages, message('m2', routed.parts)];
    expect(payloadOf(messages, 'm1')).toEqual([...built, patch]);

    // m2 kept NO a2ui part of its own — its patches all travelled to m1 — so
    // the revoke has to find the source through the router, not the parts.
    expect(messages[1].parts.some((p) => p.type === 'a2ui')).toBe(false);
    messages = revokeMessage(router, messages, 'm2');

    expect(payloadOf(messages, 'm1')).toEqual(built);
    expect(router.isLongLived('s1')).toBe(false);
  });

  it('frees the surfaces the revoked message owned', () => {
    const router = new A2uiSurfaceRouter();
    const messages = [message('m1', [ui([create('s1')])])];
    routeMessageParts(router, messages, 'm1', messages[0].parts);

    revokeMessage(router, messages, 'm1');

    expect(router.ownerOf('s1')).toBeUndefined();
  });

  it('is a no-op for a message the router never saw', () => {
    const router = new A2uiSurfaceRouter();
    const messages = [message('m1', [text('hello')])];

    expect(revokeMessage(router, messages, 'm1')).toBe(messages);
  });
});
