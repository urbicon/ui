import { describe, expect, it } from 'vitest';
import * as attacks from './__fixtures__/hostile/attacks';
import { exButton } from './__fixtures__/spec/ex_button';
import { exChildlist } from './__fixtures__/spec/ex_childlist';
import { exIncremental } from './__fixtures__/spec/ex_incremental';
import { exLogin } from './__fixtures__/spec/ex_login';
import { exSimpleText } from './__fixtures__/spec/ex_simple_text';
import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
import {
  type A2uiProcessor,
  type A2uiSurfaceState,
  collectGraphIssues,
  createA2uiProcessor,
  normalizeA2uiPayload
} from './a2ui-validate';

// ── Helpers ──────────────────────────────────────────────────────────────────

function applyAll(envelopes: readonly unknown[]): A2uiProcessor {
  const proc = createA2uiProcessor();
  envelopes.forEach((envelope, index) => {
    proc.apply(envelope, index);
  });
  return proc;
}

/** All issues: global + per-surface + graph-level (with the given streaming flag). */
function allIssues(proc: A2uiProcessor, streaming = false): A2uiValidationIssue[] {
  const issues = [...proc.globalIssues];
  for (const surface of proc.surfaces.values()) {
    issues.push(...surface.issues);
    issues.push(...collectGraphIssues(surface, { streaming }));
  }
  return issues;
}

function codes(issues: A2uiValidationIssue[]): Set<string> {
  return new Set(issues.map((issue) => issue.code));
}

function only<T>(map: Map<string, T>): T {
  expect(map.size).toBe(1);
  return [...map.values()][0];
}

/** A plain, comparable snapshot of processor state (surfaces + global issues). */
function snapshot(proc: A2uiProcessor) {
  return {
    surfaces: [...proc.surfaces.values()].map((surface) => ({
      surfaceId: surface.surfaceId,
      components: [...surface.components.values()].map((c) => ({
        id: c.id,
        component: c.component,
        props: [...c.props.entries()],
        sourceIndex: c.sourceIndex
      })),
      dataModel: surface.dataModel,
      issues: surface.issues
    })),
    globalIssues: proc.globalIssues
  };
}

// ── Golden files ─────────────────────────────────────────────────────────────

interface GoldenCase {
  name: string;
  messages: readonly unknown[];
  surfaceId: string;
  rootComponent: string;
  dataModel: unknown;
  warningCodes: string[]; // exact multiset of warning codes (surface + global)
}

const goldenCases: GoldenCase[] = [
  {
    name: 'simple_text',
    messages: exSimpleText.messages,
    surfaceId: 'gallery-simple-text',
    rootComponent: 'Text',
    dataModel: undefined,
    warningCodes: []
  },
  {
    name: 'button',
    messages: exButton.messages,
    surfaceId: 'gallery-interactive-button',
    rootComponent: 'Column',
    dataModel: undefined,
    warningCodes: []
  },
  {
    name: 'childlist',
    messages: exChildlist.messages,
    surfaceId: 'gallery-child-list-template',
    rootComponent: 'Card',
    dataModel: {
      items: [
        { name: 'Apple', quantity: 10 },
        { name: 'Banana', quantity: 5 },
        { name: 'Cherry', quantity: 20 }
      ]
    },
    // sendDataModel: true is honoured now, so the fixture warns about nothing.
    warningCodes: []
  },
  {
    name: 'incremental',
    messages: exIncremental.messages,
    surfaceId: 'gallery-incremental',
    rootComponent: 'Column',
    dataModel: {
      restaurants: [
        {
          title: 'The Golden Fork',
          subtitle: 'Fine Dining & Spirits',
          address: '123 Gastronomy Lane'
        },
        { title: "Ocean's Bounty", subtitle: 'Fresh Daily Seafood', address: '456 Shoreline Dr' },
        {
          title: 'Pizzeria Roma',
          subtitle: 'Authentic Wood-Fired Pizza',
          address: '789 Napoli Way'
        },
        {
          title: 'Spice Route',
          subtitle: 'Exotic Flavors from the East',
          address: '101 Silk Road St'
        }
      ]
    },
    warningCodes: []
  },
  {
    name: 'login',
    messages: exLogin.messages,
    surfaceId: 'gallery-login-form',
    rootComponent: 'Card',
    dataModel: { email: '', password: '' },
    // 3× checks ignored (email-field, password-field, login-btn); the fixture's
    // sendDataModel: true is applied, not warned about.
    warningCodes: [
      A2UI_ISSUE_CODES.IGNORED_PROP,
      A2UI_ISSUE_CODES.IGNORED_PROP,
      A2UI_ISSUE_CODES.IGNORED_PROP
    ]
  }
];

