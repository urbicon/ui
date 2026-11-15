import { describe, expect, it } from 'vitest';
import * as attacks from './__fixtures__/hostile/attacks';
import { exButton } from './__fixtures__/spec/ex_button';
import { exChildlist } from './__fixtures__/spec/ex_childlist';
import { exIncremental } from './__fixtures__/spec/ex_incremental';
import { exLogin } from './__fixtures__/spec/ex_login';
import { exSimpleText } from './__fixtures__/spec/ex_simple_text';
import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
import { type A2uiCatalogSpec, type A2uiPropSpec, basicA2uiCatalogSpec } from './a2ui-catalog';
import { A2UI_MAX_DATA_DEPTH, A2UI_MAX_LOGIC_DEPTH, A2UI_MAX_LOGIC_OPERANDS } from './a2ui-data';
import { A2UI_CATALOG_ID, A2UI_UPSTREAM_BASIC_CATALOG_ID } from './a2ui-registry';
import { buildRenderTree } from './a2ui-render';
import {
  type A2uiRequiredComponent,
  type A2uiSurfaceRequirements,
  a2uiSurfaceRequirementsSection
} from './a2ui-requirements';
import type { A2uiDataSchema } from './a2ui-schema';
import {
  type A2uiProcessor,
  type A2uiSurfaceState,
  applyA2uiEnvelope,
  collectGraphIssues,
  createA2uiProcessor,
  normalizeA2uiPayload
} from './a2ui-validate';
import { URBICON_A2UI_CATALOG_ID, urbiconA2uiCatalogSpec } from './urbicon/a2ui-urbicon-registry';

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
    const arr = [{ version: '1.0' }];
    expect(normalizeA2uiPayload(arr).envelopes).toBe(arr);
  });

  it('wraps a single envelope object', () => {
    const one = { version: '1.0', deleteSurface: { surfaceId: 's' } };
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

  it('updateDataModel delete semantics (a null value removes the key)', () => {
    const proc = applyAll(attacks.deleteSemantics);
    expect(proc.surfaces.get('del')?.issues).toEqual([]);
    expect(proc.surfaces.get('del')?.dataModel).toEqual({ b: 2 });
  });

  it('updateDataModel without a value → MISSING_FIELD, and nothing is deleted', () => {
    const proc = applyAll(attacks.deleteByOmission);
    expect(proc.surfaces.get('om')?.issues).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: A2UI_ISSUE_CODES.MISSING_FIELD,
        path: '/messages/2/updateDataModel/value'
      })
    ]);
    expect(proc.surfaces.get('om')?.dataModel).toEqual({ a: 1, b: 2 });
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

  // #134: an inherited Object.prototype member used where a payload-chosen
  // string indexes a table. The name checks never fired — nothing is polluted —
  // so the lookup resolved a function and the caller read `.props` off it,
  // taking the whole surface down. The registries now inherit nothing, so these
  // resolve to `undefined` and travel the ordinary unknown-name path.
  it('an inherited member as a component name is UNKNOWN_COMPONENT, not a crash', () => {
    const proc = applyAll(attacks.inheritedComponentName);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
  });

  it('the same with a prop present also reports UNKNOWN_COMPONENT', () => {
    const proc = applyAll(attacks.inheritedComponentNameWithProp);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
  });

  it('an inherited member reaching the componentChecks table is UNKNOWN_COMPONENT', () => {
    const proc = applyAll(attacks.inheritedComponentCheck);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
  });

  it('an inherited member as a prop name is UNKNOWN_PROP and is not stored', () => {
    const proc = applyAll(attacks.inheritedPropKey);
    expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_PROP);
    const root = proc.surfaces.get('in4')?.components.get('root');
    expect(root?.props.has('toString')).toBe(false);
    // The valid sibling prop still lands — the component is not collateral.
    expect(root?.props.get('text')).toBe('hi');
  });

  it('no lookup table in a SHIPPED catalog inherits from Object.prototype', () => {
    // The guarantee behind the four fixtures above, asserted structurally: a
    // per-attack test only covers the names someone thought to write down.
    //
    // Enumerated from the catalogs rather than listed by hand, because the first
    // version of this test named three tables, passed, and left a fourth
    // (`urbicon.componentChecks`) inheriting in the tree — the very drift it
    // exists to catch. Both catalogs, every `props` table, both icon maps.
    const specs = [basicA2uiCatalogSpec, urbiconA2uiCatalogSpec];
    const tables: Array<[string, object | undefined]> = [];

    for (const spec of specs) {
      tables.push([`${spec.catalogId} registry`, spec.registry]);
      tables.push([`${spec.catalogId} componentChecks`, spec.componentChecks]);
      for (const [name, component] of Object.entries(spec.registry)) {
        tables.push([`${spec.catalogId} ${name}.props`, component.props]);
      }
    }
    // The icon maps are NOT enumerable here: `createIcons` is a factory that
    // must run during component init (`resolveIcon` reads context), so it throws
    // outside one. They are covered in `A2UIView.svelte.test.ts`, where a
    // mounted view exercises the lookup that actually consumes them.

    // A guard that measures nothing is the failure mode being avoided here.
    expect(tables.length).toBeGreaterThan(40);
    for (const [label, table] of tables) {
      if (table === undefined) continue;
      expect(Object.getPrototypeOf(table), label).toBe(null);
    }
  });

  // F3 from the adversarial review, and the reason the engine does not trust how
  // a table was built: `A2uiCatalog` is a documented extension point, so a
  // consumer registering their own catalog writes plain object literals — as
  // anyone would — and #134 reproduced line-for-line against it. Hardening the
  // tables this package ships closed the instance; guarding the lookup closes
  // the class.
  describe('a consumer catalog built from plain object literals', () => {
    /** Deliberately NOT via `lookupTable` — this is the consumer's code. */
    const consumerCatalog: A2uiCatalogSpec = {
      catalogId: 'consumer/test',
      registry: {
        Note: { description: 'A note', props: { text: { kind: 'string', description: 'Body' } } }
      },
      iconNames: [],
      unsupportedComponents: new Set(),
      flexContainers: new Set(),
      componentChecks: {}
    };

    function applyTo(envelopes: readonly unknown[]) {
      const proc = createA2uiProcessor({ catalogs: [consumerCatalog] });
      envelopes.forEach((envelope, index) => {
        proc.apply(envelope, index);
      });
      return proc;
    }

    const surface = {
      version: '1.0',
      createSurface: { surfaceId: 'c', catalogId: 'consumer/test' }
    };
    const comps = (components: unknown[]) => ({
      version: '1.0',
      updateComponents: { surfaceId: 'c', components }
    });

    it('survives an inherited member as the component name', () => {
      expect(() =>
        applyTo([surface, comps([{ id: 'root', component: 'toString' }])])
      ).not.toThrow();
      const proc = applyTo([surface, comps([{ id: 'root', component: 'toString' }])]);
      expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
    });

    it('survives the same with a prop present', () => {
      const run = () => applyTo([surface, comps([{ id: 'r', component: 'valueOf', text: 'x' }])]);
      expect(run).not.toThrow();
      expect(codes(allIssues(run()))).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
    });

    it('survives an inherited member as a prop name on a valid component', () => {
      const run = () =>
        applyTo([
          surface,
          comps([{ id: 'root', component: 'Note', text: 'hi', toString: 'evil' }])
        ]);
      expect(run).not.toThrow();
      const proc = run();
      expect(codes(allIssues(proc))).toContain(A2UI_ISSUE_CODES.UNKNOWN_PROP);
      expect(proc.surfaces.get('c')?.components.get('root')?.props.get('text')).toBe('hi');
    });

    it('survives an inherited member reaching componentChecks', () => {
      const run = () => applyTo([surface, comps([{ id: 'root', component: 'hasOwnProperty' }])]);
      expect(run).not.toThrow();
      expect(codes(allIssues(run()))).toContain(A2UI_ISSUE_CODES.UNKNOWN_COMPONENT);
    });
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
  const V = '1.0';
  const surface = (id = 's') => ({
    version: V,
    createSurface: { surfaceId: id, catalogId: A2UI_CATALOG_ID }
  });
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
      comps([{ id: 'root', component: 'Text', text: { '@call': 'now', args: {} } }])
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
      comps([{ id: 'root', component: 'Text', text: { '@path': '/__proto__/x' } }])
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
          value: { '@path': '/c' },
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

// ── Logic functions and surface requirements (Urbicon catalog: Button.disabled) ──

const V1 = '1.0';

/** Apply one Urbicon surface built from `components`, with optional requirements. */
function urbiconSurface(
  components: unknown[],
  options: { surfaceRequirements?: A2uiSurfaceRequirements; surfaceId?: string } = {}
): A2uiProcessor {
  const surfaceId = options.surfaceId ?? 's';
  const proc = createA2uiProcessor({
    catalogs: [urbiconA2uiCatalogSpec],
    surfaceRequirements: options.surfaceRequirements
  });
  proc.apply({ version: V1, createSurface: { surfaceId, catalogId: URBICON_A2UI_CATALOG_ID } }, 0);
  proc.apply({ version: V1, updateComponents: { surfaceId, components } }, 1);
  return proc;
}

const not = (value: unknown) => ({ '@call': 'not', args: { value } });
const and = (...values: unknown[]) => ({ '@call': 'and', args: { values } });
const or = (...values: unknown[]) => ({ '@call': 'or', args: { values } });

describe('logic-function bindings (not / and / or)', () => {
  const gatedButton = (disabled: unknown): unknown[] => [
    {
      id: 'root',
      component: 'Button',
      child: 'label',
      action: { event: { name: 'book' } },
      disabled
    },
    { id: 'label', component: 'Text', text: 'Book' }
  ];
  const DISABLED = '/messages/1/updateComponents/components/0/disabled';
  const storedDisabled = (proc: A2uiProcessor) =>
    proc.surfaces.get('s')?.components.get('root')?.props.get('disabled');

  it('stores a well-formed gate on Button.disabled without an issue', () => {
    const gate = not({ '@path': '/agreed' });
    const proc = urbiconSurface(gatedButton(gate));
    expect(allIssues(proc)).toEqual([]);
    expect(storedDisabled(proc)).toEqual(gate);
  });

  it('stores nested and / or', () => {
    const gate = not(and({ '@path': '/agreed' }, or({ '@path': '/email' }, { '@path': '/phone' })));
    const proc = urbiconSurface(gatedButton(gate));
    expect(allIssues(proc)).toEqual([]);
    expect(storedDisabled(proc)).toEqual(gate);
  });

  const malformed: Array<[string, unknown, string, string]> = [
    ['no args', { '@call': 'not' }, A2UI_ISSUE_CODES.MISSING_FIELD, '/args'],
    ['no operand', { '@call': 'not', args: {} }, A2UI_ISSUE_CODES.MISSING_FIELD, '/args/value'],
    [
      'an unknown arg key',
      { '@call': 'not', args: { value: true, other: 1 } },
      A2UI_ISSUE_CODES.UNKNOWN_PROP,
      '/args/other'
    ],
    [
      'an unknown key on the call',
      { ...not(true), when: 'now' },
      A2UI_ISSUE_CODES.UNKNOWN_PROP,
      '/when'
    ],
    [
      'a returnType, which A2UI 1.0 took off the wire',
      { ...not(true), returnType: 'boolean' },
      A2UI_ISSUE_CODES.UNKNOWN_PROP,
      '/returnType'
    ],
    [
      'an operand written as a pre-1.0 binding',
      not({ path: '/agreed' }),
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/value'
    ],
    [
      'a catalogId that names no configured catalog',
      { ...not(true), catalogId: 'elsewhere' },
      A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
      '/catalogId'
    ],
    ['one operand for and', and(true), A2UI_ISSUE_CODES.TYPE_MISMATCH, '/args/values'],
    [
      'values that are not an array',
      { '@call': 'or', args: { values: true } },
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/values'
    ],
    ['a string operand', or(true, 'yes'), A2UI_ISSUE_CODES.TYPE_MISMATCH, '/args/values/1'],
    [
      'an unsupported function as an operand',
      and(true, { '@call': 'required', args: { value: { '@path': '/name' } } }),
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/values/1'
    ],
    [
      'a fault inside a nested call',
      not(and(true, { '@path': '/agreed' }, or(false))),
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/value/args/values/2/args/values'
    ],
    [
      'a poisoned operand path',
      not({ '@path': '/__proto__/x' }),
      A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
      '/args/value/@path'
    ],
    [
      'an own __proto__ arg key',
      JSON.parse('{"@call":"not","args":{"value":true,"__proto__":{"x":1}}}'),
      A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
      '/args/__proto__'
    ]
  ];
  for (const [name, gate, code, at] of malformed) {
    it(`reports a gate with ${name} as ${code} at its own path, and holds it closed`, () => {
      const proc = urbiconSurface(gatedButton(gate));
      const issues = allIssues(proc);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        code,
        surfaceId: 's',
        path: DISABLED + at
      });
      // Button.disabled's failsafe: a broken consent gate keeps the button disabled.
      expect(storedDisabled(proc)).toBe(true);
    });
  }

  it('holds a gate nested deeper than the limit closed', () => {
    let gate: unknown = true;
    for (let i = 0; i < A2UI_MAX_LOGIC_DEPTH + 1; i++) gate = not(gate);
    const proc = urbiconSurface(gatedButton(gate));
    expect(allIssues(proc).map((i) => [i.severity, i.code])).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH]
    ]);
    expect(storedDisabled(proc)).toBe(true);
  });

  it('caps the operands of one call tree, and holds a gate over the cap closed', () => {
    const wide = (count: number) => or(...Array.from({ length: count }, () => false));
    expect(allIssues(urbiconSurface(gatedButton(wide(A2UI_MAX_LOGIC_OPERANDS))))).toEqual([]);
    const over = urbiconSurface(gatedButton(wide(A2UI_MAX_LOGIC_OPERANDS + 1)));
    expect(allIssues(over).map((i) => [i.severity, i.code])).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH]
    ]);
    expect(storedDisabled(over)).toBe(true);
    // Counted across the tree, not per call: two calls of 40 are 82 operands.
    const nested = and(wide(40), wide(40));
    expect(codes(allIssues(urbiconSurface(gatedButton(nested))))).toEqual(
      new Set([A2UI_ISSUE_CODES.TYPE_MISMATCH])
    );
  });

  it('holds a gate naming any other function closed, at the top as nested', () => {
    // The shape of upstream's own button-gating example: `required` inside `and`.
    const upstream = not(
      and({ '@call': 'required', args: { value: { '@path': '/terms' } } }, { '@path': '/agreed' })
    );
    for (const gate of [{ '@call': 'required', args: { value: true } }, upstream]) {
      const proc = urbiconSurface(gatedButton(gate));
      const issues = allIssues(proc);
      expect(issues.map((i) => i.severity)).toEqual(['error']);
      expect(issues[0].message).toContain('"required"');
      expect(storedDisabled(proc)).toBe(true);
    }
  });

  it('holds the failsafe for any value a gate cannot use, not only a call', () => {
    const unusable: Array<[unknown, string]> = [
      ['true', A2UI_ISSUE_CODES.TYPE_MISMATCH],
      [{ '@path': '/__proto__/x' }, A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION]
    ];
    for (const [value, code] of unusable) {
      const proc = urbiconSurface(gatedButton(value));
      const issues = allIssues(proc);
      expect(issues.map((i) => [i.severity, i.code])).toEqual([['error', code]]);
      expect(issues[0].message).toContain('"disabled" is held at true');
      expect(storedDisabled(proc)).toBe(true);
    }
  });

  it('leaves a usable value on a gate as written', () => {
    for (const value of [false, { '@path': '/locked' }]) {
      const proc = urbiconSurface(gatedButton(value));
      expect(allIssues(proc)).toEqual([]);
      expect(storedDisabled(proc)).toEqual(value);
    }
  });

  it('keeps warning about any other function name outside a gate, as before', () => {
    const proc = urbiconSurface([
      { id: 'root', component: 'Text', text: { '@call': 'formatDate', args: {} } }
    ]);
    expect(allIssues(proc).map((i) => [i.severity, i.code])).toEqual([
      ['warning', A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED]
    ]);
  });

  describe('in action.event.context', () => {
    const withContext = (context: Record<string, unknown>) =>
      urbiconSurface([
        {
          id: 'root',
          component: 'Button',
          child: 'label',
          action: { event: { name: 'go', context } }
        },
        { id: 'label', component: 'Text', text: 'Go' }
      ]);
    const CONTEXT = '/messages/1/updateComponents/components/0/action/event/context';
    const storedAction = (proc: A2uiProcessor) =>
      proc.surfaces.get('s')?.components.get('root')?.props.get('action');

    it('accepts a well-formed call without an issue', () => {
      expect(allIssues(withContext({ ok: not({ '@path': '/agreed' }) }))).toEqual([]);
    });

    it('reports a malformed call as an error and keeps the action', () => {
      const proc = withContext({ ok: and(true) });
      expect(allIssues(proc)).toEqual([
        expect.objectContaining({
          severity: 'error',
          code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
          path: `${CONTEXT}/ok/args/values`
        })
      ]);
      expect(storedAction(proc)).toBeDefined();
    });

    it('warns about any other function, as a prop does', () => {
      const proc = withContext({ when: { '@call': 'formatDate', args: {} } });
      expect(allIssues(proc).map((i) => [i.severity, i.code, i.path])).toEqual([
        ['warning', A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED, `${CONTEXT}/when`]
      ]);
      expect(storedAction(proc)).toBeDefined();
    });
  });

  it("refuses a logic call on an input's two-way value", () => {
    const proc = urbiconSurface([
      { id: 'root', component: 'Checkbox', label: 'All', value: not({ '@path': '/none' }) }
    ]);
    expect(allIssues(proc).find((i) => i.code === A2UI_ISSUE_CODES.TYPE_MISMATCH)).toMatchObject({
      severity: 'error',
      path: '/messages/1/updateComponents/components/0/value'
    });
  });

  it('refuses a logic call in a prop that is not a boolean', () => {
    const proc = urbiconSurface([{ id: 'root', component: 'Text', text: not(true) }]);
    expect(allIssues(proc).find((i) => i.code === A2UI_ISSUE_CODES.TYPE_MISMATCH)).toMatchObject({
      severity: 'error',
      path: '/messages/1/updateComponents/components/0/text'
    });
  });

  it('refuses a logic call as an option label', () => {
    const proc = urbiconSurface([
      {
        id: 'root',
        component: 'RadioGroup',
        value: { '@path': '/pick' },
        options: [
          { label: not(true), value: 'a' },
          { label: 'B', value: 'b' }
        ]
      }
    ]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
  });

  it('is accepted nowhere in the Basic catalog, whose one dynamic boolean is a two-way value', () => {
    const proc = applyAll([
      { version: V1, createSurface: { surfaceId: 's', catalogId: A2UI_CATALOG_ID } },
      {
        version: V1,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'root', component: 'CheckBox', label: 'All', value: not(true) }]
        }
      }
    ]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
  });
});

