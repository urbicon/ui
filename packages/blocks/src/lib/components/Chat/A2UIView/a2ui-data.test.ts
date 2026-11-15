import { describe, expect, it } from 'vitest';
import { A2UI_ISSUE_CODES } from './a2ui.types';
import {
  A2UI_MAX_DATA_DEPTH,
  A2UI_MAX_LOGIC_DEPTH,
  A2UI_MAX_LOGIC_OPERANDS,
  A2UI_MAX_NEW_ITEM_INDEX,
  type A2uiCallCatalogs,
  checksPass,
  coerceBoolean,
  getAtPointer,
  pointerIssue,
  resolveDynamic,
  writeDataModel
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

  it('reads only keys an object owns, never an inherited member', () => {
    for (const pointer of ['/toString', '/valueOf', '/hasOwnProperty', '/user/toString']) {
      expect(getAtPointer(model, pointer)).toBeUndefined();
    }
    expect(getAtPointer({ toString: 'own' }, '/toString')).toBe('own');
  });

  it('collapses empty segments: a trailing, doubled or leading "/" addresses nothing more', () => {
    expect(getAtPointer(model, '/user/name/')).toBe('Alice');
    expect(getAtPointer(model, '//nested///list/1//v//')).toBe(2);
    expect(getAtPointer(model, '///')).toBe(model);
    expect(getAtPointer({ '': 'empty key' }, '/')).toEqual({ '': 'empty key' });
  });
});

/** A chain of `depth` objects, `{ a: { a: … } }` around `leaf`. */
function chain(depth: number, leaf: unknown = 1): unknown {
  let value = leaf;
  for (let i = 0; i < depth; i++) value = { a: value };
  return value;
}

/** A pointer of `segments` segments, `/a/a/…`. */
function deepPointer(segments: number): string {
  return `/${Array.from({ length: segments }, () => 'a').join('/')}`;
}

/** The model after a write that must apply. */
function written(model: unknown, pointer: string, value: unknown): unknown {
  const write = writeDataModel(model, pointer, value, 0);
  if (!write.ok) throw new Error(`refused: ${write.message}`);
  return write.model;
}