describe('golden files', () => {
  for (const golden of goldenCases) {
    describe(golden.name, () => {
      const proc = applyAll(golden.messages);
      const surface = proc.surfaces.get(golden.surfaceId) as A2uiSurfaceState;
      const graph = collectGraphIssues(surface, { streaming: false });

      it('builds exactly one surface with the expected id', () => {
        expect(only(proc.surfaces).surfaceId).toBe(golden.surfaceId);
      });

      it('defines a root component of the expected type', () => {
        expect(surface.components.has('root')).toBe(true);
        expect(surface.components.get('root')?.component).toBe(golden.rootComponent);
      });

      it('reduces to the expected data model', () => {
        expect(surface.dataModel).toEqual(golden.dataModel);
      });

      it('produces zero errors (structural and graph-level)', () => {
        const errors = allIssues(proc).filter((issue) => issue.severity === 'error');
        expect(errors).toEqual([]);
      });

      it('produces exactly the expected warnings', () => {
        const warnings = [...proc.globalIssues, ...surface.issues].filter(
          (issue) => issue.severity === 'warning'
        );
        expect(warnings.map((w) => w.code).sort()).toEqual([...golden.warningCodes].sort());
        expect(graph.filter((i) => i.severity === 'warning')).toEqual([]);
      });
    });
  }
});

// ── Incremental === batched invariance ───────────────────────────────────────

describe('incremental application is order-invariant', () => {
  for (const golden of goldenCases) {
    it(`${golden.name}: all-at-once equals split-in-two`, () => {
      const whole = applyAll(golden.messages);

      const split = createA2uiProcessor();
      const mid = Math.floor(golden.messages.length / 2);
      golden.messages.slice(0, mid).forEach((e, i) => {
        split.apply(e, i);
      });
      golden.messages.slice(mid).forEach((e, i) => {
        split.apply(e, mid + i);
      });

      expect(snapshot(split)).toEqual(snapshot(whole));
    });
  }
});

// ── normalizeA2uiPayload ─────────────────────────────────────────────────────

describe('normalizeA2uiPayload', () => {
  it('accepts an envelope array', () => {
    const arr = [{ version: 'v0.9.1' }];
    expect(normalizeA2uiPayload(arr).envelopes).toBe(arr);
  });

  it('wraps a single envelope object', () => {
    const one = { version: 'v0.9.1', deleteSurface: { surfaceId: 's' } };
    expect(normalizeA2uiPayload(one).envelopes).toEqual([one]);
  });

  it('unwraps the { messages } golden-file form', () => {
    expect(normalizeA2uiPayload(exSimpleText).envelopes).toBe(exSimpleText.messages);
  });

  it('returns an issue for unusable input', () => {
    expect(normalizeA2uiPayload(null).issue?.code).toBe(A2UI_ISSUE_CODES.INVALID_ENVELOPE);
    expect(normalizeA2uiPayload(42).issue?.code).toBe(A2UI_ISSUE_CODES.INVALID_ENVELOPE);
    expect(normalizeA2uiPayload(null).envelopes).toEqual([]);
  });
});

// ── Hostile fixtures ─────────────────────────────────────────────────────────

