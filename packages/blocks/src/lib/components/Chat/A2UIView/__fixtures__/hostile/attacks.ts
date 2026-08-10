/**
 * Adversarial A2UI fixtures — original to this repo (not from the spec).
 *
 * Each export is a raw envelope array fed to `createA2uiProcessor().apply`. The
 * expected issue codes / prototype-safety assertions live in
 * `a2ui-validate.test.ts`. Prototype-pollution fixtures whose attack vector is a
 * real own `__proto__`/`constructor` KEY (not a value) are built with
 * `JSON.parse` — an object literal `{ __proto__: … }` sets the prototype instead
 * of creating an own property, which would not reproduce a JSON wire payload.
 */

/** Minimal valid createSurface for a given id. `catalogId` is opaque. */
function cs(surfaceId: string): Record<string, unknown> {
  return { version: 'v0.9.1', createSurface: { surfaceId, catalogId: 'x' } };
}

// ── Prototype pollution (four vectors) ───────────────────────────────────────

/** `__proto__` as a component id (a string VALUE). */
export const protoComponentId: unknown[] = [
  cs('pc'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'pc',
      components: [
        { id: 'root', component: 'Column', children: ['__proto__'] },
        { id: '__proto__', component: 'Text', text: 'evil' }
      ]
    }
  }
];

/** `__proto__` as an own component prop KEY (via JSON.parse). */
export const protoPropKey: unknown[] = JSON.parse(
  '[{"version":"v0.9.1","createSurface":{"surfaceId":"pp","catalogId":"x"}},' +
    '{"version":"v0.9.1","updateComponents":{"surfaceId":"pp","components":[' +
    '{"id":"root","component":"Text","text":"hi","__proto__":{"polluted":true}}]}}]'
);

/** `__proto__` as a JSON Pointer segment in updateDataModel. */
export const protoPointerSegment: unknown[] = [
  cs('ps'),
  { version: 'v0.9.1', updateDataModel: { surfaceId: 'ps', value: {} } },
  {
    version: 'v0.9.1',
    updateDataModel: { surfaceId: 'ps', path: '/__proto__/polluted', value: true }
  }
];

/** `__proto__` as an own action-context KEY (via JSON.parse). */
export const protoContextKey: unknown[] = JSON.parse(
  '[{"version":"v0.9.1","createSurface":{"surfaceId":"ck","catalogId":"x"}},' +
    '{"version":"v0.9.1","updateComponents":{"surfaceId":"ck","components":[' +
    '{"id":"root","component":"Button","child":"lbl","action":{"event":{"name":"go",' +
    '"context":{"__proto__":{"polluted":true}}}}},' +
    '{"id":"lbl","component":"Text","text":"Go"}]}}]'
);

/** `constructor` as a pointer segment (second pollution key). */
export const protoConstructorPointer: unknown[] = [
  cs('cp'),
  { version: 'v0.9.1', updateDataModel: { surfaceId: 'cp', value: {} } },
  {
    version: 'v0.9.1',
    updateDataModel: { surfaceId: 'cp', path: '/constructor/prototype/polluted', value: true }
  }
];

// ── Resource-exhaustion (depth / nodes) ──────────────────────────────────────

/** A 40-deep Card→Card→…→Text chain (maxDepth is 32). */
export const depthBomb: unknown[] = (() => {
  const depth = 40;
  const components: Array<Record<string, unknown>> = [];
  for (let i = 0; i < depth; i++) {
    components.push({
      id: i === 0 ? 'root' : `c${i}`,
      component: 'Card',
      child: i === depth - 1 ? 'leaf' : `c${i + 1}`
    });
  }
  components.push({ id: 'leaf', component: 'Text', text: 'deep' });
  return [cs('depth'), { version: 'v0.9.1', updateComponents: { surfaceId: 'depth', components } }];
})();

/** A Column with 600 Text children (maxNodes is 512). */
export const nodeBomb: unknown[] = (() => {
  const count = 600;
  const ids: string[] = [];
  const components: Array<Record<string, unknown>> = [
    { id: 'root', component: 'Column', children: ids }
  ];
  for (let i = 0; i < count; i++) {
    ids.push(`t${i}`);
    components.push({ id: `t${i}`, component: 'Text', text: `${i}` });
  }
  return [cs('nodes'), { version: 'v0.9.1', updateComponents: { surfaceId: 'nodes', components } }];
})();

/** root → a → b → a. */
export const cycle: unknown[] = [
  cs('cyc'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'cyc',
      components: [
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Column', children: ['b'] },
        { id: 'b', component: 'Column', children: ['a'] }
      ]
    }
  }
];

// ── Structural faults ────────────────────────────────────────────────────────

/** Two components share an id inside one updateComponents (last wins + error). */
export const duplicateIds: unknown[] = [
  cs('dup'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'dup',
      components: [
        { id: 'root', component: 'Column', children: ['dup'] },
        { id: 'dup', component: 'Text', text: 'first' },
        { id: 'dup', component: 'Text', text: 'second' }
      ]
    }
  }
];

/** A real-but-unsupported component (Modal) and a wholly-unknown one (Script). */
export const unknownComponents: unknown[] = [
  cs('unk'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'unk',
      components: [
        { id: 'root', component: 'Column', children: ['m', 's'] },
        { id: 'm', component: 'Modal', trigger: 'x', content: 'y' },
        { id: 's', component: 'Script', src: 'evil.js' }
      ]
    }
  }
];