// Upstream's form of the consent gate: "Buttons can also define `@checks`. If any
// check fails, the button is automatically disabled."
describe('@checks where a gate reads them (Urbicon Button.disabled)', () => {
  const checkedButton = (checks: unknown, extra: Record<string, unknown> = {}): unknown[] => [
    {
      id: 'root',
      component: 'Button',
      child: 'label',
      action: { event: { name: 'book' } },
      '@checks': checks,
      ...extra
    },
    { id: 'label', component: 'Text', text: 'Book' }
  ];
  const CHECKS = '/messages/1/updateComponents/components/0/@checks';
  const OK = { '@path': '/ok' };
  const stored = (proc: A2uiProcessor, key: string) =>
    proc.surfaces.get('s')?.components.get('root')?.props.get(key);
  const rule = (condition: unknown) => ({ condition, message: 'Accept the policy' });
  const required = (path: string) => ({ '@call': 'required', args: { value: { '@path': path } } });

  it('stores usable rules as written and leaves disabled alone', () => {
    for (const condition of [
      { '@path': '/agreed' },
      and({ '@path': '/agreed' }, or({ '@path': '/email' }, { '@path': '/phone' }))
    ]) {
      // A2UI 1.0 made the message optional.
      for (const checks of [[rule(condition)], [{ condition }]]) {
        const proc = urbiconSurface(checkedButton(checks));
        expect(allIssues(proc)).toEqual([]);
        expect(stored(proc, '@checks')).toEqual(checks);
        expect(stored(proc, 'disabled')).toBeUndefined();
      }
    }
    expect(allIssues(urbiconSurface(checkedButton([])))).toEqual([]);
  });

  const unusable: Array<[string, unknown, string, string]> = [
    ['a value that is not a list', rule(OK), A2UI_ISSUE_CODES.TYPE_MISMATCH, ''],
    ['a rule that is not an object', ['yes'], A2UI_ISSUE_CODES.TYPE_MISMATCH, '/0'],
    [
      'the call written in place of { condition }',
      [{ ...required('/terms'), message: 'Required' }],
      A2UI_ISSUE_CODES.UNKNOWN_PROP,
      '/0/@call'
    ],
    [
      'an own __proto__ key on a rule',
      [JSON.parse('{"condition":true,"message":"m","__proto__":{"x":1}}')],
      A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
      '/0/__proto__'
    ],
    ['no condition', [{ message: 'm' }], A2UI_ISSUE_CODES.MISSING_FIELD, '/0/condition'],
    [
      'a message that is not a string',
      [{ condition: OK, message: 1 }],
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/0/message'
    ],
    // A2UI 1.0: a condition is a binding or a call, never a literal.
    ['a literal condition', [rule(true)], A2UI_ISSUE_CODES.TYPE_MISMATCH, '/0/condition'],
    [
      'a condition written as a pre-1.0 binding',
      [rule({ path: '/agreed' })],
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/0/condition'
    ],
    [
      'a condition naming another function',
      [rule(required('/terms'))],
      A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED,
      '/0/condition'
    ],
    [
      "upstream's own example, required inside and",
      [rule(and(required('/terms'), or(required('/email'), required('/phone'))))],
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/0/condition/args/values/0'
    ],
    ['a string condition', [rule('true')], A2UI_ISSUE_CODES.TYPE_MISMATCH, '/0/condition'],
    [
      'a poisoned condition path',
      [rule({ '@path': '/__proto__/x' })],
      A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
      '/0/condition'
    ],
    [
      'a malformed logic call',
      [rule(OK), rule(and(true))],
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/1/condition/args/values'
    ]
  ];
  for (const [name, checks, code, at] of unusable) {
    it(`reports ${name} as ${code} at its own path, and holds disabled at true`, () => {
      const proc = urbiconSurface(checkedButton(checks));
      const issues = allIssues(proc);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        severity: 'error',
        code,
        surfaceId: 's',
        path: CHECKS + at
      });
      expect(issues[0].message).toContain('"disabled" is held at true until it is fixed');
      expect(stored(proc, 'disabled')).toBe(true);
      expect(stored(proc, '@checks')).toBeUndefined();
    });
  }

  it('names the logic functions it does evaluate when a condition calls another', () => {
    const [issue] = allIssues(urbiconSurface(checkedButton([rule(required('/terms'))])));
    expect(issue.message).toContain('"required" is not supported (only not, and, or');
  });

  it('reports every rule that cannot be used, not only the first', () => {
    const proc = urbiconSurface(
      checkedButton([rule('x'), rule(OK), { condition: OK, message: 1 }])
    );
    expect(allIssues(proc).map((i) => i.path)).toEqual([
      `${CHECKS}/0/condition`,
      `${CHECKS}/2/message`
    ]);
  });

  // One cap for the whole list, counted as for `and(condition, …)`: the gate
  // re-evaluates every condition on every render.
  describe('holds all its conditions to one operand cap, counted as one and', () => {
    const MAX = A2UI_MAX_LOGIC_OPERANDS;
    const bare = (count: number) => Array.from({ length: count }, () => rule(OK));
    const wide = (count: number) => or(...Array.from({ length: count }, () => false));
    const fits: Array<[string, unknown[]]> = [
      ['one bare condition per operand', bare(MAX)],
      ['one call, counted with its operands', [rule(wide(MAX - 1))]],
      ['calls and bare conditions together', [...bare(MAX - 3), rule(and(true, true))]]
    ];
    for (const [name, checks] of fits) {
      it(`stores ${name}, exactly at the cap`, () => {
        const proc = urbiconSurface(checkedButton(checks));
        expect(allIssues(proc)).toEqual([]);
        expect(stored(proc, '@checks')).toEqual(checks);
      });
    }
    const over: Array<[string, unknown[]]> = [
      ['more rules than the cap', bare(MAX + 1)],
      ['the widest call disabled takes, one more as a condition', [rule(wide(MAX))]],
      ['two calls that each fit alone', [rule(wide(MAX / 2)), rule(wide(MAX / 2 - 1))]],
      ['a bare condition after a call at the cap', [rule(wide(MAX - 1)), rule(OK)]],
      ['a call after bare conditions at the cap', [...bare(MAX - 2), rule(and(true, true))]],
      ['every rule as wide as disabled may be', Array.from({ length: MAX }, () => rule(wide(MAX)))]
    ];
    for (const [name, checks] of over) {
      it(`refuses ${name} with one error on the list, and holds disabled at true`, () => {
        const proc = urbiconSurface(checkedButton(checks));
        const issues = allIssues(proc);
        expect(issues.map((i) => [i.severity, i.code, i.path])).toEqual([
          ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, CHECKS]
        ]);
        expect(issues[0].message).toContain(`holds more than ${MAX} operands in all`);
        expect(issues[0].message).toContain('"disabled" is held at true until it is fixed');
        expect(stored(proc, 'disabled')).toBe(true);
        expect(stored(proc, '@checks')).toBeUndefined();
      });
    }

    // Such rules fail before their condition counts against the cap, so only
    // the list's length can refuse them as one.
    it('refuses more rules than the cap with one error, though none has a condition', () => {
      const proc = urbiconSurface(
        checkedButton(Array.from({ length: MAX + 1 }, () => ({ message: 'm' })))
      );
      expect(allIssues(proc).map((i) => [i.severity, i.code, i.path])).toEqual([
        ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, CHECKS]
      ]);
      expect(stored(proc, 'disabled')).toBe(true);
    });
  });

  it('holds a condition nested deeper than a gate may be closed', () => {
    let condition: unknown = true;
    for (let i = 0; i < A2UI_MAX_LOGIC_DEPTH + 1; i++) condition = not(condition);
    expect(stored(urbiconSurface(checkedButton([rule(condition)])), 'disabled')).toBe(true);
  });

  it('holds disabled whichever order the payload lists the two in', () => {
    const broken = [rule(required('/terms'))];
    for (const order of [
      { '@checks': broken, disabled: false },
      { disabled: false, '@checks': broken }
    ]) {
      const proc = urbiconSurface([
        {
          id: 'root',
          component: 'Button',
          child: 'label',
          action: { event: { name: 'book' } },
          ...order
        },
        { id: 'label', component: 'Text', text: 'Book' }
      ]);
      expect(stored(proc, 'disabled')).toBe(true);
    }
  });

  it('stores a usable disabled beside usable checks', () => {
    const proc = urbiconSurface(
      checkedButton([rule({ '@path': '/agreed' })], { disabled: { '@path': '/locked' } })
    );
    expect(allIssues(proc)).toEqual([]);
    expect(stored(proc, 'disabled')).toEqual({ '@path': '/locked' });
  });

  it('ignores @checks where no gate reads them, in either catalog', () => {
    const urbicon = urbiconSurface([
      {
        id: 'root',
        component: 'Checkbox',
        label: 'I agree',
        value: { '@path': '/agreed' },
        '@checks': [rule('x')]
      }
    ]);
    const basic = applyAll([
      { version: V1, createSurface: { surfaceId: 's', catalogId: A2UI_CATALOG_ID } },
      {
        version: V1,
        updateComponents: {
          surfaceId: 's',
          components: [
            {
              id: 'root',
              component: 'Button',
              child: 'label',
              action: { event: { name: 'book' } },
              '@checks': [rule({ '@path': '/agreed' })]
            },
            { id: 'label', component: 'Text', text: 'Book' }
          ]
        }
      }
    ]);
    for (const proc of [urbicon, basic]) {
      expect(allIssues(proc).map((i) => [i.severity, i.code])).toEqual([
        ['warning', A2UI_ISSUE_CODES.IGNORED_PROP]
      ]);
      expect(stored(proc, '@checks')).toBeUndefined();
    }
  });

  // `@checks` belongs to the protocol, so a catalog decides one thing only:
  // whether a gate of its component reads it (`readsChecks`).
  describe('on a consumer catalog whose gate has a failsafe', () => {
    const gate = { kind: 'boolean', dynamic: true, failsafe: true, description: 'Gate.' } as const;
    const catalog = (props: Record<string, A2uiPropSpec> = {}): A2uiCatalogSpec => ({
      catalogId: 'consumer/gated',
      registry: {
        Go: {
          description: 'A consumer button.',
          props: { label: { kind: 'string', description: 'Label.' }, disabled: gate, ...props }
        }
      },
      iconNames: [],
      unsupportedComponents: new Set(),
      flexContainers: new Set()
    });
    const apply = (spec: A2uiCatalogSpec, extra: Record<string, unknown>): A2uiProcessor => {
      const proc = createA2uiProcessor({ catalogs: [spec] });
      proc.apply(
        { version: V1, createSurface: { surfaceId: 's', catalogId: 'consumer/gated' } },
        0
      );
      proc.apply(
        {
          version: V1,
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'root', component: 'Go', label: 'Go', ...extra }]
          }
        },
        1
      );
      return proc;
    };
    const rules = [rule({ '@path': '/agreed' })];
    const summary = (proc: A2uiProcessor) => allIssues(proc).map((i) => [i.severity, i.code]);

    it('ignores @checks with a warning while no gate declares readsChecks', () => {
      const proc = apply(catalog(), { '@checks': rules });
      expect(summary(proc)).toEqual([['warning', A2UI_ISSUE_CODES.IGNORED_PROP]]);
      expect(stored(proc, '@checks')).toBeUndefined();
      expect(stored(proc, 'disabled')).toBeUndefined();
    });

    it('reports a bare checks as an unknown prop, and says how 1.0 writes it', () => {
      const proc = apply(catalog(), { checks: rules });
      expect(summary(proc)).toEqual([['error', A2UI_ISSUE_CODES.UNKNOWN_PROP]]);
      expect(allIssues(proc)[0].message).toContain('A2UI 1.0 writes it "@checks"');
      expect(stored(proc, 'checks')).toBeUndefined();
    });

    // The `@` namespace is what frees the bare name for a catalog.
    it("stores a component's own checks prop beside the mixin", () => {
      const own = catalog({
        checks: { kind: 'stringList', description: 'Tick marks.' },
        disabled: { ...gate, readsChecks: true }
      });
      const proc = apply(own, { checks: ['a', 'b'], '@checks': rules });
      expect(summary(proc)).toEqual([]);
      expect(stored(proc, 'checks')).toEqual(['a', 'b']);
      expect(stored(proc, '@checks')).toEqual(rules);
    });

    it('takes @checks as part of the gate once the gate declares readsChecks', () => {
      const asked = catalog({ disabled: { ...gate, readsChecks: true } });
      expect(summary(apply(asked, { '@checks': rules }))).toEqual([]);
      expect(stored(apply(asked, { '@checks': rules }), '@checks')).toEqual(rules);
      const broken = apply(asked, { '@checks': [rule(required('/agreed'))] });
      expect(summary(broken)).toEqual([['error', A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED]]);
      expect(stored(broken, 'disabled')).toBe(true);
    });

    it('holds the gate when a bare checks stands where @checks belongs', () => {
      const asked = catalog({ disabled: { ...gate, readsChecks: true } });
      const proc = apply(asked, { checks: rules, disabled: false });
      expect(summary(proc)).toEqual([['error', A2UI_ISSUE_CODES.UNKNOWN_PROP]]);
      expect(allIssues(proc)[0].message).toContain('"disabled" is held at true until it is fixed');
      expect(stored(proc, 'disabled')).toBe(true);
    });

    // A valid `@checks` beside it must not release what the bare one holds.
    it.each([
      ['before', { checks: rules, '@checks': rules }],
      ['after', { '@checks': rules, checks: rules }]
    ])('holds the gate when the bare checks comes %s a valid @checks', (_order, keys) => {
      const asked = catalog({ disabled: { ...gate, readsChecks: true } });
      expect(stored(apply(asked, keys), 'disabled')).toBe(true);
    });

    // A prop without a failsafe has nothing to be held at: holding it would
    // write `undefined` over the payload's value, which renders it open.
    it('ignores @checks where readsChecks sits on a prop that is no gate', () => {
      const notGate = catalog({
        disabled: { kind: 'boolean', dynamic: true, readsChecks: true, description: 'No gate.' }
      });
      const proc = apply(notGate, { '@checks': [rule(required('/agreed'))], disabled: true });
      expect(stored(proc, 'disabled')).toBe(true);
      expect(summary(proc)).toEqual([['warning', A2UI_ISSUE_CODES.IGNORED_PROP]]);
    });
  });
});

