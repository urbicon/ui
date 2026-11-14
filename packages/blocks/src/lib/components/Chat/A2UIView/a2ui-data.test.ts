import { describe, expect, it } from 'vitest';
import { A2UI_ISSUE_CODES } from './a2ui.types';
import {
  A2UI_MAX_LOGIC_DEPTH,
  A2UI_MAX_LOGIC_OPERANDS,
  type A2uiCallCatalogs,
  checksPass,
  cloneData,
  coerceBoolean,
  deleteAtPointer,
  getAtPointer,
  resolveDynamic,
  setAtPointer
} from './a2ui-data';

const EVERY_CATALOG: A2uiCallCatalogs = () => true;
const NO_CATALOG: A2uiCallCatalogs = () => false;

describe('getAtPointer', () => {
  const model = {
    user: { name: 'Alice' },
    items: ['Apple', 'Banana'],
    nested: { list: [{ v: 1 }, { v: 2 }] },
    'a/b': { 'c~d': 5 }
  };

  it('returns the whole model for "" and "/"', () => {
    expect(getAtPointer(model, '')).toBe(model);
    expect(getAtPointer(model, '/')).toBe(model);
  });

  it('reads object and array members', () => {
    expect(getAtPointer(model, '/user/name')).toBe('Alice');
    expect(getAtPointer(model, '/items/0')).toBe('Apple');
    expect(getAtPointer(model, '/nested/list/1/v')).toBe(2);
  });

  it('unescapes ~1 (/) and ~0 (~) per RFC 6901', () => {
    expect(getAtPointer(model, '/a~1b/c~0d')).toBe(5);
  });

  it('returns undefined for missing paths and non-container descent', () => {
    expect(getAtPointer(model, '/user/missing')).toBeUndefined();
    expect(getAtPointer(model, '/user/name/deeper')).toBeUndefined();
    expect(getAtPointer(model, '/items/9')).toBeUndefined();
  });

  it('returns undefined (never the prototype) for proto segments', () => {
    expect(getAtPointer(model, '/__proto__')).toBeUndefined();
    expect(getAtPointer(model, '/constructor/prototype')).toBeUndefined();
  });

  it('treats non-index array segments as undefined', () => {
    expect(getAtPointer(model, '/items/x')).toBeUndefined();
  });
});