describe('hostile fixtures never throw and produce the expected issues', () => {
  it('prototype pollution: component id', () => {
    const proc = applyAll(attacks.protoComponentId);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
  });

  it('prototype pollution: prop key', () => {
    const proc = applyAll(attacks.protoPropKey);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('prototype pollution: pointer segment', () => {
    const proc = applyAll(attacks.protoPointerSegment);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('prototype pollution: constructor pointer', () => {
    const proc = applyAll(attacks.protoConstructorPointer);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('prototype pollution: action context key', () => {
    const proc = applyAll(attacks.protoContextKey);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('depth bomb → MAX_DEPTH', () => {
    const proc = applyAll(attacks.depthBomb);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.MAX_DEPTH);
  });

  it('node bomb → MAX_NODES', () => {
    const proc = applyAll(attacks.nodeBomb);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.MAX_NODES);
  });

  it('cycle → CYCLE', () => {
    const proc = applyAll(attacks.cycle);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.CYCLE);
  });

  it('duplicate ids → DUPLICATE_ID, last definition wins', () => {
    const proc = applyAll(attacks.duplicateIds);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.DUPLICATE_ID);
    expect(proc.surfaces.get('dup')?.components.get('dup')?.props.get('text')).toBe('second');
  });

  it('unknown + unsupported components', () => {
    const proc = applyAll(attacks.unknownComponents);
    const c = codes(allIssues(proc));
    expect(c).toContain(A2UI_ISSUE_CODES.UNSUPPORTED_COMPONENT);
    expect(c).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
  });

  it('unknown prop → UNKNOWN_PROP (handler injection blocked)', () => {
    const proc = applyAll(attacks.unknownProp);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_PROP);
    expect(proc.surfaces.get('up')?.components.get('root')?.props.has('onclick')).toBe(false);
  });

  it('type mismatch on an optional prop → TYPE_MISMATCH', () => {
    const proc = applyAll(attacks.typeMismatch);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.TYPE_MISMATCH);
  });

  it('bad and missing version → INVALID_VERSION, no surface created', () => {
    const bad = applyAll(attacks.badVersion);
    expect(codes(allIssues(bad))).toContain(A2UI_ISSUE_CODES.INVALID_VERSION);
    expect(bad.surfaces.size).toBe(0);
    const missing = applyAll(attacks.missingVersion);
    expect(codes(allIssues(missing))).toContain(A2UI_ISSUE_CODES.INVALID_VERSION);
  });

  it('updateComponents before createSurface → NO_SURFACE', () => {
    const proc = applyAll(attacks.updateBeforeCreate);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.NO_SURFACE);
  });

  it('createSurface duplicate → DUPLICATE_SURFACE', () => {
    const proc = applyAll(attacks.duplicateSurface);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.DUPLICATE_SURFACE);
  });

  it('dangling reference: warning while streaming, error once settled', () => {
    const proc = applyAll(attacks.danglingRef);
    const streamingIssues = collectGraphIssues(proc.surfaces.get('dr')!, { streaming: true });
    const settledIssues = collectGraphIssues(proc.surfaces.get('dr')!, { streaming: false });
    expect(streamingIssues.find((i) => i.code === A2UI_ISSUE_CODES.DANGLING_REF)?.severity).toBe(
      'warning'
    );
    expect(settledIssues.find((i) => i.code === A2UI_ISSUE_CODES.DANGLING_REF)?.severity).toBe(
      'error'
    );
  });

  it('template path on a non-array → TEMPLATE_PATH_NOT_ARRAY', () => {
    const proc = applyAll(attacks.templatePathNotArray);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.TEMPLATE_PATH_NOT_ARRAY);
  });

  it('malformed Tabs items → TYPE_MISMATCH, and the whole prop is dropped', () => {
    const proc = applyAll(attacks.tabsMalformedItems);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.TYPE_MISMATCH);
    // One bad item rejects the entire prop — the render layer never sees a
    // half-valid list it would have to index-align against resolved children.
    expect(proc.surfaces.get('tb')?.components.get('root')?.props.has('tabs')).toBe(false);
  });

  it('empty Tabs array → TABS_EMPTY warning, prop still stored', () => {
    const proc = applyAll(attacks.tabsEmpty);
    const issues = allIssues(proc);
    expect(codes(issues)).toContain(A2UI_ISSUE_CODES.TABS_EMPTY);
    expect(issues.find((i) => i.code === A2UI_ISSUE_CODES.TABS_EMPTY)?.severity).toBe('warning');
    expect(proc.surfaces.get('te')?.components.get('root')?.props.get('tabs')).toEqual([]);
  });

  it('updateDataModel delete semantics (value omitted removes the key)', () => {
    const proc = applyAll(attacks.deleteSemantics);
    expect(proc.surfaces.get('del')?.dataModel).toEqual({ b: 2 });
  });

  it('invalid svgPath → ICON_INVALID_SVG', () => {
    const proc = applyAll(attacks.invalidSvgPath);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.ICON_INVALID_SVG);
  });

  it('envelope smuggling: extra top-level key flagged, valid op still applied', () => {
    const proc = applyAll(attacks.envelopeSmuggling);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_PROP);
    expect(proc.surfaces.get('sm')?.components.has('root')).toBe(true);
  });

  it('no hostile fixture ever throws', () => {
    for (const fixture of Object.values(attacks)) {
      if (Array.isArray(fixture)) {
        expect(() => applyAll(fixture)).not.toThrow();
      }
    }
  });

  it('Object.prototype stays clean after every hostile fixture', () => {
    for (const fixture of Object.values(attacks)) {
      if (Array.isArray(fixture)) applyAll(fixture);
    }
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('A2UIView validator — hardening (review regressions)', () => {
  const V = 'v0.9.1';
  const surface = (id = 's') => ({ version: V, createSurface: { surfaceId: id, catalogId: 'x' } });
  const comps = (components: unknown[], id = 's') => ({
    version: V,
    updateComponents: { surfaceId: id, components }
  });

  it('caps the surface count and reports MAX_SURFACES for the surplus', () => {
    const envelopes: unknown[] = [];
    for (let i = 0; i < 80; i++) envelopes.push(surface(`s${i}`));
    const proc = applyAll(envelopes);
    // Bounded well below the flood; the extra createSurface calls are refused.
    expect(proc.surfaces.size).toBeLessThanOrEqual(64);
    expect(codes(proc.globalIssues).has(A2UI_ISSUE_CODES.MAX_SURFACES)).toBe(true);
  });

  it('caps a single updateComponents component list and reports MAX_COMPONENTS', () => {
    const big: unknown[] = [{ id: 'root', component: 'Text', text: 'hi' }];
    for (let i = 0; i < 1100; i++) big.push({ id: `t${i}`, component: 'Text', text: 'x' });
    const proc = applyAll([surface(), comps(big)]);
    const s = proc.surfaces.get('s');
    expect(s).toBeDefined();
    expect(s && s.components.size).toBeLessThanOrEqual(1025); // cap + root
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.MAX_COMPONENTS)).toBe(true);
  });

  it('flags a function-call value binding as an unsupported warning (feedback loop)', () => {
    const proc = applyAll([
      surface(),
      comps([{ id: 'root', component: 'Text', text: { call: 'now', args: {} } }])
    ]);
    const issues = allIssues(proc);
    expect(
      issues.some(
        (i) => i.code === A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED && i.severity === 'warning'
      )
    ).toBe(true);
  });

  it('flags a prototype-poisoned data-binding path as an error at validation time', () => {
    const proc = applyAll([
      surface(),
      comps([{ id: 'root', component: 'Text', text: { path: '/__proto__/x' } }])
    ]);
    const issues = allIssues(proc);
    expect(
      issues.some((i) => i.code === A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION && i.severity === 'error')
    ).toBe(true);
    // The poison never entered the model.
    expect((Object.prototype as Record<string, unknown>).x).toBeUndefined();
  });

  it('warns on duplicate ChoicePicker option values (render dedupes)', () => {
    const proc = applyAll([
      surface(),
      comps([
        {
          id: 'root',
          component: 'ChoicePicker',
          value: { path: '/c' },
          options: [
            { label: 'A', value: 'x' },
            { label: 'B', value: 'x' }
          ]
        }
      ])
    ]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.DUPLICATE_OPTION)).toBe(true);
  });
});