describe('surface requirements', () => {
  const consent: A2uiSurfaceRequirements = {
    booking: [{ component: 'Checkbox', path: '/agreed', description: 'consent to the policy' }]
  };
  const consentBox = (value: unknown = { '@path': '/agreed' }) => ({
    id: 'agree',
    component: 'Checkbox',
    label: 'I agree',
    value
  });
  /** A booking form whose root lists `children` after an intro, plus `extra` definitions. */
  const form = (children: string[], ...extra: unknown[]): unknown[] => [
    { id: 'root', component: 'Column', children: ['intro', ...children] },
    { id: 'intro', component: 'Text', text: 'Book a stay' },
    ...extra
  ];
  const missing = (issues: A2uiValidationIssue[]) =>
    issues.filter((i) => i.code === A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT);
  const booking = (components: unknown[], requirements = consent) =>
    urbiconSurface(components, { surfaceRequirements: requirements, surfaceId: 'booking' });

  it('reports a missing required component once, as an error, when the surface settles', () => {
    expect(missing(allIssues(booking(form([]))))).toEqual([
      {
        severity: 'error',
        code: A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT,
        surfaceId: 'booking',
        message:
          'Surface "booking" must contain a Checkbox with value bound to { "@path": "/agreed" } (consent to the policy); none renders from "root" (a fault chip or a hidden one does not count)'
      }
    ]);
  });

  it('stays silent mid-stream', () => {
    expect(missing(allIssues(booking(form([])), true))).toEqual([]);
  });

  it('is met by a reachable component bound to the pointer', () => {
    expect(allIssues(booking(form(['agree'], consentBox())))).toEqual([]);
  });

  it('matches the pointer with empty segments collapsed, as the binding reads it', () => {
    expect(allIssues(booking(form(['agree'], consentBox({ '@path': '//agreed/' }))))).toEqual([]);
  });

  // The view renders a hidden component inert, so the user cannot tick it.
  it.each([
    ['literally', true],
    ['through a binding', { '@path': '/hide' }]
  ])('does not count one that is hidden %s', (_label, hidden) => {
    const box = { ...consentBox(), '@accessibility': { hidden } };
    const proc = booking(form(['agree'], box));
    proc.apply(
      { version: V1, updateDataModel: { surfaceId: 'booking', path: '/hide', value: true } },
      9
    );
    expect(missing(allIssues(proc))).toHaveLength(1);
  });

  it('counts one whose hidden resolves to false', () => {
    const box = { ...consentBox(), '@accessibility': { hidden: { '@path': '/hide' } } };
    expect(missing(allIssues(booking(form(['agree'], box))))).toEqual([]);
  });

  // The inert wrapper covers everything inside the component that declares it.
  it.each([
    ['literally', true],
    ['through a binding', { '@path': '/hide' }]
  ])('does not count one inside a container that is hidden %s', (_label, hidden) => {
    const proc = booking(
      form(
        ['box'],
        { id: 'box', component: 'Column', children: ['agree'], '@accessibility': { hidden } },
        consentBox()
      )
    );
    proc.apply(
      { version: V1, updateDataModel: { surfaceId: 'booking', path: '/hide', value: true } },
      9
    );
    expect(missing(allIssues(proc))).toHaveLength(1);
  });

  it('does not count one under a hidden root', () => {
    const proc = booking([
      {
        id: 'root',
        component: 'Column',
        children: ['agree'],
        '@accessibility': { hidden: true }
      },
      consentBox()
    ]);
    expect(missing(allIssues(proc))).toHaveLength(1);
  });

  it.each([
    ['its own', ['agree']],
    ["its template item's", ['item', 'agree']]
  ])('does not count one hidden by %s relative binding', (_label, chain) => {
    const hidden = { '@accessibility': { hidden: { '@path': 'hide' } } };
    const rows = (hide: boolean) => {
      const proc = booking(
        [
          { id: 'root', component: 'Column', children: { componentId: chain[0], path: '/rows' } },
          ...(chain.length === 2
            ? [{ id: 'item', component: 'Column', children: ['agree'], ...hidden }]
            : []),
          { ...consentBox({ '@path': 'agreed' }), ...(chain.length === 1 ? hidden : {}) }
        ],
        { booking: [{ component: 'Checkbox', path: '/rows/0/agreed' }] }
      );
      proc.apply(
        { version: V1, updateDataModel: { surfaceId: 'booking', value: { rows: [{ hide }] } } },
        2
      );
      return missing(allIssues(proc));
    };
    expect(rows(false)).toEqual([]);
    expect(rows(true)).toHaveLength(1);
  });

  it('counts one inside a container whose hidden resolves to false', () => {
    const box = {
      id: 'box',
      component: 'Column',
      children: ['agree'],
      '@accessibility': { hidden: { '@path': '/hide' } }
    };
    expect(missing(allIssues(booking(form(['box'], box, consentBox()))))).toEqual([]);
  });

  it('does not count a component that is defined but never reached from root', () => {
    expect(missing(allIssues(booking(form([], consentBox()))))).toHaveLength(1);
  });

  it('does not count one bound elsewhere, or holding a literal', () => {
    const elsewhere = booking(form(['agree'], consentBox({ '@path': '/other' })));
    expect(missing(allIssues(elsewhere))).toHaveLength(1);
    expect(missing(allIssues(booking(form(['agree'], consentBox(false)))))).toHaveLength(1);
  });

  it('resolves a relative binding against its template item before matching', () => {
    const rows = (pointer: string, withItem: boolean) => {
      const proc = booking(
        [
          { id: 'root', component: 'Column', children: { componentId: 'agree', path: '/rows' } },
          consentBox({ '@path': 'agreed' })
        ],
        { booking: [{ component: 'Checkbox', path: pointer }] }
      );
      if (withItem) {
        proc.apply(
          { version: V1, updateDataModel: { surfaceId: 'booking', value: { rows: [{}] } } },
          2
        );
      }
      return proc;
    };
    expect(missing(allIssues(rows('/rows/0/agreed', true)))).toEqual([]);
    expect(missing(allIssues(rows('/agreed', true)))).toHaveLength(1);
    // No item yet: the template renders nothing, so nothing meets the requirement.
    expect(missing(allIssues(rows('/rows/0/agreed', false)))).toHaveLength(1);
  });

  it('matches by name alone without a path, and through a named prop', () => {
    const withButton = form(
      ['go'],
      {
        id: 'go',
        component: 'Button',
        child: 'goLabel',
        action: { event: { name: 'go' } },
        disabled: { '@path': '/locked' }
      },
      { id: 'goLabel', component: 'Text', text: 'Go' }
    );
    expect(allIssues(booking(withButton, { booking: [{ component: 'Button' }] }))).toEqual([]);
    expect(
      allIssues(
        booking(withButton, {
          booking: [{ component: 'Button', prop: 'disabled', path: '/locked' }]
        })
      )
    ).toEqual([]);
  });

  // First come, first served would give b1 to the `/a` entry and leave
  // `label → /l` with nothing; only b1 can meet that one.
  it('matches entries to components as a whole, not first come first served', () => {
    const proc = booking(
      [
        { id: 'root', component: 'Column', children: ['b1', 'b2'] },
        { id: 'b1', component: 'Checkbox', label: { '@path': '/l' }, value: { '@path': '/a' } },
        { id: 'b2', component: 'Checkbox', label: 'x', value: { '@path': '/a' } }
      ],
      {
        booking: [
          { component: 'Checkbox', path: '/a' },
          { component: 'Checkbox', prop: 'label', path: '/l' }
        ]
      }
    );
    expect(allIssues(proc)).toEqual([]);
  });

  it('spends one rendered component on one requirement', () => {
    const twoBoxes = {
      booking: [
        { component: 'Checkbox', description: 'privacy' },
        { component: 'Checkbox', path: '/agreed', description: 'policy' }
      ]
    };
    // One box: the bound entry takes it, so the name-only one is still missing.
    const one = missing(allIssues(booking(form(['agree'], consentBox()), twoBoxes)));
    expect(one.map((i) => i.message)).toEqual([expect.stringContaining('(privacy)')]);
    const second = { ...consentBox({ '@path': '/privacy' }), id: 'privacy' };
    expect(allIssues(booking(form(['privacy', 'agree'], consentBox(), second), twoBoxes))).toEqual(
      []
    );
  });

  it('reports each unmet requirement separately', () => {
    const both = { booking: [{ component: 'Checkbox', path: '/agreed' }, { component: 'Button' }] };
    expect(missing(allIssues(booking(form([]), both)))).toHaveLength(2);
  });

  it('leaves surfaces without an entry alone, including one named after an inherited member', () => {
    for (const surfaceId of ['chat', 'toString', '__defineGetter__']) {
      const proc = urbiconSurface(form([]), { surfaceRequirements: consent, surfaceId });
      expect(missing(allIssues(proc))).toEqual([]);
    }
  });

  // The prompt section lists own entries only (`Object.entries`), so an entry
  // the model was never told about must not be checked either.
  it('checks no entry the requirements object only inherits, as the prompt never states one', () => {
    const inherited: A2uiSurfaceRequirements = Object.create(consent);
    expect(a2uiSurfaceRequirementsSection(inherited, urbiconA2uiCatalogSpec)).toBe('');
    expect(allIssues(booking(form([]), inherited))).toEqual([]);
  });

  it('reports only MISSING_ROOT for a settled surface without a root', () => {
    const proc = booking([{ id: 'intro', component: 'Text', text: 'x' }]);
    expect(allIssues(proc).map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.MISSING_ROOT]);
  });

  // The user sees a fault chip there, not a consent box.
  it('does not count a component that renders as a fault chip', () => {
    for (const label of [undefined, 42, not(true)]) {
      const box = { id: 'agree', component: 'Checkbox', value: { '@path': '/agreed' }, label };
      expect(missing(allIssues(booking(form(['agree'], box))))).toHaveLength(1);
    }
  });

  it('tolerates a hand-built surface state without requirements', () => {
    const surface = booking(form([])).surfaces.get('booking');
    if (!surface) throw new Error('surface missing');
    const { requirements: _dropped, ...handBuilt } = surface;
    expect(collectGraphIssues(handBuilt)).toEqual([]);
  });

  describe('an entry the catalog can never meet', () => {
    const unmeetable: Array<[string, A2uiRequiredComponent, string]> = [
      ['a component the catalog lacks', { component: 'CheckBox' }, 'has no component "CheckBox"'],
      [
        'a prop the component does not declare',
        { component: 'Checkbox', prop: 'checked', path: '/agreed' },
        'declares no prop "checked"'
      ],
      [
        'a prop that takes no binding',
        { component: 'Text', prop: 'variant', path: '/style' },
        'cannot be bound'
      ],
      ['a relative path', { component: 'Checkbox', path: 'agreed' }, 'is relative'],
      [
        'the @checks a gate reads, which are no prop',
        { component: 'Button', prop: '@checks' },
        'declares no prop "@checks"'
      ]
    ];
    for (const [name, requirement, reason] of unmeetable) {
      it(`reports ${name} once, as INVALID_REQUIREMENT, and never asks the agent for it`, () => {
        // Built the way the requirement asks, as a model following it would.
        const proc = booking(
          form(['agree'], {
            ...consentBox({ '@path': 'agreed' }),
            checked: { '@path': '/agreed' }
          }),
          { booking: [requirement] }
        );
        const issues = allIssues(proc);
        const invalid = issues.filter((i) => i.code === A2UI_ISSUE_CODES.INVALID_REQUIREMENT);
        expect(invalid).toHaveLength(1);
        expect(invalid[0]).toMatchObject({ severity: 'warning', surfaceId: 'booking' });
        expect(invalid[0].message).toContain(reason);
        expect(missing(issues)).toEqual([]);
      });
    }

    it('keeps checking the entries beside it', () => {
      const proc = booking(form([]), {
        booking: [{ component: 'CheckBox' }, { component: 'Checkbox', path: '/agreed' }]
      });
      expect(codes(allIssues(proc))).toEqual(
        new Set([A2UI_ISSUE_CODES.INVALID_REQUIREMENT, A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT])
      );
    });
  });

  // Which catalog a surface defaults to is the agent's choice, and so is the
  // catalog of each component on it.
  describe('when the surface defaults to a catalog that cannot hold the entry', () => {
    const onCatalog = (
      catalogId: string | undefined,
      components: unknown[],
      requirements = consent
    ) => {
      const proc = createA2uiProcessor({
        catalogs: [basicA2uiCatalogSpec, urbiconA2uiCatalogSpec],
        surfaceRequirements: requirements
      });
      proc.apply({ version: V1, createSurface: { surfaceId: 'booking', catalogId } }, 0);
      proc.apply({ version: V1, updateComponents: { surfaceId: 'booking', components } }, 1);
      return proc;
    };
    const noConsent = [
      { id: 'root', component: 'Column', children: ['note'] },
      { id: 'note', component: 'Text', text: 'Three nights in Cala' }
    ];

    for (const catalogId of [basicA2uiCatalogSpec.catalogId, A2UI_UPSTREAM_BASIC_CATALOG_ID]) {
      it(`keeps it checked on "${catalogId}" and names the catalog that can hold it`, () => {
        const issues = allIssues(onCatalog(catalogId, noConsent));
        expect(codes(issues).has(A2UI_ISSUE_CODES.INVALID_REQUIREMENT)).toBe(false);
        const errors = issues.filter((i) => i.severity === 'error');
        expect(errors.map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT]);
        expect(errors[0].message).toContain(
          `give the component "@catalogId": "${URBICON_A2UI_CATALOG_ID}"`
        );
      });
    }

    it('is met by a component that names the other catalog itself', () => {
      const mixed = [
        { id: 'root', component: 'Column', children: ['agree'] },
        { ...consentBox(), '@catalogId': URBICON_A2UI_CATALOG_ID }
      ];
      expect(allIssues(onCatalog(basicA2uiCatalogSpec.catalogId, mixed))).toEqual([]);
    });

    it('is met on the catalog that can hold it', () => {
      const withConsent = [{ id: 'root', component: 'Column', children: ['agree'] }, consentBox()];
      expect(allIssues(onCatalog(URBICON_A2UI_CATALOG_ID, withConsent))).toEqual([]);
    });

    it('stays checked on a surface whose catalogId names no catalog', () => {
      const issues = allIssues(onCatalog('urbicon-ui/urbicon-catalog/v2', noConsent));
      expect(issues.filter((i) => i.severity === 'error').map((i) => i.code)).toEqual([
        A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
        A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT
      ]);
    });

    it("is the consumer's mistake only when no catalog can hold it", () => {
      const issues = allIssues(
        onCatalog(URBICON_A2UI_CATALOG_ID, noConsent, { booking: [{ component: 'Consent' }] })
      );
      expect(issues.map((i) => [i.severity, i.code])).toEqual([
        ['warning', A2UI_ISSUE_CODES.INVALID_REQUIREMENT]
      ]);
    });
  });
});