describe('writeDataModel', () => {
  it('creates intermediate objects', () => {
    const model: Record<string, unknown> = {};
    expect(written(model, '/a/b/c', 42)).toBe(model);
    expect(model).toEqual({ a: { b: { c: 42 } } });
  });

  it('creates intermediate arrays when the next segment is an index', () => {
    const model = written({}, '/list/0/name', 'x');
    expect(Array.isArray((model as { list: unknown }).list)).toBe(true);
    expect(getAtPointer(model, '/list/0/name')).toBe('x');
  });

  it('creates the root container a missing or null model needs', () => {
    expect(written(undefined, '/0', 'x')).toEqual(['x']);
    expect(written(null, '/k', 'x')).toEqual({ k: 'x' });
  });

  // Upstream's test_data_model_rejects_write_through_primitive_root.
  it.each([1, false, 0, ''])(
    'refuses to write through a root that holds %j, which a whole-model write still replaces',
    (root) => {
      const write = writeDataModel(root, '/a', 2, 0);
      expect(write.ok || [write.refused, write.code]).toEqual([
        'pointer',
        A2UI_ISSUE_CODES.POINTER_ERROR
      ]);
      expect(written({}, '/', root)).toBe(root);
      expect(written(root, '/', { a: 2 })).toEqual({ a: 2 });
    }
  );

  it.each([
    ['/user/name/first', { user: { name: 'Alice' } }],
    ['/items/0/foo', { items: ['a', 'b'] }],
    ['/flags/on/x', { flags: { on: false } }],
    ['/counts/0/1', { counts: [0] }]
  ])(
    'refuses %s, which runs through a string, number or boolean, and writes nothing',
    (pointer, model) => {
      const before = structuredClone(model);
      const write = writeDataModel(model, pointer, 'x', 0);
      expect(write.ok || [write.refused, write.code]).toEqual([
        'pointer',
        A2UI_ISSUE_CODES.POINTER_ERROR
      ]);
      expect(model).toEqual(before);
    }
  );

  it('replaces null, a hole and a key the object does not own with the container a pointer needs', () => {
    const model = written({ user: null, counts: [null] }, '/user/name', 'Bob');
    written(model, '/counts/0/total', 1);
    written(model, '/counts/2/total', 3);
    written(model, '/counts/1/total', 2);
    written(model, '/toString/x', 1);
    expect(model).toEqual({
      user: { name: 'Bob' },
      counts: [{ total: 1 }, { total: 2 }, { total: 3 }],
      toString: { x: 1 }
    });
  });

  it('collapses empty segments on write, and replaces the whole model through a pointer of none', () => {
    const model = { kept: true };
    written(model, '/foo/', 'bar');
    written(model, '//a///b//', 'val');
    expect(model).toEqual({ kept: true, foo: 'bar', a: { b: 'val' } });
    expect(written(model, '//', { fresh: 1 })).toEqual({ fresh: 1 });
    expect(written(model, '///', undefined)).toEqual({});
  });

  it('appends with "-" and at the index of the length', () => {
    const model = { arr: [1, 2] as unknown[] };
    written(model, '/arr/-', 3);
    written(model, '/arr/3', 4);
    expect(model.arr).toEqual([1, 2, 3, 4]);
  });

  it('replaces the whole model at the root, and empties it on a delete', () => {
    const model = { kept: false };
    expect(written(model, '', { a: 1 })).toEqual({ a: 1 });
    expect(written(model, '/', ['x'])).toEqual(['x']);
    expect(written(model, '', undefined)).toEqual({});
  });

  it('copies the value in, dropping own prototype keys and keeping array holes', () => {
    const value = JSON.parse('{"safe":{"list":[1,2,3]},"__proto__":{"x":1},"constructor":2}');
    delete value.safe.list[1];
    const model = written({}, '/v', value) as { v: { safe: { list: unknown[] } } };
    expect(model.v).toEqual({ safe: { list: value.safe.list } });
    expect(model.v.safe).not.toBe(value.safe);
    expect(1 in model.v.safe.list).toBe(false);
    expect(Object.keys(model.v)).toEqual(['safe']);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('refuses proto segments and leaves the prototype clean', () => {
    const model: Record<string, unknown> = {};
    const first = writeDataModel(model, '/__proto__/polluted', true, 0);
    expect(first.ok || first.code).toBe(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
    expect(writeDataModel(model, '/constructor', true, 0).ok).toBe(false);
    expect(model).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ['no leading "/"', 'invalid path [0]'],
    ['a relative path', 'a/b'],
    ['"~" before a character that is not 0 or 1', '/a~2b'],
    ['a trailing "~"', '/a~']
  ])('refuses a pointer with %s and writes nothing', (_label, pointer) => {
    const model = { kept: true };
    const write = writeDataModel(model, pointer, 'x', 0);
    expect(write.ok || [write.refused, write.code]).toEqual([
      'pointer',
      A2UI_ISSUE_CODES.POINTER_ERROR
    ]);
    expect(model).toEqual({ kept: true });
  });

  it('pads an index past the end with holes that read as missing, also in a list it creates', () => {
    const model = written({ items: ['a'] }, '/items/3', 'd') as { items: unknown[] };
    expect(model.items.length).toBe(4);
    expect([1 in model.items, 2 in model.items]).toEqual([false, false]);

    const guests = written({}, '/guests/1/name', 'Bo') as { guests: unknown[] };
    expect(guests.guests.length).toBe(2);
    expect(0 in guests.guests).toBe(false);
    expect(getAtPointer(guests, '/guests/0')).toBeUndefined();
    expect(getAtPointer(guests, '/guests/1/name')).toBe('Bo');
  });

  // The bound and its cases are upstream's: test_data_model_rejects_excessive_list_index.
  const MAX = A2UI_MAX_NEW_ITEM_INDEX;

  it(`adds a list item at index ${MAX}, also in a list it creates`, () => {
    expect(getAtPointer(written({ items: ['a'] }, `/items/${MAX}`, 'x'), `/items/${MAX}`)).toBe(
      'x'
    );
    expect(getAtPointer(written({}, `/fresh/${MAX}/name`, 'x'), `/fresh/${MAX}/name`)).toBe('x');
  });

  it.each([
    `/items/${MAX + 1}`,
    '/items/999999999',
    `/items/${MAX + 1}/name`,
    '/newArray/10000000',
    '/newArray/10000000/field'
  ])('refuses a new list item above that index, at %s, and writes nothing', (pointer) => {
    const model = { items: ['a', 'b', 'c'] };
    const write = writeDataModel(model, pointer, 'x', 0);
    expect(write.ok || [write.refused, write.code]).toEqual([
      'pointer',
      A2UI_ISSUE_CODES.POINTER_ERROR
    ]);
    expect(model).toEqual({ items: ['a', 'b', 'c'] });
  });

  it('refuses to append above that index, by index and by "-"', () => {
    const model = written({}, `/items/${MAX}`, 'x') as { items: unknown[] };
    for (const pointer of [`/items/${MAX + 1}`, '/items/-']) {
      expect(writeDataModel(model, pointer, 'y', 0).ok).toBe(false);
    }
    expect(model.items.length).toBe(MAX + 1);
  });

  it('writes an item a list already holds at any index', () => {
    const model = written(
      {},
      '/items',
      Array.from({ length: MAX + 5 }, (_, i) => i)
    );
    expect(getAtPointer(written(model, `/items/${MAX + 3}`, 'x'), `/items/${MAX + 3}`)).toBe('x');
  });

  it('counts the slots a write pads: past the end of a list, also in lists it creates', () => {
    const padded = (model: unknown, pointer: string) => {
      const write = writeDataModel(model, pointer, 'x', 0);
      if (!write.ok) throw new Error(write.message);
      return write.paddedSlots;
    };
    expect(padded({ items: ['a', 'b', 'c'] }, `/items/${MAX}`)).toBe(MAX - 3);
    expect(padded({}, '/guests/1/name')).toBe(1);
    expect(padded({}, '/a/2/b/3')).toBe(5);
    expect(padded({ items: ['a'] }, '/items/1')).toBe(0);
    expect(padded({ items: ['a'] }, '/items/-')).toBe(0);
    expect(padded({ items: [] as unknown[] }, '/items/0')).toBe(0);
  });

  it(`refuses a write that would pad more than ${MAX} slots on the surface in all`, () => {
    const model = {};
    const first = writeDataModel(model, `/a/${MAX - 3}`, 'x', 0);
    expect(first.ok && first.paddedSlots).toBe(MAX - 3);
    const used = MAX - 3;
    expect(writeDataModel(model, '/b/3', 'x', used).ok).toBe(true);
    const over = writeDataModel(model, '/c/4', 'x', used);
    expect(over.ok || [over.refused, over.code]).toEqual([
      'pointer',
      A2UI_ISSUE_CODES.POINTER_ERROR
    ]);
    expect(over.ok || over.message).toContain(`${MAX} one surface's data model may be padded with`);
    expect(getAtPointer(model, '/c')).toBeUndefined();
  });

  it.each(['/items/01', '/items/01/nested', '/items/x'])(
    'reads %s on a list as missing, and refuses to write it',
    (pointer) => {
      const model = { items: ['a', 'b', 'c'] };
      expect(getAtPointer(model, pointer)).toBeUndefined();
      const write = writeDataModel(model, pointer, 'x', 0);
      expect(write.ok || [write.refused, write.code]).toEqual([
        'pointer',
        A2UI_ISSUE_CODES.POINTER_ERROR
      ]);
      expect(model).toEqual({ items: ['a', 'b', 'c'] });
    }
  );

  it('leaves no container behind when a later segment refuses the write', () => {
    const model: Record<string, unknown> = {};
    expect(writeDataModel(model, `/a/b/list/${MAX + 1}`, 'x', 0).ok).toBe(false);
    expect(model).toEqual({});
    expect(writeDataModel(undefined, `/${MAX + 1}`, 'x', 0).ok).toBe(false);
  });

  it(`writes up to ${A2UI_MAX_DATA_DEPTH} levels, counting a level per segment`, () => {
    expect(written({}, '', chain(A2UI_MAX_DATA_DEPTH))).toEqual(chain(A2UI_MAX_DATA_DEPTH));
    expect(written({}, '/a', chain(A2UI_MAX_DATA_DEPTH - 1))).toEqual(chain(A2UI_MAX_DATA_DEPTH));
    expect(written({}, deepPointer(A2UI_MAX_DATA_DEPTH), 1)).toEqual(chain(A2UI_MAX_DATA_DEPTH));
  });

  it.each([
    ['at the root', '', chain(A2UI_MAX_DATA_DEPTH + 1), 'value'],
    ['below a segment', '/a', chain(A2UI_MAX_DATA_DEPTH), 'value'],
    ['through its pointer alone', deepPointer(A2UI_MAX_DATA_DEPTH + 1), 1, 'pointer'],
    ['through a pointer of 100,000 segments', deepPointer(100_000), 'x', 'pointer'],
    ['with a value 100,000 levels deep', '/a', chain(100_000), 'value']
  ])(
    'refuses a write that nests the model too deep %s, and writes nothing',
    (_label, pointer, value, refused) => {
      const model = { kept: true };
      const write = writeDataModel(model, pointer, value, 0);
      expect(write.ok || [write.refused, write.code]).toEqual([
        refused,
        A2UI_ISSUE_CODES.MAX_DEPTH
      ]);
      expect(model).toEqual({ kept: true });
    }
  );

  it('deletes an object key, and an array item as a hole', () => {
    const model = { a: 1, b: 2, arr: [1, 2, 3] as unknown[] };
    written(model, '/a', undefined);
    written(model, '/arr/1', undefined);
    expect(Object.keys(model)).toEqual(['b', 'arr']);
    expect(model.arr.length).toBe(3);
    expect(1 in model.arr).toBe(false);
  });

  it('deletes nothing through a missing path, and nothing through a refused pointer', () => {
    const model = { a: 1, 'invalid path [0]': 2 };
    written(model, '/missing/deep', undefined);
    expect(writeDataModel(model, '/__proto__/x', undefined, 0).ok).toBe(false);
    expect(writeDataModel(model, 'invalid path [0]', undefined, 0).ok).toBe(false);
    expect(model).toEqual({ a: 1, 'invalid path [0]': 2 });
  });
});

describe('pointerIssue', () => {
  it('reads a relative pointer on its own segments', () => {
    expect(pointerIssue(deepPointer(A2UI_MAX_DATA_DEPTH).slice(1))).toBeUndefined();
    expect(pointerIssue(deepPointer(A2UI_MAX_DATA_DEPTH + 1).slice(1))?.code).toBe(
      A2UI_ISSUE_CODES.MAX_DEPTH
    );
  });

  it('counts only the segments a pointer addresses, its empty ones collapsed', () => {
    const padded = `//${deepPointer(A2UI_MAX_DATA_DEPTH).replaceAll('/', '//')}//`;
    expect(pointerIssue(padded)).toBeUndefined();
    expect(written({}, padded, 1)).toEqual(chain(A2UI_MAX_DATA_DEPTH));
  });

  it('accepts the escapes RFC 6901 defines and refuses any other', () => {
    expect(pointerIssue('/a~0b/c~1d')).toBeUndefined();
    expect(pointerIssue('/a~2b')?.code).toBe(A2UI_ISSUE_CODES.POINTER_ERROR);
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

  it('refuses a relative binding its template scope takes past the depth limit', () => {
    const relative = { '@path': deepPointer(A2UI_MAX_DATA_DEPTH - 2).slice(1) };
    expect(resolveDynamic(relative, model, '/items/1', EVERY_CATALOG).issue).toBeUndefined();
    const result = resolveDynamic(relative, model, '/items/1/a', EVERY_CATALOG);
    expect(result.value).toBeUndefined();
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.MAX_DEPTH);
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

  it('leaves the call unresolved when the scope refuses an operand, whichever operand decides', () => {
    const refused = { '@path': deepPointer(A2UI_MAX_DATA_DEPTH - 1).slice(1) };
    for (const call of [not(refused), and(false, refused), or(true, not(refused))]) {
      const result = resolve(call, '/items/0');
      expect(result.value).toBeUndefined();
      expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.MAX_DEPTH);
    }
    expect(resolve(not(refused)).value).toBe(true);
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
