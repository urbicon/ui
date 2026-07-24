import { describe, expect, it } from 'vitest';
import { type A2uiDataSchema, a2uiDataSchemaSection, validateSchemaWrite } from './a2ui-schema';
import { createA2uiProcessor } from './a2ui-validate';

const SCHEMA: A2uiDataSchema = {
  '/name': { type: 'string', description: 'The guest name' },
  '/party': { type: 'integer' },
  '/date': { type: 'string', format: 'date' },
  '/service': { type: 'string', enum: ['cut', 'colour', 'style'] },
  '/agreed': { type: 'boolean' },
  '/guests': { type: 'array' }
};

describe('validateSchemaWrite', () => {
  it('accepts a correctly-typed write on a declared pointer', () => {
    expect(validateSchemaWrite(SCHEMA, '/name', 'Ada')).toEqual([]);
    expect(validateSchemaWrite(SCHEMA, '/party', 3)).toEqual([]);
    expect(validateSchemaWrite(SCHEMA, '/agreed', true)).toEqual([]);
    expect(validateSchemaWrite(SCHEMA, '/guests', ['a', 'b'])).toEqual([]);
  });

  it('flags a type mismatch on a declared pointer as an error', () => {
    const issues = validateSchemaWrite(SCHEMA, '/party', 'three', 's');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('SCHEMA_TYPE_MISMATCH');
    expect(issues[0].severity).toBe('error');
    expect(issues[0].surfaceId).toBe('s');
    expect(issues[0].path).toBe('/party');
  });

  it('rejects a non-integer number for an integer field', () => {
    expect(validateSchemaWrite(SCHEMA, '/party', 3.5)[0]?.code).toBe('SCHEMA_TYPE_MISMATCH');
  });

  it('enforces enum membership', () => {
    expect(validateSchemaWrite(SCHEMA, '/service', 'cut')).toEqual([]);
    const bad = validateSchemaWrite(SCHEMA, '/service', 'perm');
    expect(bad[0]?.code).toBe('SCHEMA_TYPE_MISMATCH');
    expect(bad[0]?.message).toContain('cut, colour, style');
  });

  it('warns on a write to an undeclared top-level branch', () => {
    const issues = validateSchemaWrite(SCHEMA, '/unknown', 'x');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('SCHEMA_UNDECLARED_PATH');
    expect(issues[0].severity).toBe('warning');
  });

  it('stays quiet on a deeper path under a declared top-level branch', () => {
    // /guests is declared; a deeper index path is not modelled but not "undeclared".
    expect(validateSchemaWrite(SCHEMA, '/guests/0', 'Ada')).toEqual([]);
  });

  it('never flags a delete (no value)', () => {
    expect(validateSchemaWrite(SCHEMA, '/party', undefined)).toEqual([]);
  });

  it('does not treat an inherited Object.prototype key as a declared field', () => {
    // A pointer like /toString must NOT resolve Object.prototype.toString and
    // mis-report a type mismatch — it is simply an undeclared top-level path.
    for (const proto of ['toString', 'hasOwnProperty', 'constructor']) {
      const issues = validateSchemaWrite(SCHEMA, `/${proto}`, 'x');
      expect(issues.every((i) => i.code !== 'SCHEMA_TYPE_MISMATCH')).toBe(true);
      expect(issues[0]?.code).toBe('SCHEMA_UNDECLARED_PATH');
    }
  });

  it('validates a whole-model write field by field', () => {
    const ok = validateSchemaWrite(SCHEMA, '', { name: 'Ada', party: 2, service: 'cut' });
    expect(ok).toEqual([]);
    const bad = validateSchemaWrite(SCHEMA, '/', { name: 42, party: 'two' });
    expect(bad.map((i) => i.path).sort()).toEqual(['/name', '/party']);
    expect(bad.every((i) => i.code === 'SCHEMA_TYPE_MISMATCH')).toBe(true);
  });
});

describe('a2uiDataSchemaSection', () => {
  const section = a2uiDataSchemaSection(SCHEMA);
  it('lists every declared field with its type', () => {
    expect(section).toContain('## Data schema');
    expect(section).toContain('/name (string)');
    expect(section).toContain('/party (integer)');
  });
  it('documents enum and format', () => {
    expect(section).toContain('one of: cut | colour | style');
    expect(section).toContain('format date');
  });
  it('includes descriptions', () => {
    expect(section).toContain('The guest name');
  });
});

describe('processor integration', () => {
  const V = 'v0.9.1';
  function run(envelopes: unknown[], dataSchema?: A2uiDataSchema) {
    const proc = createA2uiProcessor(dataSchema ? { dataSchema } : undefined);
    envelopes.forEach((env, i) => {
      proc.apply(env, i);
    });
    return proc;
  }

  it('validates updateDataModel writes when a schema is set', () => {
    const proc = run(
      [
        { version: V, createSurface: { surfaceId: 's', catalogId: 'x' } },
        { version: V, updateDataModel: { surfaceId: 's', path: '/party', value: 'nope' } }
      ],
      SCHEMA
    );
    const surface = proc.surfaces.get('s')!;
    expect(surface.issues.some((i) => i.code === 'SCHEMA_TYPE_MISMATCH')).toBe(true);
    // The (mis-typed) value is still written — the engine reads tolerantly.
    expect(surface.dataModel).toEqual({ party: 'nope' });
  });

  it('does nothing without a schema (back-compat)', () => {
    const proc = run([
      { version: V, createSurface: { surfaceId: 's', catalogId: 'x' } },
      { version: V, updateDataModel: { surfaceId: 's', path: '/anything', value: 42 } }
    ]);
    const surface = proc.surfaces.get('s')!;
    expect(surface.issues.filter((i) => i.code.startsWith('SCHEMA_'))).toEqual([]);
  });
});