describe('DateTimeInput validation', () => {
  const surface = () => ({
    version: '1.0',
    createSurface: { surfaceId: 's', catalogId: A2UI_CATALOG_ID }
  });
  const comps = (components: unknown[]) => ({
    version: '1.0',
    updateComponents: { surfaceId: 's', components }
  });
  const dt = (props: Record<string, unknown>) =>
    comps([{ id: 'root', component: 'DateTimeInput', ...props }]);

  it('accepts the spec shape without issues', () => {
    const proc = applyAll([
      surface(),
      dt({
        value: { '@path': '/when' },
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
    const proc = applyAll([surface(), dt({ value: { '@path': '/when' } })]);
    const issues = allIssues(proc);
    expect(
      issues.some((i) => i.code === A2UI_ISSUE_CODES.DATETIME_NO_MODE && i.severity === 'warning')
    ).toBe(true);
  });

  it('rejects a non-boolean enableDate with TYPE_MISMATCH', () => {
    const proc = applyAll([surface(), dt({ value: { '@path': '/when' }, enableDate: 'yes' })]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
  });

  it('reports the missing required value', () => {
    const proc = applyAll([surface(), dt({ enableDate: true })]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.MISSING_FIELD)).toBe(true);
  });

  it('ignores the Checkable `@checks` mixin with a warning', () => {
    const proc = applyAll([
      surface(),
      dt({ value: { '@path': '/when' }, enableDate: true, '@checks': [{ rule: 'x' }] })
    ]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.IGNORED_PROP)).toBe(true);
  });
});

// ── A2UI 1.0 ─────────────────────────────────────────────────────────────────

const BOTH = [basicA2uiCatalogSpec, urbiconA2uiCatalogSpec];

/** Apply `envelopes` to a processor holding both shipped catalogs. */
function applyBoth(envelopes: readonly unknown[], dataSchema?: A2uiDataSchema): A2uiProcessor {
  const proc = createA2uiProcessor({ catalogs: BOTH, dataSchema });
  envelopes.forEach((envelope, index) => {
    proc.apply(envelope, index);
  });
  return proc;
}
const create = (body: Record<string, unknown> = {}) => ({
  version: '1.0',
  createSurface: { surfaceId: 's', catalogId: A2UI_CATALOG_ID, ...body }
});
const update = (components: unknown[]) => ({
  version: '1.0',
  updateComponents: { surfaceId: 's', components }
});
const COMPONENT = '/messages/1/updateComponents/components';
const instance = (proc: A2uiProcessor, id = 'root') => proc.surfaces.get('s')?.components.get(id);
const surfaceIssues = (proc: A2uiProcessor) => proc.surfaces.get('s')?.issues ?? [];
const summary = (issues: readonly A2uiValidationIssue[]) =>
  issues.map((i) => [i.severity, i.code, i.path]);

describe('protocol version', () => {
  it.each(['v0.9', 'v0.9.1', '1.1', 1, undefined])(
    'refuses version %j and applies nothing',
    (version) => {
      const proc = applyBoth([{ ...create(), version }]);
      expect(summary(proc.globalIssues)).toEqual([
        ['error', A2UI_ISSUE_CODES.INVALID_VERSION, '/messages/0/version']
      ]);
      expect(proc.globalIssues[0].message).toContain('expected "1.0"');
      expect(proc.surfaces.size).toBe(0);
    }
  );
});

describe('createSurface with inline content', () => {
  const text = (id: string, value: unknown) => ({ id, component: 'Text', text: value });

  it('builds the surface from one message', () => {
    const proc = applyBoth([
      create({ components: [text('root', { '@path': '/name' })], dataModel: { name: 'Ada' } })
    ]);
    expect(allIssues(proc)).toEqual([]);
    expect(proc.surfaces.get('s')?.dataModel).toEqual({ name: 'Ada' });
    expect(instance(proc)?.props.get('text')).toEqual({ '@path': '/name' });
  });

  it('applies the data model before the components, whatever order the keys have', () => {
    const proc = applyBoth([create({ components: [text('root', 7)], dataModel: 'x' })]);
    expect(summary(surfaceIssues(proc)).map(([, , path]) => path)).toEqual([
      '/messages/0/createSurface/dataModel',
      '/messages/0/createSurface/components/0/text',
      '/messages/0/createSurface/components/0/text'
    ]);
  });

  // Built iteratively: a literal this deep would overflow the parser of the test.
  const nested = (depth: number): Record<string, unknown> => {
    let value: Record<string, unknown> = {};
    for (let i = 0; i < depth; i++) value = { d: value };
    return value;
  };

  it('leaves no surface behind when the engine fails midway, so a retry builds it', () => {
    let throws = true;
    const flaky: A2uiCatalogSpec = {
      ...basicA2uiCatalogSpec,
      componentChecks: {
        Text: () => {
          if (throws) {
            throws = false;
            throw new Error('check failed');
          }
          return [];
        }
      }
    };
    const proc = createA2uiProcessor({ catalogs: [flaky] });
    const envelope = create({ components: [text('root', 'Hi')] });
    applyA2uiEnvelope(proc, envelope, 0);
    expect(proc.globalIssues.map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.ENGINE_ERROR]);
    expect(proc.surfaces.has('s')).toBe(false);
    applyA2uiEnvelope(proc, envelope, 1);
    expect(instance(proc)?.props.get('text')).toBe('Hi');
    expect(surfaceIssues(proc)).toEqual([]);
  });

  it('refuses a data model deeper than the limit, and the surface still renders', () => {
    const proc = applyBoth([
      create({ components: [text('root', 'Hi')], dataModel: nested(30_000) })
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.MAX_DEPTH, '/messages/0/createSurface/dataModel']
    ]);
    expect(proc.surfaces.get('s')?.dataModel).toBeUndefined();
    expect(instance(proc)?.props.get('text')).toBe('Hi');
  });

  it('takes a data model at the limit', () => {
    const proc = applyBoth([create({ dataModel: nested(A2UI_MAX_DATA_DEPTH - 1) })]);
    expect(surfaceIssues(proc)).toEqual([]);
  });

  it.each([
    ['a deep value', '/a', nested(A2UI_MAX_DATA_DEPTH), 'value'],
    [
      'a deep path',
      `/${Array.from({ length: A2UI_MAX_DATA_DEPTH + 1 }, () => 'k').join('/')}`,
      1,
      'path'
    ]
  ])('refuses an updateDataModel with %s and writes nothing', (_label, path, value, at) => {
    const proc = applyBoth([
      create({ dataModel: { kept: true } }),
      { version: '1.0', updateDataModel: { surfaceId: 's', path, value } }
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.MAX_DEPTH, `/messages/1/updateDataModel/${at}`]
    ]);
    expect(proc.surfaces.get('s')?.dataModel).toEqual({ kept: true });
  });

  it.each([
    ['a new item far past the end of a list', '/items/50000000'],
    ['a new item above index 10000 of a list it would create', '/fresh/10001'],
    ['an index with a leading zero', '/items/01'],
    ['a path through a string', '/items/0/foo'],
    ['no leading "/"', 'invalid path [0]'],
    ['an escape RFC 6901 does not define', '/items~2']
  ])('refuses an updateDataModel to %s and writes nothing', (_label, path) => {
    const dataModel = { items: ['a', 'b', 'c'] };
    const proc = applyBoth([
      create({ dataModel }),
      { version: '1.0', updateDataModel: { surfaceId: 's', path, value: 'x' } }
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.POINTER_ERROR, '/messages/1/updateDataModel/path']
    ]);
    expect(proc.surfaces.get('s')?.dataModel).toEqual(dataModel);
  });

  it('appends to a list at its length and at "-"', () => {
    const proc = applyBoth([
      create({ dataModel: { items: ['a'] } }),
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/items/1', value: 'b' } },
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/items/-', value: 'c' } }
    ]);
    expect(surfaceIssues(proc)).toEqual([]);
    expect(proc.surfaces.get('s')?.dataModel).toEqual({ items: ['a', 'b', 'c'] });
  });

  it('writes an index past the end of a list, the gap left as holes, also in a list it creates', () => {
    const proc = applyBoth([
      create({ dataModel: { items: ['a', 'b', 'c'] } }),
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/items/5', value: 'f' } },
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/guests/1/name', value: 'Bo' } }
    ]);
    expect(surfaceIssues(proc)).toEqual([]);
    const model = proc.surfaces.get('s')?.dataModel as { items: unknown[]; guests: unknown[] };
    expect([model.items.length, 3 in model.items, 4 in model.items, model.items[5]]).toEqual([
      6,
      false,
      false,
      'f'
    ]);
    expect([model.guests.length, 0 in model.guests, model.guests[1]]).toEqual([
      2,
      false,
      { name: 'Bo' }
    ]);
  });

  it('replaces the whole model with a primitive, and refuses to write through it', () => {
    const proc = applyBoth([
      create({ dataModel: { kept: true } }),
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/', value: 1 } },
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/a', value: 2 } }
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.POINTER_ERROR, '/messages/2/updateDataModel/path']
    ]);
    expect(proc.surfaces.get('s')?.dataModel).toBe(1);
  });

  it('collapses the empty segments of a path', () => {
    const proc = applyBoth([
      create({ dataModel: { items: ['a'] } }),
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '/items/', value: ['b'] } },
      { version: '1.0', updateDataModel: { surfaceId: 's', path: '//note///text//', value: 'n' } }
    ]);
    expect(surfaceIssues(proc)).toEqual([]);
    expect(proc.surfaces.get('s')?.dataModel).toEqual({ items: ['b'], note: { text: 'n' } });
  });

  it('copies the data model, so a later edit never reaches the payload', () => {
    const dataModel = { form: { name: 'Ada' } };
    const proc = applyBoth([create({ dataModel })]);
    expect(proc.surfaces.get('s')?.dataModel).toEqual(dataModel);
    expect(proc.surfaces.get('s')?.dataModel).not.toBe(dataModel);
  });

  it('reports a component fault at its createSurface path', () => {
    const proc = applyBoth([create({ components: [text('root', 7)] })]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, '/messages/0/createSurface/components/0/text'],
      ['error', A2UI_ISSUE_CODES.MISSING_FIELD, '/messages/0/createSurface/components/0/text']
    ]);
  });

  it.each([[[] as unknown[]], ['root']])('refuses components %j', (components) => {
    expect(summary(surfaceIssues(applyBoth([create({ components })])))).toEqual([
      ['error', A2UI_ISSUE_CODES.MISSING_FIELD, '/messages/0/createSurface/components']
    ]);
  });

  it.each([[['a']], ['x'], [null]])('refuses a dataModel of %j', (dataModel) => {
    const proc = applyBoth([create({ dataModel })]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, '/messages/0/createSurface/dataModel']
    ]);
    expect(proc.surfaces.get('s')?.dataModel).toBeUndefined();
  });

  it('holds the inline data model to the data schema', () => {
    const proc = applyBoth([create({ dataModel: { nights: 'three' } })], {
      '/nights': { type: 'integer' }
    });
    expect(surfaceIssues(proc).map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.SCHEMA_TYPE_MISMATCH]);
  });

  it('refuses theme, which A2UI 1.0 removed, and still creates the surface', () => {
    const proc = applyBoth([create({ theme: { primaryColor: '#f00' } })]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.UNKNOWN_PROP, '/messages/0/createSurface/theme']
    ]);
    expect(proc.surfaces.has('s')).toBe(true);
  });

  it('takes metadata.extensions and reports nothing', () => {
    const proc = applyBoth([create({ metadata: { extensions: { com_acme_trace: { id: 7 } } } })]);
    expect(surfaceIssues(proc)).toEqual([]);
  });

  it.each([
    [{ extensions: { 'com-acme': 1 } }, A2UI_ISSUE_CODES.TYPE_MISMATCH, '/extensions/com-acme'],
    [{ extensions: { '1st': 1 } }, A2UI_ISSUE_CODES.TYPE_MISMATCH, '/extensions/1st'],
    [{ extensions: [] }, A2UI_ISSUE_CODES.TYPE_MISMATCH, '/extensions'],
    [{ tags: [] }, A2UI_ISSUE_CODES.UNKNOWN_PROP, '/tags'],
    ['x', A2UI_ISSUE_CODES.TYPE_MISMATCH, '']
  ])('refuses metadata %j', (metadata, code, at) => {
    expect(summary(surfaceIssues(applyBoth([create({ metadata })])))).toEqual([
      ['error', code, `/messages/0/createSurface/metadata${at}`]
    ]);
  });
});