/** An event-handler prop smuggled onto a Text. */
export const unknownProp: unknown[] = [
  cs('up'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'up',
      components: [{ id: 'root', component: 'Text', text: 'hi', onclick: 'alert(1)' }]
    }
  }
];

/** An optional prop with the wrong primitive type (pure TYPE_MISMATCH). */
export const typeMismatch: unknown[] = [
  cs('tm'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'tm',
      components: [{ id: 'root', component: 'Text', text: 'hi', weight: 'heavy' }]
    }
  }
];

/** version is not a supported string. */
export const badVersion: unknown[] = [
  { version: 'v0.8', createSurface: { surfaceId: 'bad', catalogId: 'x' } }
];

/** version is absent. */
export const missingVersion: unknown[] = [{ createSurface: { surfaceId: 'none', catalogId: 'x' } }];

/** updateComponents with no preceding createSurface. */
export const updateBeforeCreate: unknown[] = [
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'ghost',
      components: [{ id: 'root', component: 'Text', text: 'x' }]
    }
  }
];

/** createSurface twice for the same id. */
export const duplicateSurface: unknown[] = [cs('twice'), cs('twice')];

/** A child reference to a component that is never defined. */
export const danglingRef: unknown[] = [
  cs('dr'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'dr',
      components: [{ id: 'root', component: 'Column', children: ['missing'] }]
    }
  }
];

/**
 * `Tabs` items in every malformed shape a model can emit — non-objects, a
 * missing `child`, a non-string `title`, the wrong label key (`label`, which is
 * the Urbicon Accordion's key, not the Basic spec's), a cyclic `child`, and a
 * duplicate `child`. One bad item rejects the WHOLE prop, so `tabs` never
 * reaches the render layer half-valid.
 */
export const tabsMalformedItems: unknown[] = [
  cs('tb'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'tb',
      components: [
        {
          id: 'root',
          component: 'Tabs',
          tabs: [
            null,
            42,
            'nope',
            { title: 'no child' },
            { child: 'p1' },
            { label: 'wrong key', child: 'p1' },
            { title: { deep: { deeper: true } }, child: 'p1' },
            { title: 'Cycle', child: 'root' },
            { title: 'Dup', child: 'p1' },
            { title: 'Dup too', child: 'p1' }
          ]
        },
        { id: 'p1', component: 'Text', text: 'body' }
      ]
    }
  }
];

/** `Tabs` with an empty items array — well-formed, but the spec requires one. */
export const tabsEmpty: unknown[] = [
  cs('te'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'te',
      components: [{ id: 'root', component: 'Tabs', tabs: [] }]
    }
  }
];

/** A List template whose path resolves to a non-array. */
export const templatePathNotArray: unknown[] = [
  cs('tp'),
  { version: 'v0.9.1', updateDataModel: { surfaceId: 'tp', value: { notArray: 'hello' } } },
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'tp',
      components: [
        { id: 'root', component: 'List', children: { componentId: 'row', path: '/notArray' } },
        { id: 'row', component: 'Text', text: 'x' }
      ]
    }
  }
];

/** Set two keys, then delete one via a value-less updateDataModel. */
export const deleteSemantics: unknown[] = [
  cs('del'),
  { version: 'v0.9.1', updateDataModel: { surfaceId: 'del', value: { a: 1, b: 2 } } },
  { version: 'v0.9.1', updateDataModel: { surfaceId: 'del', path: '/a' } }
];

/** An Icon svgPath that carries markup — must fail the grammar guard. */
export const invalidSvgPath: unknown[] = [
  cs('svg'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'svg',
      components: [
        { id: 'root', component: 'Icon', name: { svgPath: '</path><script>alert(1)</script>' } }
      ]
    }
  }
];

// ── Inherited-member lookups (#134) ──────────────────────────────────────────
//
// Distinct from the four `__proto__`/`constructor`/`prototype` vectors above:
// those are names the validator explicitly rejects. These are ORDINARY
// `Object.prototype` members — `toString`, `valueOf`, `hasOwnProperty` — used
// where a table is indexed by a payload-chosen string. They pass every name
// check because nothing is being polluted; the lookup simply RESOLVES when it
// should have missed, and the caller then reads `.props` off a function.

/** An inherited member as the component name, with no props. */
export const inheritedComponentName: unknown[] = [
  cs('in1'),
  {
    version: 'v0.9.1',
    updateComponents: { surfaceId: 'in1', components: [{ id: 'root', component: 'toString' }] }
  }
];

/** The same, carrying a prop — reaches the per-prop lookup one line earlier. */
export const inheritedComponentNameWithProp: unknown[] = [
  cs('in2'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'in2',
      components: [{ id: 'root', component: 'valueOf', text: 'x' }]
    }
  }
];

/** An inherited member as the component name, reaching the componentChecks table. */
export const inheritedComponentCheck: unknown[] = [
  cs('in3'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'in3',
      components: [{ id: 'root', component: 'hasOwnProperty' }]
    }
  }
];

/**
 * An inherited member as a PROP name on a perfectly valid component — the
 * cheapest form of the attack, needing no unknown component name at all.
 */
export const inheritedPropKey: unknown[] = [
  cs('in4'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'in4',
      components: [{ id: 'root', component: 'Text', text: 'hi', toString: 'evil' }]
    }
  }
];

/** An envelope with a valid op AND a smuggled extra top-level key. */
export const envelopeSmuggling: unknown[] = [
  cs('sm'),
  {
    version: 'v0.9.1',
    updateComponents: {
      surfaceId: 'sm',
      components: [{ id: 'root', component: 'Text', text: 'x' }]
    },
    injected: { evil: true }
  }
];
