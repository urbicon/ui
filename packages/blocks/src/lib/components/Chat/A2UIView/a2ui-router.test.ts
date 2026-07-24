import { describe, expect, it } from 'vitest';
import { A2UI_ISSUE_CODES } from './a2ui.types';
import { A2uiSurfaceRouter } from './a2ui-router';

const V = 'v0.9.1';
const create = (surfaceId: string) => ({
  version: V,
  createSurface: { surfaceId, catalogId: 'a2ui/basic/v1' }
});
const components = (surfaceId: string, id = 'root') => ({
  version: V,
  updateComponents: { surfaceId, components: [{ id, component: 'Text', text: id }] }
});
const data = (surfaceId: string, value: unknown) => ({
  version: V,
  updateDataModel: { surfaceId, value }
});
const remove = (surfaceId: string) => ({ version: V, deleteSurface: { surfaceId } });

const A = 'msg-1#0';
const B = 'msg-2#0';
const C = 'msg-3#0';

describe('A2uiSurfaceRouter', () => {
  it('keeps a surface and its own envelopes with the creating source', () => {
    const router = new A2uiSurfaceRouter();
    const envelopes = [create('s1'), components('s1'), data('s1', { a: 1 })];

    const result = router.route(A, envelopes);

    expect(result.own).toEqual(envelopes);
    expect(result.patches).toEqual([]);
    expect(result.promoted).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(router.ownerOf('s1')).toBe(A);
  });

  it('routes a later message’s patch to the payload that owns the surface', () => {
    const router = new A2uiSurfaceRouter();
    router.route(A, [create('s1'), components('s1')]);

    const patch = data('s1', { time: '13:45' });
    const result = router.route(B, [patch]);

    expect(result.own).toEqual([]);
    expect(result.patches).toEqual([{ targetKey: A, envelopes: [patch] }]);
    // Element identity is what lets A2UIView apply the patch incrementally.
    expect(result.patches[0].envelopes[0]).toBe(patch);
  });

  it('promotes a surface exactly once, on the first outside patch', () => {
    const router = new A2uiSurfaceRouter();
    router.route(A, [create('s1')]);
    expect(router.isLongLived('s1')).toBe(false);

    // Envelope identity IS the append signal — reuse the objects, as a growing
    // stream payload does (`[...prev, envelope]`).
    const first = data('s1', 1);
    const second = data('s1', 2);
    expect(router.route(B, [first]).promoted).toEqual(['s1']);
    expect(router.isLongLived('s1')).toBe(true);
    // Further patches — appended by the same source, then sent by a third —
    // stay quiet: promotion is a transition, not a per-patch event.
    expect(router.route(B, [first, second]).promoted).toEqual([]);
    expect(router.route(C, [data('s1', 3)]).promoted).toEqual([]);
  });

  it('routes a mixed message: own surface stays, foreign patch travels', () => {
    const router = new A2uiSurfaceRouter();
    router.route(A, [create('s1')]);

    const foreign = data('s1', { picked: true });
    const ownCreate = create('s2');
    const ownComponents = components('s2');
    const result = router.route(B, [foreign, ownCreate, ownComponents]);

    expect(result.own).toEqual([ownCreate, ownComponents]);
    expect(result.patches).toEqual([{ targetKey: A, envelopes: [foreign] }]);
    expect(router.ownerOf('s2')).toBe(B);
  });

  describe('incremental routing', () => {
    it('never re-routes an unchanged prefix', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);
      const first = data('s1', 1);
      const second = data('s1', 2);

      const step1 = router.route(B, [first]);
      const step2 = router.route(B, [first, second]);

      expect(step1.patches[0].envelopes).toEqual([first]);
      // Only the appended envelope is handed over — no duplicate of `first`.
      expect(step2.patches).toEqual([{ targetKey: A, envelopes: [second] }]);
      expect(step2.revoked).toEqual([]);
    });

    it('returns the full own-list on every call, so it can be assigned as payload', () => {
      const router = new A2uiSurfaceRouter();
      const one = create('s1');
      const two = components('s1');

      expect(router.route(A, [one]).own).toEqual([one]);
      expect(router.route(A, [one, two]).own).toEqual([one, two]);
    });
  });

  describe('rebuild and revoke', () => {
    it('takes its patches back when a source is rebuilt with a different prefix', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);
      const stale = data('s1', 'old');
      router.route(B, [stale]);

      const fresh = data('s1', 'new');
      const result = router.route(B, [fresh]);

      expect(result.revoked).toEqual([{ targetKey: A, envelopes: [stale] }]);
      expect(result.patches).toEqual([{ targetKey: A, envelopes: [fresh] }]);
    });

    it('un-promotes a surface when the only outside patch is revoked', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);
      router.route(B, [data('s1', 1)]);
      expect(router.isLongLived('s1')).toBe(true);

      const patches = router.revoke(B);

      expect(patches).toEqual([{ targetKey: A, envelopes: [expect.anything()] }]);
      expect(router.isLongLived('s1')).toBe(false);
      // …and a later patch promotes it afresh.
      expect(router.route(C, [data('s1', 2)]).promoted).toEqual(['s1']);
    });

    it('keeps a surface long-lived while another patcher remains', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);
      router.route(B, [data('s1', 1)]);
      router.route(C, [data('s1', 2)]);

      router.revoke(B);

      expect(router.isLongLived('s1')).toBe(true);
    });

    it('frees the surfaces a revoked source owned', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);

      router.revoke(A);

      expect(router.ownerOf('s1')).toBeUndefined();
      // With no owner the patch stays home, so the processor reports NO_SURFACE.
      const orphan = data('s1', 1);
      expect(router.route(B, [orphan]).own).toEqual([orphan]);
    });

    it('revoking an unknown source is a no-op', () => {
      expect(new A2uiSurfaceRouter().revoke('nope')).toEqual([]);
    });
  });

  describe('ownership edge cases', () => {
    it('transfers ownership when a later source recreates the id, and says so', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);

      const recreate = create('s1');
      const result = router.route(B, [recreate, components('s1')]);

      expect(result.own).toEqual([recreate, components('s1')]);
      expect(result.patches).toEqual([]);
      expect(router.ownerOf('s1')).toBe(B);
      const issue = result.issues[0];
      expect(issue.code).toBe(A2UI_ISSUE_CODES.SURFACE_RECREATED);
      expect(issue.severity).toBe('warning');
      expect(issue.surfaceId).toBe('s1');
    });

    it('does not complain when a source recreates its own surface', () => {
      const router = new A2uiSurfaceRouter();
      const result = router.route(A, [create('s1'), create('s1')]);

      expect(result.issues).toEqual([]);
      expect(result.own).toHaveLength(2);
    });

    it('keeps an envelope for an unknown surface at home (fail loud downstream)', () => {
      const router = new A2uiSurfaceRouter();
      const orphan = data('ghost', 1);

      const result = router.route(A, [orphan]);

      expect(result.own).toEqual([orphan]);
      expect(result.patches).toEqual([]);
    });

    it('routes deleteSurface to the owner and frees the id for re-use', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);

      const del = remove('s1');
      expect(router.route(B, [del]).patches).toEqual([{ targetKey: A, envelopes: [del] }]);
      expect(router.ownerOf('s1')).toBeUndefined();

      const recreate = create('s1');
      const result = router.route(C, [recreate]);
      expect(result.issues).toEqual([]);
      expect(router.ownerOf('s1')).toBe(C);
    });

    it('frees the id when the owner deletes its own surface', () => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1'), remove('s1')]);

      expect(router.ownerOf('s1')).toBeUndefined();
    });
  });

  describe('malformed envelopes', () => {
    it.each([
      ['not an object', 42],
      ['null', null],
      ['an array', [{ version: V }]],
      ['no operation', { version: V }],
      ['two operations', { version: V, createSurface: {}, deleteSurface: {} }],
      ['a non-object body', { version: V, createSurface: 'nope' }],
      ['no surfaceId', { version: V, updateDataModel: { value: 1 } }],
      ['an empty surfaceId', { version: V, updateDataModel: { surfaceId: '', value: 1 } }],
      ['a non-string surfaceId', { version: V, updateDataModel: { surfaceId: 7 } }]
    ])('leaves an envelope with %s in place', (_label, envelope) => {
      const router = new A2uiSurfaceRouter();
      router.route(A, [create('s1')]);

      const result = router.route(B, [envelope]);

      expect(result.own).toEqual([envelope]);
      expect(result.patches).toEqual([]);
    });

    it('ignores a prototype-polluting surfaceId like any other unknown surface', () => {
      const router = new A2uiSurfaceRouter();
      const evil = { version: V, updateDataModel: { surfaceId: '__proto__', value: 1 } };

      const result = router.route(A, [evil]);

      expect(result.own).toEqual([evil]);
      expect(router.ownerOf('__proto__')).toBeUndefined();
      expect(router.surfaceIds()).toEqual([]);
    });
  });

  it('groups patches for several targets in one call', () => {
    const router = new A2uiSurfaceRouter();
    router.route(A, [create('s1')]);
    router.route(B, [create('s2')]);

    const toA = data('s1', 1);
    const toB = data('s2', 2);
    const result = router.route(C, [toA, toB]);

    expect(result.patches).toEqual([
      { targetKey: A, envelopes: [toA] },
      { targetKey: B, envelopes: [toB] }
    ]);
    expect(result.promoted).toEqual(['s1', 's2']);
  });

  it('lists its sources, including one that kept nothing of its own', () => {
    const router = new A2uiSurfaceRouter();
    router.route(A, [create('s1')]);
    // B routed one envelope and kept none — it is still a source to retire.
    expect(router.route(B, [data('s1', 1)]).own).toEqual([]);

    expect(router.sourceKeys()).toEqual([A, B]);
    router.revoke(B);
    expect(router.sourceKeys()).toEqual([A]);
  });

  it('reset clears every bit of bookkeeping', () => {
    const router = new A2uiSurfaceRouter();
    router.route(A, [create('s1')]);
    router.route(B, [data('s1', 1)]);

    router.reset();

    expect(router.ownerOf('s1')).toBeUndefined();
    expect(router.isLongLived('s1')).toBe(false);
    expect(router.surfaceIds()).toEqual([]);
    expect(router.revoke(B)).toEqual([]);
  });
});