describe('updateDataModel — null deletes', () => {
  const write = (body: Record<string, unknown>) => ({
    version: '1.0',
    updateDataModel: { surfaceId: 's', ...body }
  });
  const model = (envelopes: unknown[], dataSchema?: A2uiDataSchema) => {
    const proc = applyBoth(
      [create({ dataModel: { user: { name: 'Ada', bio: 'x' } } }), ...envelopes],
      dataSchema
    );
    return { proc, dataModel: proc.surfaces.get('s')?.dataModel };
  };

  it('removes the key and keeps its siblings', () => {
    expect(model([write({ path: '/user/bio', value: null })]).dataModel).toEqual({
      user: { name: 'Ada' }
    });
  });

  it('removes a whole branch', () => {
    expect(model([write({ path: '/user', value: null })]).dataModel).toEqual({});
  });

  it.each([[undefined], ['/'], ['']])('empties the model at the root path %j', (path) => {
    expect(model([write({ path, value: null })]).dataModel).toEqual({});
  });

  it('leaves a hole in an array, keeping its length', () => {
    const { dataModel } = model([
      write({ path: '/items', value: ['a', 'b', 'c'] }),
      write({ path: '/items/1', value: null })
    ]);
    const items = (dataModel as { items: unknown[] }).items;
    expect(items).toHaveLength(3);
    expect(JSON.stringify(items)).toBe('["a",null,"c"]');
  });

  it('keeps a null nested inside a written value', () => {
    expect(model([write({ path: '/user', value: { name: null } })]).dataModel).toEqual({
      user: { name: null }
    });
  });

  it('never reads a delete as a schema mismatch', () => {
    const { proc } = model([write({ path: '/user/name', value: null })], {
      '/user/name': { type: 'string' }
    });
    expect(surfaceIssues(proc)).toEqual([]);
  });
});

