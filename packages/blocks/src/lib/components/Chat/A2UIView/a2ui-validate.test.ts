import { describe, expect, it } from 'vitest';
import * as attacks from './__fixtures__/hostile/attacks';
import { exButton } from './__fixtures__/spec/ex_button';
import { exChildlist } from './__fixtures__/spec/ex_childlist';
import { exIncremental } from './__fixtures__/spec/ex_incremental';
import { exLogin } from './__fixtures__/spec/ex_login';
import { exSimpleText } from './__fixtures__/spec/ex_simple_text';
import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
import { type A2uiCatalogSpec, basicA2uiCatalogSpec } from './a2ui-catalog';
import { A2UI_MAX_LOGIC_DEPTH, A2UI_MAX_LOGIC_OPERANDS } from './a2ui-data';
import type { A2uiRequiredComponent, A2uiSurfaceRequirements } from './a2ui-requirements';
import {
  type A2uiProcessor,
  type A2uiSurfaceState,
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
      ignoredProps: new Set(),
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
      version: 'v0.9.1',
      createSurface: { surfaceId: 'c', catalogId: 'consumer/test' }
    };
    const comps = (components: unknown[]) => ({
      version: 'v0.9.1',
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

// ── Logic functions and surface requirements (Urbicon catalog: Button.disabled) ──

const V91 = 'v0.9.1';

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
  proc.apply({ version: V91, createSurface: { surfaceId, catalogId: URBICON_A2UI_CATALOG_ID } }, 0);
  proc.apply({ version: V91, updateComponents: { surfaceId, components } }, 1);
  return proc;
}

const not = (value: unknown) => ({ call: 'not', args: { value } });
const and = (...values: unknown[]) => ({ call: 'and', args: { values } });
const or = (...values: unknown[]) => ({ call: 'or', args: { values } });

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
    const gate = not({ path: '/agreed' });
    const proc = urbiconSurface(gatedButton(gate));
    expect(allIssues(proc)).toEqual([]);
    expect(storedDisabled(proc)).toEqual(gate);
  });

  it('stores nested and / or, and the spec returnType', () => {
    const gate = {
      ...not(and({ path: '/agreed' }, or({ path: '/email' }, { path: '/phone' }))),
      returnType: 'boolean'
    };
    const proc = urbiconSurface(gatedButton(gate));
    expect(allIssues(proc)).toEqual([]);
    expect(storedDisabled(proc)).toEqual(gate);
  });

  const malformed: Array<[string, unknown, string, string]> = [
    ['no args', { call: 'not' }, A2UI_ISSUE_CODES.MISSING_FIELD, '/args'],
    ['no operand', { call: 'not', args: {} }, A2UI_ISSUE_CODES.MISSING_FIELD, '/args/value'],
    [
      'an unknown arg key',
      { call: 'not', args: { value: true, other: 1 } },
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
      'a returnType other than boolean',
      { ...not(true), returnType: 'string' },
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/returnType'
    ],
    ['one operand for and', and(true), A2UI_ISSUE_CODES.TYPE_MISMATCH, '/args/values'],
    [
      'values that are not an array',
      { call: 'or', args: { values: true } },
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/values'
    ],
    ['a string operand', or(true, 'yes'), A2UI_ISSUE_CODES.TYPE_MISMATCH, '/args/values/1'],
    [
      'an unsupported function as an operand',
      and(true, { call: 'required', args: { value: { path: '/name' } } }),
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/values/1'
    ],
    [
      'a fault inside a nested call',
      not(and(true, { path: '/agreed' }, or(false))),
      A2UI_ISSUE_CODES.TYPE_MISMATCH,
      '/args/value/args/values/2/args/values'
    ],
    [
      'a poisoned operand path',
      not({ path: '/__proto__/x' }),
      A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION,
      '/args/value/path'
    ],
    [
      'an own __proto__ arg key',
      JSON.parse('{"call":"not","args":{"value":true,"__proto__":{"x":1}}}'),
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
      and({ call: 'required', args: { value: { path: '/terms' } } }, { path: '/agreed' })
    );
    for (const gate of [{ call: 'required', args: { value: true } }, upstream]) {
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
      [{ path: '/__proto__/x' }, A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION]
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
    for (const value of [false, { path: '/locked' }]) {
      const proc = urbiconSurface(gatedButton(value));
      expect(allIssues(proc)).toEqual([]);
      expect(storedDisabled(proc)).toEqual(value);
    }
  });

  it('keeps warning about any other function name outside a gate, as before', () => {
    const proc = urbiconSurface([
      { id: 'root', component: 'Text', text: { call: 'formatDate', args: {} } }
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
      expect(allIssues(withContext({ ok: not({ path: '/agreed' }) }))).toEqual([]);
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
      const proc = withContext({ when: { call: 'formatDate', args: {} } });
      expect(allIssues(proc).map((i) => [i.severity, i.code, i.path])).toEqual([
        ['warning', A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED, `${CONTEXT}/when`]
      ]);
      expect(storedAction(proc)).toBeDefined();
    });
  });

  it("refuses a logic call on an input's two-way value", () => {
    const proc = urbiconSurface([
      { id: 'root', component: 'Checkbox', label: 'All', value: not({ path: '/none' }) }
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
        value: { path: '/pick' },
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
      { version: V91, createSurface: { surfaceId: 's', catalogId: 'x' } },
      {
        version: V91,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'root', component: 'CheckBox', label: 'All', value: not(true) }]
        }
      }
    ]);
    expect(codes(allIssues(proc)).has(A2UI_ISSUE_CODES.TYPE_MISMATCH)).toBe(true);
  });
});