describe('setAtPointer', () => {
  it('creates intermediate objects', () => {
    const model: Record<string, unknown> = {};
    const result = setAtPointer(model, '/a/b/c', 42);
    expect(result.ok).toBe(true);
    expect(model).toEqual({ a: { b: { c: 42 } } });
  });

  it('creates intermediate arrays when the next segment is an index', () => {
    const model: Record<string, unknown> = {};
    setAtPointer(model, '/list/0/name', 'x');
    expect(Array.isArray((model as { list: unknown }).list)).toBe(true);
    expect(getAtPointer(model, '/list/0/name')).toBe('x');
  });

  it('appends to an array with "-" and can create holes by index', () => {
    const model = { arr: [1, 2] as unknown[] };
    setAtPointer(model, '/arr/-', 3);
    expect(model.arr).toEqual([1, 2, 3]);
    setAtPointer(model, '/arr/5', 9);
    expect(model.arr.length).toBe(6);
    expect(4 in model.arr).toBe(false);
    expect(model.arr[5]).toBe(9);
  });

  it('rejects the document root', () => {
    const model = {};
    expect(setAtPointer(model, '', 1).ok).toBe(false);
    expect(setAtPointer(model, '/', 1).ok).toBe(false);
  });

  it('rejects proto segments and leaves the prototype clean', () => {
    const model: Record<string, unknown> = {};
    const r1 = setAtPointer(model, '/__proto__/polluted', true);
    expect(r1.ok).toBe(false);
    expect(r1.issue?.code).toBe(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
    const r2 = setAtPointer(model, '/constructor', true);
    expect(r2.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('deleteAtPointer', () => {
  it('removes an object key', () => {
    const model = { a: 1, b: 2 };
    deleteAtPointer(model, '/a');
    expect(model).toEqual({ b: 2 });
  });

  it('deletes an array index leaving a hole (length preserved)', () => {
    const model = { arr: [1, 2, 3] as unknown[] };
    deleteAtPointer(model, '/arr/1');
    expect(model.arr.length).toBe(3);
    expect(1 in model.arr).toBe(false);
    expect(model.arr[0]).toBe(1);
    expect(model.arr[2]).toBe(3);
  });

  it('is a no-op for proto segments and missing paths', () => {
    const model = { a: 1 };
    expect(() => deleteAtPointer(model, '/__proto__/x')).not.toThrow();
    expect(() => deleteAtPointer(model, '/missing/deep')).not.toThrow();
    expect(model).toEqual({ a: 1 });
  });
});

describe('resolveDynamic', () => {
  const model = { email: 'a@b.c', items: [{ name: 'A' }, { name: 'B' }] };

  it('passes literals through unchanged', () => {
    expect(resolveDynamic('hi', model, undefined, EVERY_CATALOG).value).toBe('hi');
    expect(resolveDynamic(42, model, undefined, EVERY_CATALOG).value).toBe(42);
    expect(resolveDynamic(true, model, undefined, EVERY_CATALOG).value).toBe(true);
    expect(resolveDynamic(['x'], model, undefined, EVERY_CATALOG).value).toEqual(['x']);
  });

  it('resolves an absolute { "@path" } binding', () => {
    expect(resolveDynamic({ '@path': '/email' }, model, undefined, EVERY_CATALOG).value).toBe(
      'a@b.c'
    );
  });

  it('resolves a relative { "@path" } against the scope prefix (template item)', () => {
    expect(resolveDynamic({ '@path': 'name' }, model, '/items/1', EVERY_CATALOG).value).toBe('B');
  });

  it('resolves the empty relative path to the item itself, and to the root outside a scope', () => {
    const tags = { tags: ['urgent', 'home'] };
    expect(resolveDynamic({ '@path': '' }, tags, '/tags/1', EVERY_CATALOG).value).toBe('home');
    expect(resolveDynamic({ '@path': '' }, tags, undefined, EVERY_CATALOG).value).toEqual(tags);
  });

  it('keeps absolute paths absolute even inside a scope', () => {
    expect(
      resolveDynamic({ '@path': '/items/0/name' }, model, '/items/1', EVERY_CATALOG).value
    ).toBe('A');
  });

  it('degrades a function call to undefined with a warning', () => {
    const result = resolveDynamic(
      { '@call': 'formatDate', args: {} },
      model,
      undefined,
      EVERY_CATALOG
    );
    expect(result.value).toBeUndefined();
    expect(result.issue?.severity).toBe('warning');
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED);
  });

  it('surfaces a proto issue for a poisoned path', () => {
    const result = resolveDynamic({ '@path': '/__proto__/x' }, model, undefined, EVERY_CATALOG);
    expect(result.value).toBeUndefined();
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
  });
});

// A2UI 1.0 moved the directives into the `@` namespace: an object with plain
// `path` / `call` keys is data.
describe('resolveDynamic — literal objects and the reserved "@" namespace', () => {
  const model = { email: 'a@b.c' };
  const resolve = (value: unknown) => resolveDynamic(value, model, undefined, EVERY_CATALOG);

  it('reads { path } and { call } as the literal objects they are', () => {
    const pathLiteral = { path: '/email' };
    const callLiteral = { call: 'not', args: { value: true } };
    expect(resolve(pathLiteral)).toEqual({ value: pathLiteral });
    expect(resolve(callLiteral)).toEqual({ value: callLiteral });
  });

  it('hands a literal without escaped keys back as the same object', () => {
    const literal = { kind: 'room', beds: 2 };
    expect(resolve(literal).value).toBe(literal);
  });

  it('unescapes a doubled "@" to the literal key', () => {
    const result = resolve({ '@@path': '/static/file', '@@': 1, kept: true });
    expect(result.issue).toBeUndefined();
    expect({ ...(result.value as object) }).toEqual({
      '@path': '/static/file',
      '@': 1,
      kept: true
    });
  });

  it.each(['@if', '@', '@metadata', '@checks'])(
    'refuses a literal that holds the reserved key %s',
    (key) => {
      const result = resolve({ [key]: true, otherwise: 'active' });
      expect(result.value).toBeUndefined();
      expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.INVALID_RESERVED_KEY);
    }
  );

  it('drops a prototype key from an unescaped copy', () => {
    const value = resolve(JSON.parse('{"@@type":"x","__proto__":{"polluted":1}}')).value;
    expect(Object.keys(value as object)).toEqual(['@type']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('resolveDynamic — @index', () => {
  const model = { rows: [{ items: ['a', 'b', 'c'] }], one: 1 };
  const resolve = (value: unknown, scope?: string) =>
    resolveDynamic(value, model, scope, NO_CATALOG);

  it('is the position of the template item, whatever catalog resolves', () => {
    expect(resolve({ '@call': '@index' }, '/rows/0')).toEqual({ value: 0 });
    expect(resolve({ '@call': '@index' }, '/rows/0/items/2')).toEqual({ value: 2 });
  });

  it('adds a literal or a bound offset', () => {
    expect(resolve({ '@call': '@index', args: { offset: 1 } }, '/rows/0/items/2').value).toBe(3);
    expect(
      resolve({ '@call': '@index', args: { offset: { '@path': '/one' } } }, '/rows/0').value
    ).toBe(1);
    expect(resolve({ '@call': '@index', args: {} }, '/rows/0').value).toBe(0);
  });

  it('resolves to undefined outside a template', () => {
    const result = resolve({ '@call': '@index' });
    expect(result.value).toBeUndefined();
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.INDEX_OUTSIDE_TEMPLATE);
  });

  it.each([
    ['an offset that is not a number', { '@call': '@index', args: { offset: '1' } }],
    ['an unknown arg', { '@call': '@index', args: { step: 2 } }],
    ['args that are no object', { '@call': '@index', args: [1] }],
    ['an unknown key on the call', { '@call': '@index', path: '/x' }],
    ['a poisoned offset path', { '@call': '@index', args: { offset: { '@path': '/__proto__' } } }]
  ])('resolves %s to undefined', (_label, call) => {
    const result = resolve(call, '/rows/0');
    expect(result.value).toBeUndefined();
    expect(result.issue?.severity).toBe('warning');
  });
});

// A2UI 1.0, "DynamicBoolean and CheckRule Coercion".
describe('coerceBoolean', () => {
  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['TRUE', true],
    ['True', true],
    ['false', false],
    ['', false],
    ['hello', false],
    ['yes', false],
    [0, false],
    [-0, false],
    [1, true],
    [-2.5, true],
    [Number.NaN, false],
    [null, false],
    [undefined, false],
    [{ valid: true }, true],
    [{ valid: false, message: 'm' }, false],
    [{ valid: 'true' }, false],
    [{}, false],
    [[], false],
    [[true], false]
  ])('reads %j as %s', (value, expected) => {
    expect(coerceBoolean(value)).toBe(expected);
  });
});

// The Basic catalog's logic functions: the only catalog calls the engine evaluates.
describe('resolveDynamic — not / and / or', () => {
  const model = {
    agreed: true,
    declined: false,
    name: 'Ada',
    yes: 'true',
    zero: 0,
    one: 1,
    nothing: null,
    passed: { valid: true },
    failed: { valid: false },
    items: [{ ok: true }, { ok: false }]
  };
  const not = (value: unknown) => ({ '@call': 'not', args: { value } });
  const and = (...values: unknown[]) => ({ '@call': 'and', args: { values } });
  const or = (...values: unknown[]) => ({ '@call': 'or', args: { values } });
  const resolve = (value: unknown, scope?: string) =>
    resolveDynamic(value, model, scope, EVERY_CATALOG);

  it('negates a bound boolean', () => {
    expect(resolve(not({ '@path': '/agreed' }))).toEqual({ value: false });
    expect(resolve(not({ '@path': '/declined' }))).toEqual({ value: true });
  });

  it('reads a path nobody has written as false, so "not" of it is true', () => {
    // The consent gate before the checkbox is touched: disabled until agreed.
    expect(resolve(not({ '@path': '/agreedLater' }))).toEqual({ value: true });
  });

  it('reads each operand as the protocol coerces a DynamicBoolean', () => {
    for (const path of ['/name', '/zero', '/nothing', '/items', '/failed']) {
      expect(resolve(not({ '@path': path })).value).toBe(true);
    }
    for (const path of ['/yes', '/one', '/passed']) {
      expect(resolve(not({ '@path': path })).value).toBe(false);
    }
    expect(resolve(or({ '@path': '/name' }, { '@path': '/items' })).value).toBe(false);
    expect(resolve(and(true, { '@path': '/passed' })).value).toBe(true);
  });

  it('evaluates and / or over literals, paths and nested calls', () => {
    expect(resolve(and(true, { '@path': '/agreed' })).value).toBe(true);
    expect(resolve(and(true, { '@path': '/declined' })).value).toBe(false);
    expect(resolve(or(false, { '@path': '/agreed' })).value).toBe(true);
    expect(resolve(or(false, not({ '@path': '/agreed' }))).value).toBe(false);
    expect(resolve(not(and({ '@path': '/agreed' }, or(false, true)))).value).toBe(false);
  });

  it('resolves a relative operand against the template item', () => {
    expect(resolve(not({ '@path': 'ok' }), '/items/0').value).toBe(false);
    expect(resolve(not({ '@path': 'ok' }), '/items/1').value).toBe(true);
  });

  it('resolves a malformed call to undefined with a warning, never a partial result', () => {
    const malformed: unknown[] = [
      { '@call': 'not' },
      { '@call': 'not', args: {} },
      { '@call': 'not', args: { value: true, extra: 1 } },
      { '@call': 'not', args: { value: 'yes' } },
      // A2UI 1.0 took returnType off the wire.
      { '@call': 'not', args: { value: true }, returnType: 'boolean' },
      { '@call': 'not', args: { value: true }, '@path': '/agreed' },
      { '@call': 'not', args: { value: { '@path': '/__proto__/x' } } },
      // A pre-1.0 binding is a literal object, and a literal is no operand.
      { '@call': 'not', args: { value: { path: '/agreed' } } },
      { '@call': 'and', args: { values: [true] } },
      { '@call': 'or', args: { values: 'true' } },
      and(true, { '@call': 'required', args: { value: { '@path': '/name' } } }),
      and(true, { '@call': '@index' })
    ];
    for (const value of malformed) {
      const result = resolve(value);
      expect(result.value).toBeUndefined();
      expect(result.issue?.severity).toBe('warning');
    }
  });

  it(`evaluates ${A2UI_MAX_LOGIC_DEPTH} nested levels and refuses one more`, () => {
    let nested: unknown = true;
    for (let i = 0; i < A2UI_MAX_LOGIC_DEPTH; i++) nested = not(nested);
    expect(resolve(nested).value).toBe(true);
    expect(resolve(not(nested)).value).toBeUndefined();
  });

  it(`evaluates ${A2UI_MAX_LOGIC_OPERANDS} operands in one call tree and refuses one more`, () => {
    const wide = or(...Array.from({ length: A2UI_MAX_LOGIC_OPERANDS }, () => false));
    expect(resolve(wide).value).toBe(false);
    // The `or` is itself the operand of `not`: 65 in all.
    expect(resolve(not(wide)).value).toBeUndefined();
  });

  it('does not recurse into a hostile nesting depth', () => {
    let nested: unknown = true;
    for (let i = 0; i < 100_000; i++) nested = not(nested);
    expect(() => resolve(nested)).not.toThrow();
    expect(resolve(nested).value).toBeUndefined();
  });
});

// A call runs in the catalog its `catalogId` names, else in the surface's
// default; one that reaches neither is not evaluated.
describe('resolveDynamic — the catalog of a call', () => {
  const known: A2uiCallCatalogs = (catalogId) => catalogId === 'known';
  const withDefault: A2uiCallCatalogs = (catalogId) =>
    catalogId === undefined || catalogId === 'known';
  const call = (extra: Record<string, unknown> = {}) => ({
    '@call': 'not',
    args: { value: false },
    ...extra
  });

  it('evaluates a call that names a configured catalog', () => {
    expect(resolveDynamic(call({ catalogId: 'known' }), {}, undefined, known).value).toBe(true);
  });

  it('evaluates a call that names none on a surface with a default', () => {
    expect(resolveDynamic(call(), {}, undefined, withDefault).value).toBe(true);
  });

  it('refuses a call that names none on a surface without a default', () => {
    const result = resolveDynamic(call(), {}, undefined, known);
    expect(result.value).toBeUndefined();
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.MISSING_FIELD);
  });

  it('refuses a call that names an unknown catalog, also as a nested operand', () => {
    const unknown = call({ catalogId: 'elsewhere' });
    expect(resolveDynamic(unknown, {}, undefined, withDefault).issue?.code).toBe(
      A2UI_ISSUE_CODES.UNKNOWN_CATALOG
    );
    const nested = { '@call': 'and', args: { values: [true, unknown] } };
    expect(resolveDynamic(nested, {}, undefined, withDefault).value).toBeUndefined();
  });

  it('refuses a catalogId that is no string', () => {
    const result = resolveDynamic(call({ catalogId: 7 }), {}, undefined, withDefault);
    expect(result.value).toBeUndefined();
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.TYPE_MISMATCH);
  });
});

describe('checksPass', () => {
  const model = {
    agreed: true,
    declined: false,
    name: 'Ada',
    one: 1,
    passed: { valid: true },
    failed: { valid: false, message: 'Card expired' }
  };
  const resolve = (value: unknown) => resolveDynamic(value, model, undefined, EVERY_CATALOG).value;
  const rule = (condition: unknown) => ({ condition, message: 'm' });

  it('passes with no list, an empty one, or every condition counting as true', () => {
    expect(checksPass(undefined, resolve)).toBe(true);
    expect(checksPass([], resolve)).toBe(true);
    const not = { '@call': 'not', args: { value: { '@path': '/declined' } } };
    expect(
      checksPass(
        [
          rule({ '@path': '/agreed' }),
          rule(not),
          rule({ '@path': '/one' }),
          rule({ '@path': '/passed' }),
          { condition: { '@path': '/agreed' } }
        ],
        resolve
      )
    ).toBe(true);
  });

  it('fails on one condition that counts as false', () => {
    for (const condition of [
      { '@path': '/declined' },
      { '@path': '/unset' },
      { '@path': '/name' },
      { '@path': '/failed' },
      { '@call': 'required', args: { value: { '@path': '/name' } } },
      { '@call': 'and', args: { values: [true] } }
    ]) {
      expect(checksPass([rule({ '@path': '/agreed' }), rule(condition)], resolve)).toBe(false);
    }
  });

  it('fails on a value that is not a list of rules', () => {
    for (const checks of [null, rule({ '@path': '/agreed' }), [true], ['x'], [null]]) {
      expect(checksPass(checks, resolve)).toBe(false);
    }
  });
});

describe('cloneData', () => {
  it('deep-clones with no shared references', () => {
    const source = { a: { b: [1, 2] } };
    const clone = cloneData(source) as typeof source;
    expect(clone).toEqual(source);
    expect(clone.a).not.toBe(source.a);
    expect(clone.a.b).not.toBe(source.a.b);
  });

  it('drops own __proto__/constructor/prototype keys', () => {
    const source = JSON.parse('{"safe":1,"__proto__":{"x":1},"constructor":2}');
    const clone = cloneData(source) as Record<string, unknown>;
    expect(clone).toEqual({ safe: 1 });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('preserves array holes', () => {
    const source: unknown[] = [1, 2, 3];
    delete source[1]; // create a genuine hole (not a literal sparse array)
    const clone = cloneData(source) as unknown[];
    expect(clone.length).toBe(3);
    expect(1 in clone).toBe(false);
    expect(clone[2]).toBe(3);
  });
});