describe('catalog resolution', () => {
  const badge = (extra: Record<string, unknown> = {}) => ({
    id: 'tag',
    component: 'Badge',
    text: 'New',
    ...extra
  });
  const column = { id: 'root', component: 'Column', children: ['tag'] };

  it('resolves a component through the surface default', () => {
    const proc = applyBoth([create(), update([{ id: 'root', component: 'Text', text: 'x' }])]);
    expect(allIssues(proc)).toEqual([]);
    expect(instance(proc)?.catalog).toBe(basicA2uiCatalogSpec);
  });

  it('resolves the id upstream gives its basic catalog to the subset', () => {
    const proc = applyBoth([create({ catalogId: A2UI_UPSTREAM_BASIC_CATALOG_ID })]);
    expect(surfaceIssues(proc)).toEqual([]);
    expect(proc.surfaces.get('s')?.catalog).toBe(basicA2uiCatalogSpec);
  });

  it('mixes catalogs: a component with its own @catalogId beside default ones', () => {
    const proc = applyBoth([
      create(),
      update([column, badge({ '@catalogId': URBICON_A2UI_CATALOG_ID })])
    ]);
    expect(allIssues(proc)).toEqual([]);
    expect(instance(proc)?.catalog).toBe(basicA2uiCatalogSpec);
    expect(instance(proc, 'tag')?.catalog).toBe(urbiconA2uiCatalogSpec);
    expect(instance(proc, 'tag')?.props.has('@catalogId')).toBe(false);
  });

  it('validates each component against its own catalog', () => {
    // Badge is an Urbicon component: on the Basic default it is unknown.
    const proc = applyBoth([create(), update([column, badge()])]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.UNKNOWN_COMPONENT, `${COMPONENT}/1/component`]
    ]);
  });

  it('honours weight under a flex container of another catalog', () => {
    const proc = applyBoth([
      create(),
      update([
        { id: 'root', component: 'Row', children: ['tag'], '@catalogId': URBICON_A2UI_CATALOG_ID },
        { id: 'tag', component: 'Text', text: 'x', weight: 2 }
      ])
    ]);
    expect(allIssues(proc)).toEqual([]);
  });

  it('reports an unknown surface catalogId once, and falls back to nothing', () => {
    const proc = applyBoth([
      create({ catalogId: 'acme.com:catalog/v1' }),
      update([{ id: 'root', component: 'Text', text: 'x' }])
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.UNKNOWN_CATALOG, '/messages/0/createSurface/catalogId']
    ]);
    expect(proc.surfaces.get('s')?.catalog).toBeUndefined();
    expect(instance(proc)).toMatchObject({ component: 'Text', catalog: undefined });
    expect(instance(proc)?.props.size).toBe(0);
  });

  it('still renders a component that names a known catalog itself on such a surface', () => {
    const proc = applyBoth([
      create({ catalogId: 'acme.com:catalog/v1' }),
      update([{ id: 'root', component: 'Text', text: 'x', '@catalogId': A2UI_CATALOG_ID }])
    ]);
    expect(instance(proc)?.catalog).toBe(basicA2uiCatalogSpec);
    expect(instance(proc)?.props.get('text')).toBe('x');
  });

  it('reports each component that names no catalog on a surface without a default', () => {
    const proc = applyBoth([
      create({ catalogId: undefined }),
      update([
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Text', text: 'x', '@catalogId': A2UI_CATALOG_ID }
      ])
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.MISSING_FIELD, `${COMPONENT}/0/@catalogId`]
    ]);
    expect(instance(proc)?.catalog).toBeUndefined();
    expect(instance(proc, 'a')?.catalog).toBe(basicA2uiCatalogSpec);
  });

  it.each([
    ['elsewhere', A2UI_ISSUE_CODES.UNKNOWN_CATALOG],
    [7, A2UI_ISSUE_CODES.TYPE_MISMATCH]
  ])('does not render a component whose @catalogId is %j', (catalogId, code) => {
    const proc = applyBoth([
      create(),
      update([{ id: 'root', component: 'Text', text: 'x', '@catalogId': catalogId }])
    ]);
    expect(summary(surfaceIssues(proc))).toEqual([['error', code, `${COMPONENT}/0/@catalogId`]]);
    expect(instance(proc)?.catalog).toBeUndefined();
  });

  it('refuses a createSurface.catalogId that is no string', () => {
    const proc = applyBoth([create({ catalogId: 7 })]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, '/messages/0/createSurface/catalogId']
    ]);
  });

  describe('of a function call', () => {
    const gated = (disabled: unknown) => [
      {
        id: 'root',
        component: 'Button',
        '@catalogId': URBICON_A2UI_CATALOG_ID,
        child: 'label',
        action: { event: { name: 'go' } },
        disabled
      },
      { id: 'label', component: 'Text', text: 'Go', '@catalogId': URBICON_A2UI_CATALOG_ID }
    ];
    const call = (extra: Record<string, unknown> = {}) => ({
      ...not({ '@path': '/ok' }),
      ...extra
    });

    it('runs in the surface default when it names none', () => {
      const proc = applyBoth([create(), update(gated(call()))]);
      expect(allIssues(proc)).toEqual([]);
      expect(instance(proc)?.props.get('disabled')).toEqual(call());
    });

    it('is not evaluated on a surface without a default, and holds its gate closed', () => {
      const proc = applyBoth([create({ catalogId: undefined }), update(gated(call()))]);
      expect(summary(surfaceIssues(proc))).toEqual([
        ['error', A2UI_ISSUE_CODES.MISSING_FIELD, `${COMPONENT}/0/disabled/catalogId`]
      ]);
      expect(instance(proc)?.props.get('disabled')).toBe(true);
    });

    it('runs in the catalog it names there', () => {
      const named = call({ catalogId: URBICON_A2UI_CATALOG_ID });
      const proc = applyBoth([create({ catalogId: undefined }), update(gated(named))]);
      expect(allIssues(proc)).toEqual([]);
      expect(instance(proc)?.props.get('disabled')).toEqual(named);
    });
  });
});