describe('surface requirements', () => {
  const consent: A2uiSurfaceRequirements = {
    booking: [{ component: 'Checkbox', path: '/agreed', description: 'consent to the policy' }]
  };
  const consentBox = (value: unknown = { path: '/agreed' }) => ({
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
          'Surface "booking" must contain a Checkbox with value bound to { "path": "/agreed" } (consent to the policy); none renders from "root" (a fault chip does not count)'
      }
    ]);
  });

  it('stays silent mid-stream', () => {
    expect(missing(allIssues(booking(form([])), true))).toEqual([]);
  });

  it('is met by a reachable component bound to the pointer', () => {
    expect(allIssues(booking(form(['agree'], consentBox())))).toEqual([]);
  });

  it('does not count a component that is defined but never reached from root', () => {
    expect(missing(allIssues(booking(form([], consentBox()))))).toHaveLength(1);
  });

  it('does not count one bound elsewhere, or holding a literal', () => {
    const elsewhere = booking(form(['agree'], consentBox({ path: '/other' })));
    expect(missing(allIssues(elsewhere))).toHaveLength(1);
    expect(missing(allIssues(booking(form(['agree'], consentBox(false)))))).toHaveLength(1);
  });

  it('resolves a relative binding against its template item before matching', () => {
    const rows = (pointer: string, withItem: boolean) => {
      const proc = booking(
        [
          { id: 'root', component: 'Column', children: { componentId: 'agree', path: '/rows' } },
          consentBox({ path: 'agreed' })
        ],
        { booking: [{ component: 'Checkbox', path: pointer }] }
      );
      if (withItem) {
        proc.apply(
          { version: V91, updateDataModel: { surfaceId: 'booking', value: { rows: [{}] } } },
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
        disabled: { path: '/locked' }
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
        { id: 'b1', component: 'Checkbox', label: { path: '/l' }, value: { path: '/a' } },
        { id: 'b2', component: 'Checkbox', label: 'x', value: { path: '/a' } }
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
    const second = { ...consentBox({ path: '/privacy' }), id: 'privacy' };
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

  it('reports only MISSING_ROOT for a settled surface without a root', () => {
    const proc = booking([{ id: 'intro', component: 'Text', text: 'x' }]);
    expect(allIssues(proc).map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.MISSING_ROOT]);
  });

  // The user sees a fault chip there, not a consent box.
  it('does not count a component that renders as a fault chip', () => {
    for (const label of [undefined, 42, not(true)]) {
      const box = { id: 'agree', component: 'Checkbox', value: { path: '/agreed' }, label };
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
      ['a relative path', { component: 'Checkbox', path: 'agreed' }, 'is relative']
    ];
    for (const [name, requirement, reason] of unmeetable) {
      it(`reports ${name} once, as INVALID_REQUIREMENT, and never asks the agent for it`, () => {
        // Built the way the requirement asks, as a model following it would.
        const proc = booking(
          form(['agree'], { ...consentBox({ path: 'agreed' }), checked: { path: '/agreed' } }),
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

  // Which catalog a surface lands on is the agent's choice, and A2UIView always
  // holds Basic first, as the default and fallback.
  describe('when the agent picks a catalog that cannot hold the entry', () => {
    const onCatalog = (catalogId: string, components: unknown[], requirements = consent) => {
      const proc = createA2uiProcessor({
        catalogs: [basicA2uiCatalogSpec, urbiconA2uiCatalogSpec],
        surfaceRequirements: requirements
      });
      proc.apply({ version: V91, createSurface: { surfaceId: 'booking', catalogId } }, 0);
      proc.apply({ version: V91, updateComponents: { surfaceId: 'booking', components } }, 1);
      return proc;
    };
    const noConsent = [
      { id: 'root', component: 'Column', children: ['note'] },
      { id: 'note', component: 'Text', text: 'Three nights in Cala' }
    ];
    const basicIds = [
      basicA2uiCatalogSpec.catalogId,
      'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
      'urbicon-ui/urbicon-catalog/v2'
    ];

    for (const catalogId of basicIds) {
      it(`keeps it checked on "${catalogId}" and names the catalog that can hold it`, () => {
        const issues = allIssues(onCatalog(catalogId, noConsent));
        expect(codes(issues).has(A2UI_ISSUE_CODES.INVALID_REQUIREMENT)).toBe(false);
        const errors = issues.filter((i) => i.severity === 'error');
        expect(errors.map((i) => i.code)).toEqual([A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT]);
        expect(errors[0].message).toContain(
          `create the surface with catalogId "${URBICON_A2UI_CATALOG_ID}"`
        );
      });
    }

    it('is met on the catalog that can hold it', () => {
      const withConsent = [{ id: 'root', component: 'Column', children: ['agree'] }, consentBox()];
      expect(allIssues(onCatalog(URBICON_A2UI_CATALOG_ID, withConsent))).toEqual([]);
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