describe('DateTimeInput validation', () => {
  const surface = () => ({
    version: 'v0.9.1',
    createSurface: { surfaceId: 's', catalogId: 'x' }
  });
  const comps = (components: unknown[]) => ({
    version: 'v0.9.1',
    updateComponents: { surfaceId: 's', components }
  });
  const dt = (props: Record<string, unknown>) =>
    comps([{ id: 'root', component: 'DateTimeInput', ...props }]);

  it('accepts the spec shape without issues', () => {
    const proc = applyAll([
      surface(),
      dt({
        value: { path: '/when' },
        enableDate: true,
        enableTime: true,
        label: 'Due',
        min: '2026-01-01',
        max: '2026-12-31T18:00'
      })
    ]);
    expect(allIssues(proc)).toEqual([]);
  });

  it('warns DATETIME_NO_MODE when neither enableDate nor enableTime is set', () => {
    const proc = applyAll([surface(), dt({ value: { path: '/when' } })]);
    const issues = allIssues(proc);
    expect(
      issues.some((i) => i.code === A2UI_ISSUE_CODES.DATETIME_NO_MODE && i.severity === 'warning')
    ).toBe(true);
  });

  it('rejects a non-boolean enableDate with TYPE_MISMATCH', () => {
    const proc = applyAll([surface(), dt({ value: { path: '/when' }, enableDate: 'yes' })]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
  });

  it('reports the missing required value', () => {
    const proc = applyAll([surface(), dt({ enableDate: true })]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.MISSING_FIELD)).toBe(true);
  });

  it('ignores the inherited Checkable `checks` prop with a warning', () => {
    const proc = applyAll([
      surface(),
      dt({ value: { path: '/when' }, enableDate: true, checks: [{ rule: 'x' }] })
    ]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.IGNORED_PROP)).toBe(true);
  });
});