describe('component envelope keys', () => {
  const withKeys = (keys: Record<string, unknown>) =>
    applyBoth([create(), update([{ id: 'root', component: 'Text', text: 'x', ...keys }])]);
  const A11Y = `${COMPONENT}/0/@accessibility`;

  it('stores a valid @accessibility whole', () => {
    const accessibility = {
      label: { '@path': '/name' },
      description: 'Updates as you type',
      live: 'polite',
      hidden: { '@path': '/collapsed' }
    };
    const proc = withKeys({ '@accessibility': accessibility });
    expect(allIssues(proc)).toEqual([]);
    expect(instance(proc)?.props.get('@accessibility')).toBe(accessibility);
  });

  it.each([
    ['a value that is no object', 'Name', A2UI_ISSUE_CODES.TYPE_MISMATCH, ''],
    ['an unknown key', { label: 'x', role: 'alert' }, A2UI_ISSUE_CODES.UNKNOWN_PROP, '/role'],
    ['a live value outside the enum', { live: 'rude' }, A2UI_ISSUE_CODES.UNKNOWN_ENUM, '/live'],
    ['a hidden that is no boolean', { hidden: 'yes' }, A2UI_ISSUE_CODES.TYPE_MISMATCH, '/hidden'],
    ['a label that is no string', { label: 7 }, A2UI_ISSUE_CODES.TYPE_MISMATCH, '/label'],
    [
      'a label written as a pre-1.0 binding',
      { label: { path: '/name' } },
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/label'
    ],
    [
      'a poisoned description path',
      { description: { '@path': '/__proto__/x' } },
      A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
      '/description'
    ]
  ])('drops an @accessibility with %s', (_name, accessibility, code, at) => {
    const proc = withKeys({ '@accessibility': accessibility });
    expect(summary(surfaceIssues(proc))).toEqual([['error', code, `${A11Y}${at}`]]);
    expect(instance(proc)?.props.has('@accessibility')).toBe(false);
    // The component itself is untouched.
    expect(instance(proc)?.props.get('text')).toBe('x');
  });

  it.each(['accessibility', 'checks', 'catalogId', 'metadata'])(
    'reports the bare key %s as unknown and says how 1.0 writes it',
    (key) => {
      const proc = withKeys({ [key]: {} });
      expect(summary(surfaceIssues(proc))).toEqual([
        ['error', A2UI_ISSUE_CODES.UNKNOWN_PROP, `${COMPONENT}/0/${key}`]
      ]);
      expect(surfaceIssues(proc)[0].message).toContain(`A2UI 1.0 writes it "@${key}"`);
    }
  );

  it('takes @metadata, stores nothing of it and reports nothing', () => {
    const proc = withKeys({ '@metadata': { extensions: { com_acme_tag: 'hero' } } });
    expect(allIssues(proc)).toEqual([]);
    expect([...(instance(proc)?.props.keys() ?? [])]).toEqual(['text']);
  });

  it('refuses a malformed @metadata', () => {
    const proc = withKeys({ '@metadata': { extensions: { 'not-an-identifier': 1 } } });
    expect(summary(surfaceIssues(proc))).toEqual([
      [
        'error',
        A2UI_ISSUE_CODES.TYPE_MISMATCH,
        `${COMPONENT}/0/@metadata/extensions/not-an-identifier`
      ]
    ]);
  });

  it.each(['@if', '@', '@style'])('refuses the unknown reserved key %s', (key) => {
    const proc = withKeys({ [key]: true });
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.INVALID_RESERVED_KEY, `${COMPONENT}/0/${key}`]
    ]);
    expect(instance(proc)?.props.has(key)).toBe(false);
  });
});

describe('component ids', () => {
  const withId = (id: string) =>
    applyBoth([
      create(),
      update([
        { id: 'root', component: 'Column', children: [id] },
        { id, component: 'Text', text: 'x' }
      ])
    ]);

  it.each(['user-card', '1st', 'a b', 'a.b', 'a/b'])(
    'reports %j as INVALID_ID and keeps it',
    (id) => {
      const proc = withId(id);
      expect(summary(allIssues(proc))).toEqual([
        ['error', A2UI_ISSUE_CODES.INVALID_ID, `${COMPONENT}/1/id`]
      ]);
      // The surface still renders while the agent renames it.
      expect(instance(proc, id)?.props.get('text')).toBe('x');
    }
  );

  it.each(['user_card', 'userCard', '_internal', 'item_1', 'größe', 'ℓ'])('accepts %j', (id) => {
    expect(allIssues(withId(id))).toEqual([]);
  });
});

// The identifier rule holds for a catalog's own names too.
describe('catalog entity names', () => {
  it('are identifiers in both shipped catalogs, and none claims the reserved "Surface"', () => {
    const names: string[] = [];
    for (const spec of BOTH) {
      for (const [component, { props }] of Object.entries(spec.registry)) {
        names.push(component, ...Object.keys(props));
      }
    }
    expect(names.length).toBeGreaterThan(100);
    expect(names.filter((name) => !/^[\p{XID_Start}_]\p{XID_Continue}*$/u.test(name))).toEqual([]);
    expect(names).not.toContain('Surface');
  });
});

describe('@index', () => {
  const list = (text: unknown) => [
    create({ dataModel: { rows: [{}, {}] } }),
    update([
      { id: 'root', component: 'List', children: { componentId: 'row', path: '/rows' } },
      { id: 'row', component: 'Text', text }
    ])
  ];

  it('is accepted on a template item, with and without an offset', () => {
    for (const call of [
      { '@call': '@index' },
      { '@call': '@index', args: { offset: 1 } },
      { '@call': '@index', args: { offset: { '@path': '/base' } } }
    ]) {
      const proc = applyBoth(list(call));
      expect(allIssues(proc)).toEqual([]);
      expect(instance(proc, 'row')?.usesIndex).toBe(true);
    }
  });

  it('is an error where the component renders outside a template', () => {
    const proc = applyBoth([
      create(),
      update([{ id: 'root', component: 'Text', text: { '@call': '@index' } }])
    ]);
    expect(surfaceIssues(proc)).toEqual([]);
    expect(allIssues(proc).map((i) => [i.severity, i.code])).toEqual([
      ['error', A2UI_ISSUE_CODES.INDEX_OUTSIDE_TEMPLATE]
    ]);
  });

  it('is found in an item label and in an action context', () => {
    const proc = applyBoth([
      create(),
      update([
        { id: 'root', component: 'Tabs', tabs: [{ title: { '@call': '@index' }, child: 'go' }] },
        {
          id: 'go',
          component: 'Button',
          child: 'root',
          action: { event: { name: 'pick', context: { at: { '@call': '@index' } } } }
        }
      ])
    ]);
    expect(instance(proc)?.usesIndex).toBe(true);
    expect(instance(proc, 'go')?.usesIndex).toBe(true);
  });

  it('reports a malformed call where it stands', () => {
    const proc = applyBoth(list({ '@call': '@index', args: { offset: 'one' } }));
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, `${COMPONENT}/1/text/args/offset`]
    ]);
  });

  it('is no gate: a prop that takes a logic call holds its failsafe', () => {
    const proc = applyBoth([
      create({ catalogId: URBICON_A2UI_CATALOG_ID }),
      update([
        {
          id: 'root',
          component: 'Button',
          child: 'label',
          action: { event: { name: 'go' } },
          disabled: { '@call': '@index' }
        },
        { id: 'label', component: 'Text', text: 'Go' }
      ])
    ]);
    expect(surfaceIssues(proc).map((i) => i.code)).toEqual([
      A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED
    ]);
    expect(instance(proc)?.props.get('disabled')).toBe(true);
  });
});

describe('pre-1.0 spellings on a dynamic prop', () => {
  it.each([
    [{ path: '/name' }, '{ "@path": … }'],
    [{ call: 'formatDate', args: {} }, '{ "@call": … }']
  ])('reads %j as the literal it now is, and names the 1.0 form', (value, form) => {
    const proc = applyBoth([create(), update([{ id: 'root', component: 'Text', text: value }])]);
    const [mismatch] = surfaceIssues(proc);
    expect(mismatch).toMatchObject({
      severity: 'error',
      code: A2UI_ISSUE_CODES.TYPE_MISMATCH,
      path: `${COMPONENT}/0/text`
    });
    expect(mismatch.message).toContain(form);
    expect(instance(proc)?.props.has('text')).toBe(false);
  });
});

describe('action.event', () => {
  const button = (event: Record<string, unknown>) =>
    applyBoth([
      create(),
      update([
        { id: 'root', component: 'Button', child: 'label', action: { event } },
        { id: 'label', component: 'Text', text: 'Go' }
      ])
    ]);
  const ACTION = `${COMPONENT}/0/action/event`;

  it.each([['Booked two nights'], [{ '@path': '/summary' }]])(
    'takes a userMessage of %j',
    (userMessage) => {
      expect(allIssues(button({ name: 'book', userMessage }))).toEqual([]);
    }
  );

  it('reports a userMessage that is no string and keeps the action', () => {
    const proc = button({ name: 'book', userMessage: 7 });
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, `${ACTION}/userMessage`]
    ]);
    expect(instance(proc)?.props.has('action')).toBe(true);
  });

  it('takes a literal object in context, escaped "@" keys included', () => {
    const proc = button({ name: 'go', context: { item: { path: '/var/log', '@@type': 'File' } } });
    expect(allIssues(proc)).toEqual([]);
  });

  it('reports a reserved key in a context literal and keeps the action', () => {
    const proc = button({ name: 'go', context: { item: { '@if': true } } });
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.INVALID_RESERVED_KEY, `${ACTION}/context/item/@if`]
    ]);
    expect(surfaceIssues(proc)[0].message).toContain('"@@if"');
    expect(instance(proc)?.props.has('action')).toBe(true);
  });

  // Legal as a literal, so sent as written — but a pre-1.0 binding left in place
  // sends the agent the pointer instead of the user's input.
  it.each([
    [{ path: '/email' }, '"@path"'],
    [{ call: 'not', args: { value: true } }, '"@call"'],
    [{ call: 'formatString', args: {}, returnType: 'string' }, '"@call"']
  ])('warns about a context literal shaped like the pre-1.0 %j', (value, hint) => {
    const proc = button({ name: 'go', context: { item: value } });
    expect(summary(surfaceIssues(proc))).toEqual([
      ['warning', A2UI_ISSUE_CODES.TYPE_MISMATCH, `${ACTION}/context/item`]
    ]);
    expect(surfaceIssues(proc)[0].message).toContain(hint);
    expect(instance(proc)?.props.has('action')).toBe(true);
  });
});

describe('a functionCall action', () => {
  // The components name their catalog, so a surface without a default still
  // renders them and only the call is left without one.
  const button = (functionCall: Record<string, unknown>, surfaceDefault = true) =>
    applyBoth([
      surfaceDefault ? create() : { version: '1.0', createSurface: { surfaceId: 's' } },
      update([
        {
          id: 'root',
          component: 'Button',
          '@catalogId': A2UI_CATALOG_ID,
          child: 'label',
          action: { functionCall }
        },
        { id: 'label', component: 'Text', '@catalogId': A2UI_CATALOG_ID, text: 'Open' }
      ])
    ]);
  const CALL = `${COMPONENT}/0/action/functionCall`;
  const openUrl = (extra: Record<string, unknown> = {}) => ({
    '@call': 'openUrl',
    args: { url: 'https://example.com' },
    ...extra
  });

  it.each([
    ['a literal url', openUrl()],
    ['a bound url', openUrl({ args: { url: { '@path': '/link' } } })],
    ['its catalog named', openUrl({ catalogId: A2UI_CATALOG_ID })]
  ])('stores openUrl with %s', (_label, call) => {
    const proc = button(call);
    expect(allIssues(proc)).toEqual([]);
    expect(instance(proc)?.props.has('action')).toBe(true);
  });

  it.each([
    [
      'an unknown catalogId',
      openUrl({ catalogId: 'no/such' }),
      true,
      'UNKNOWN_CATALOG',
      '/catalogId'
    ],
    ['no catalog at all', openUrl(), false, 'MISSING_FIELD', '/catalogId'],
    [
      'a pre-1.0 bound url',
      openUrl({ args: { url: { path: '/x' } } }),
      true,
      'TYPE_MISMATCH',
      '/args/url'
    ],
    ['no url', openUrl({ args: {} }), true, 'TYPE_MISMATCH', '/args/url'],
    ['a returnType', openUrl({ returnType: 'void' }), true, 'UNKNOWN_PROP', '/returnType'],
    [
      'a second argument',
      openUrl({ args: { url: 'https://example.com', target: '_self' } }),
      true,
      'UNKNOWN_PROP',
      '/args/target'
    ]
  ])('refuses openUrl with %s and drops the action', (_label, call, surfaceDefault, code, at) => {
    const proc = button(call, surfaceDefault);
    // Basic's Button requires its action, so the refused one is missing too.
    expect(summary(allIssues(proc))).toEqual([
      ['error', code, `${CALL}${at}`],
      ['error', A2UI_ISSUE_CODES.MISSING_FIELD, `${COMPONENT}/0/action`]
    ]);
    expect(instance(proc)?.props.has('action')).toBe(false);
  });

  it.each([['formatString'], ['not'], ['closeModal']])(
    'reports %s as unsupported: the button is inert',
    (name) => {
      const proc = button({ '@call': name, args: {} });
      expect(summary(surfaceIssues(proc))).toEqual([
        ['warning', A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED, `${CALL}/@call`]
      ]);
    }
  );
});

