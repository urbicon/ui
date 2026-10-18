import { describe, expect, it } from 'vitest';
import { A2UI_ISSUE_CODES } from './a2ui.types';
import {
  A2UI_MAX_LOGIC_DEPTH,
  cloneData,
  deleteAtPointer,
  getAtPointer,
  resolveDynamic,
  setAtPointer
} from './a2ui-data';

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
    expect(resolveDynamic('hi', model, undefined).value).toBe('hi');
    expect(resolveDynamic(42, model, undefined).value).toBe(42);
    expect(resolveDynamic(true, model, undefined).value).toBe(true);
    expect(resolveDynamic(['x'], model, undefined).value).toEqual(['x']);
  });

  it('resolves an absolute { path } binding', () => {
    expect(resolveDynamic({ path: '/email' }, model, undefined).value).toBe('a@b.c');
  });

  it('resolves a relative { path } against the scope prefix (template item)', () => {
    expect(resolveDynamic({ path: 'name' }, model, '/items/1').value).toBe('B');
  });

  it('keeps absolute paths absolute even inside a scope', () => {
    expect(resolveDynamic({ path: '/items/0/name' }, model, '/items/1').value).toBe('A');
  });

  it('degrades a function call to undefined with a warning', () => {
    const result = resolveDynamic({ call: 'formatDate', args: {} }, model, undefined);
    expect(result.value).toBeUndefined();
    expect(result.issue?.severity).toBe('warning');
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.FUNCTION_CALL_UNSUPPORTED);
  });

  it('surfaces a proto issue for a poisoned path', () => {
    const result = resolveDynamic({ path: '/__proto__/x' }, model, undefined);
    expect(result.value).toBeUndefined();
    expect(result.issue?.code).toBe(A2UI_ISSUE_CODES.PROTOTYPE_POLLUTION);
  });
});

// The Basic catalog's logic functions: the only calls the engine evaluates.
describe('resolveDynamic — not / and / or', () => {
  const model = {
    agreed: true,
    declined: false,
    name: 'Ada',
    zero: 0,
    nothing: null,
    items: [{ ok: true }, { ok: false }]
  };
  const not = (value: unknown) => ({ call: 'not', args: { value } });
  const and = (...values: unknown[]) => ({ call: 'and', args: { values } });
  const or = (...values: unknown[]) => ({ call: 'or', args: { values } });
  const resolve = (value: unknown, scope?: string) => resolveDynamic(value, model, scope);

  it('negates a bound boolean', () => {
    expect(resolve(not({ path: '/agreed' }))).toEqual({ value: false });
    expect(resolve(not({ path: '/declined' }))).toEqual({ value: true });
  });

  it('reads a path nobody has written as false, so "not" of it is true', () => {
    // The consent gate before the checkbox is touched: disabled until agreed.
    expect(resolve(not({ path: '/agreed-later' }))).toEqual({ value: true });
  });

  it('counts only the boolean true as true', () => {
    for (const path of ['/name', '/zero', '/nothing', '/items']) {
      expect(resolve(not({ path })).value).toBe(true);
    }
    expect(resolve(or({ path: '/name' }, { path: '/items' })).value).toBe(false);
    expect(resolve(and(true, { path: '/name' })).value).toBe(false);
  });

  it('evaluates and / or over literals, paths and nested calls', () => {
    expect(resolve(and(true, { path: '/agreed' })).value).toBe(true);
    expect(resolve(and(true, { path: '/declined' })).value).toBe(false);
    expect(resolve(or(false, { path: '/agreed' })).value).toBe(true);
    expect(resolve(or(false, not({ path: '/agreed' }))).value).toBe(false);
    expect(resolve(not(and({ path: '/agreed' }, or(false, true)))).value).toBe(false);
  });

  it('resolves a relative operand against the template item', () => {
    expect(resolve(not({ path: 'ok' }), '/items/0').value).toBe(false);
    expect(resolve(not({ path: 'ok' }), '/items/1').value).toBe(true);
  });

  it('accepts the spec returnType "boolean"', () => {
    expect(resolve({ ...not(false), returnType: 'boolean' }).value).toBe(true);
  });

  it('resolves a malformed call to undefined with a warning, never a partial result', () => {
    const malformed: unknown[] = [
      { call: 'not' },
      { call: 'not', args: {} },
      { call: 'not', args: { value: true, extra: 1 } },
      { call: 'not', args: { value: 'yes' } },
      { call: 'not', args: { value: true }, returnType: 'string' },
      { call: 'not', args: { value: true }, path: '/agreed' },
      { call: 'not', args: { value: { path: '/__proto__/x' } } },
      { call: 'and', args: { values: [true] } },
      { call: 'or', args: { values: 'true' } },
      and(true, { call: 'required', args: { value: { path: '/name' } } })
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

  it('does not recurse into a hostile nesting depth', () => {
    let nested: unknown = true;
    for (let i = 0; i < 100_000; i++) nested = not(nested);
    expect(() => resolve(nested)).not.toThrow();
    expect(resolve(nested).value).toBeUndefined();
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