describe('Slider steps', () => {
  const slider = (steps: unknown) =>
    applyBoth([create(), update([{ id: 'root', component: 'Slider', value: 1, max: 10, steps }])]);

  it.each([[1], [10]])('takes %j', (steps) => {
    expect(allIssues(slider(steps))).toEqual([]);
  });

  it.each([[0], [-3], [2.5]])(
    'reports %j: a division count is an integer of 1 or more',
    (steps) => {
      expect(summary(surfaceIssues(slider(steps)))).toEqual([
        ['error', A2UI_ISSUE_CODES.TYPE_MISMATCH, `${COMPONENT}/0/steps`]
      ]);
    }
  );
});

// A2UI 1.0's function-call messages: recognised, and refused.
describe('function-call messages', () => {
  it('refuses callRendererFunction and names the call it answers', () => {
    const proc = applyBoth([
      {
        version: '1.0',
        callRendererFunction: {
          functionCallId: 'call_7',
          callFunction: {
            '@call': 'openUrl',
            catalogId: A2UI_CATALOG_ID,
            args: { url: 'https://x' }
          }
        }
      }
    ]);
    expect(proc.globalIssues).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: A2UI_ISSUE_CODES.INVALID_FUNCTION_CALL,
        functionCallId: 'call_7',
        path: '/messages/0/callRendererFunction'
      })
    ]);
    expect(proc.globalIssues[0].message).toContain('"openUrl"');
    expect(proc.globalIssues[0].surfaceId).toBeUndefined();
  });

  it('refuses one for a logic function too: none may be called by the agent', () => {
    const proc = applyBoth([
      create(),
      {
        version: '1.0',
        callRendererFunction: {
          surfaceId: 's',
          functionCallId: 'c',
          callFunction: { ...not(true), catalogId: A2UI_CATALOG_ID }
        }
      }
    ]);
    expect(proc.globalIssues.map((i) => [i.code, i.functionCallId])).toEqual([
      [A2UI_ISSUE_CODES.INVALID_FUNCTION_CALL, 'c']
    ]);
  });

  it('reports an agentFunctionResponse, which answers a call it never made', () => {
    const proc = applyBoth([
      { version: '1.0', agentFunctionResponse: { functionCallId: 'r_1', value: true } }
    ]);
    expect(proc.globalIssues.map((i) => [i.severity, i.code, i.functionCallId])).toEqual([
      ['error', A2UI_ISSUE_CODES.INVALID_FUNCTION_CALL, 'r_1']
    ]);
  });

  it.each([
    [{ callRendererFunction: 'x' }],
    [{ callRendererFunction: {} }],
    [{ agentFunctionResponse: null }]
  ])('does not throw on the malformed %j', (body) => {
    const proc = applyBoth([{ version: '1.0', ...body }]);
    expect(proc.globalIssues.map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.INVALID_FUNCTION_CALL]);
    expect(proc.globalIssues[0].functionCallId).toBeUndefined();
  });

  it('still refuses an envelope that carries two messages', () => {
    const proc = applyBoth([
      { ...create(), agentFunctionResponse: { functionCallId: 'r', value: 1 } }
    ]);
    expect(proc.globalIssues.map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.UNKNOWN_ENVELOPE_TYPE]);
    expect(proc.surfaces.size).toBe(0);
  });
});

// Hostile shapes measured against the engine: depth carried in through a
// binding or a context literal, and fan-out through self-references.
describe('hostile depth and fan-out', () => {
  const segments = (count: number) => Array.from({ length: count }, () => 'a').join('/');
  const nested = (depth: number, leaf: unknown = 1): unknown => {
    let value = leaf;
    for (let i = 0; i < depth; i++) value = { a: value };
    return value;
  };
  const urbicon = (components: unknown[]) => ({
    version: '1.0',
    createSurface: { surfaceId: 's', catalogId: URBICON_A2UI_CATALOG_ID, components }
  });
  const label = { id: 'l', component: 'Text', text: 'Go' };
  const button = (extra: Record<string, unknown>) => ({
    id: 'root',
    component: 'Button',
    child: 'l',
    action: { event: { name: 'go' } },
    ...extra
  });
  const contextButton = (literal: unknown) =>
    button({ action: { event: { name: 'go', context: { k: literal } } } });
  const graphIssues = (proc: A2uiProcessor) => {
    const surface = proc.surfaces.get('s');
    if (!surface) throw new Error('no surface');
    return collectGraphIssues(surface);
  };

  it.each([
    ['absolute', `/${segments(A2UI_MAX_DATA_DEPTH + 1)}`],
    ['absolute, 100,000 segments', `/${segments(100_000)}`],
    ['relative', segments(A2UI_MAX_DATA_DEPTH + 1)]
  ])('reports a %s binding deeper than the data model nests, at the binding', (_label, path) => {
    const field = { id: 'root', component: 'TextField', label: 'Name', value: { '@path': path } };
    const proc = applyBoth([create({ components: [field] })]);
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.MAX_DEPTH, '/messages/0/createSurface/components/0/value']
    ]);
  });

  it('takes a binding of as many segments as the data model nests', () => {
    const path = `/${segments(A2UI_MAX_DATA_DEPTH)}`;
    const field = { id: 'root', component: 'TextField', label: 'Name', value: { '@path': path } };
    expect(allIssues(applyBoth([create({ components: [field] })]))).toEqual([]);
  });

  it('reports a relative binding once a template scope takes it past the limit', () => {
    const list = {
      id: 'root',
      component: 'List',
      children: { componentId: 'row', path: '/items' }
    };
    const rows = (count: number) =>
      applyBoth([
        create({
          components: [
            list,
            { id: 'row', component: 'TextField', label: 'N', value: { '@path': segments(count) } }
          ],
          dataModel: { items: [{}, {}] }
        })
      ]);
    // The scope `/items/<i>` adds two segments.
    expect(graphIssues(rows(A2UI_MAX_DATA_DEPTH - 2))).toEqual([]);
    const over = rows(A2UI_MAX_DATA_DEPTH - 1);
    expect(surfaceIssues(over)).toEqual([]);
    expect(graphIssues(over).map((i) => [i.code, i.message.slice(0, 13)])).toEqual([
      [A2UI_ISSUE_CODES.MAX_DEPTH, '"row" binds a']
    ]);
  });

  it('counts only the segments a relative binding addresses, its empty ones collapsed', () => {
    const value = { '@path': `${segments(A2UI_MAX_DATA_DEPTH - 2)}//` };
    const proc = applyBoth([
      create({
        components: [
          { id: 'root', component: 'List', children: { componentId: 'row', path: '/items' } },
          { id: 'row', component: 'TextField', label: 'N', value }
        ],
        dataModel: { items: [{}] }
      })
    ]);
    expect(allIssues(proc)).toEqual([]);
  });

  it.each([
    ['bound directly', { '@path': `/${segments(A2UI_MAX_DATA_DEPTH + 1)}` }],
    [
      'inside a logic call',
      { '@call': 'not', args: { value: { '@path': `/${segments(A2UI_MAX_DATA_DEPTH + 1)}` } } }
    ]
  ])('holds a gate whose binding is too deep at its failsafe, %s', (_label, disabled) => {
    const proc = applyBoth([urbicon([button({ disabled }), label])]);
    expect(surfaceIssues(proc).map((i) => [i.code, i.message.includes('held at true')])).toEqual([
      [A2UI_ISSUE_CODES.MAX_DEPTH, true]
    ]);
    expect(instance(proc)?.props.get('disabled')).toBe(true);
  });

  it('holds the gates of a @checks list whose condition binding is too deep', () => {
    const condition = { '@path': `/${segments(A2UI_MAX_DATA_DEPTH + 1)}` };
    const proc = applyBoth([
      urbicon([button({ disabled: false, '@checks': [{ condition }] }), label])
    ]);
    expect(surfaceIssues(proc).map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.MAX_DEPTH]);
    expect(instance(proc)?.props.get('disabled')).toBe(true);
    expect(instance(proc)?.props.has('@checks')).toBe(false);
  });

  it.each([
    ['an object', nested(A2UI_MAX_DATA_DEPTH + 1)],
    ['an object 10,000 levels deep', nested(10_000)],
    ['an array', Array.from({ length: A2UI_MAX_DATA_DEPTH }).reduce<unknown>((v) => [v], [1])]
  ])('drops an action whose context literal is %s nesting too deep', (_label, literal) => {
    const proc = applyBoth([create({ components: [contextButton(literal), label] })]);
    const at = '/messages/0/createSurface/components/0/action';
    expect(summary(surfaceIssues(proc))).toEqual([
      ['error', A2UI_ISSUE_CODES.MAX_DEPTH, `${at}/event/context/k`],
      ['error', A2UI_ISSUE_CODES.MISSING_FIELD, at]
    ]);
    expect(instance(proc)?.props.has('action')).toBe(false);
  });

  it('keeps an action whose context literal nests as deep as the data model may', () => {
    const proc = applyBoth([
      create({ components: [contextButton(nested(A2UI_MAX_DATA_DEPTH)), label] })
    ]);
    expect(surfaceIssues(proc)).toEqual([]);
    expect(instance(proc)?.props.has('action')).toBe(true);
  });

  it('reports one CYCLE per edge and bounds a self-referencing fan-out by the node budget', () => {
    const proc = applyBoth([
      create({
        components: [
          { id: 'root', component: 'Column', children: Array.from({ length: 100 }, () => 'C') },
          { id: 'C', component: 'Column', children: Array.from({ length: 1_000 }, () => 'C') }
        ]
      })
    ]);
    expect(graphIssues(proc).map((i) => i.code)).toEqual([
      A2UI_ISSUE_CODES.CYCLE,
      A2UI_ISSUE_CODES.MAX_NODES
    ]);
    // The render tree spends the same budget: the first C's back-references use
    // it up, so no second C renders.
    const surface = proc.surfaces.get('s');
    expect(surface && buildRenderTree(surface)?.children.map((child) => child.id)).toEqual(['C']);
  });

  it('reports a cycle edge reached on two paths once', () => {
    const proc = applyBoth([
      create({
        components: [
          { id: 'root', component: 'Column', children: ['a', 'a'] },
          { id: 'a', component: 'Column', children: ['a'] }
        ]
      })
    ]);
    expect(graphIssues(proc).map((i) => i.message)).toEqual([
      'Cycle detected at component "a", referenced by "a"'
    ]);
  });
});
