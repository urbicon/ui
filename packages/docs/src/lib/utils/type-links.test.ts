import { describe, expect, it } from 'vitest';
import { tokenizeTypeExpression } from './type-links';

/** Reassembles segments so every test can assert the rendered text is lossless. */
const flatten = (segments: { text: string }[]) => segments.map((s) => s.text).join('');
/** Just the identifiers that would become links. */
const linked = (segments: { text: string; linked: boolean }[]) =>
  segments.filter((s) => s.linked).map((s) => s.text);

const TYPES = ['ComboboxOption', 'ToastPlacement', 'ToasterSlots', 'ApiProp', 'Snippet'];

describe('tokenizeTypeExpression', () => {
  it('links a bare exact match', () => {
    expect(linked(tokenizeTypeExpression('ToastPlacement', TYPES))).toEqual(['ToastPlacement']);
  });

  it('links the type name inside an array expression, not the brackets', () => {
    const segments = tokenizeTypeExpression('ComboboxOption[]', TYPES);
    expect(linked(segments)).toEqual(['ComboboxOption']);
    expect(flatten(segments)).toBe('ComboboxOption[]');
  });

  it('links a type nested inside generics', () => {
    const segments = tokenizeTypeExpression('Partial<Record<ToasterSlots, string>>', TYPES);
    expect(linked(segments)).toEqual(['ToasterSlots']);
    expect(flatten(segments)).toBe('Partial<Record<ToasterSlots, string>>');
  });

  it('links every occurrence in a union', () => {
    expect(linked(tokenizeTypeExpression('ApiProp | ComboboxOption', TYPES))).toEqual([
      'ApiProp',
      'ComboboxOption'
    ]);
  });

  // --- the "never link wrongly" contract -----------------------------------

  it('does not link an unknown type', () => {
    const segments = tokenizeTypeExpression('HTMLAttributes<HTMLDivElement>', TYPES);
    expect(linked(segments)).toEqual([]);
    expect(flatten(segments)).toBe('HTMLAttributes<HTMLDivElement>');
  });

  it('does not link a substring of a longer identifier', () => {
    // `ApiProp` is a known type, `ApiPropExtra`/`MyApiProp` are not.
    expect(linked(tokenizeTypeExpression('ApiPropExtra', TYPES))).toEqual([]);
    expect(linked(tokenizeTypeExpression('MyApiProp', TYPES))).toEqual([]);
    expect(linked(tokenizeTypeExpression('ApiProps', TYPES))).toEqual([]);
  });

  it('does not link primitives that merely appear in the expression', () => {
    expect(linked(tokenizeTypeExpression('string', ['string2']))).toEqual([]);
    // `string` is not a known type here, so nothing links.
    expect(linked(tokenizeTypeExpression("Partial<Record<'a', string>>", TYPES))).toEqual([]);
  });

  it('never links inside string literals', () => {
    const segments = tokenizeTypeExpression("'ApiProp' | 'ComboboxOption'", TYPES);
    expect(linked(segments)).toEqual([]);
    expect(flatten(segments)).toBe("'ApiProp' | 'ComboboxOption'");
    expect(linked(tokenizeTypeExpression('"ToastPlacement" | "other"', TYPES))).toEqual([]);
  });

  it('does not link a literal union of plain values', () => {
    const segments = tokenizeTypeExpression("'sm' | 'md' | 'lg'", TYPES);
    expect(linked(segments)).toEqual([]);
    expect(flatten(segments)).toBe("'sm' | 'md' | 'lg'");
  });

  it('does not link a member access', () => {
    expect(linked(tokenizeTypeExpression('Foo.ApiProp', TYPES))).toEqual([]);
  });

  it('does not link a property or parameter label', () => {
    // `ApiProp` here is a parameter name, not a type reference.
    expect(linked(tokenizeTypeExpression('(ApiProp: string) => void', TYPES))).toEqual([]);
    expect(linked(tokenizeTypeExpression('{ ApiProp?: string }', TYPES))).toEqual([]);
  });

  it('links the type but not the label in a snippet signature', () => {
    const segments = tokenizeTypeExpression('Snippet<[item: ComboboxOption]>', TYPES);
    expect(linked(segments)).toEqual(['Snippet', 'ComboboxOption']);
    expect(flatten(segments)).toBe('Snippet<[item: ComboboxOption]>');
  });

  it('links the return type of a callback but not its parameter name', () => {
    const segments = tokenizeTypeExpression('(value: ComboboxOption) => void', TYPES);
    expect(linked(segments)).toEqual(['ComboboxOption']);
    expect(flatten(segments)).toBe('(value: ComboboxOption) => void');
  });

  it('leaves a plain function type untouched', () => {
    const segments = tokenizeTypeExpression('(t: number) => number', TYPES);
    expect(linked(segments)).toEqual([]);
    expect(flatten(segments)).toBe('(t: number) => number');
  });

  // --- degenerate input ----------------------------------------------------

  it('returns the expression untouched when no types are known', () => {
    expect(tokenizeTypeExpression('ComboboxOption[]', [])).toEqual([
      { text: 'ComboboxOption[]', linked: false }
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(tokenizeTypeExpression('', TYPES)).toEqual([]);
    expect(tokenizeTypeExpression(undefined, TYPES)).toEqual([]);
  });

  it('is lossless for every expression it touches', () => {
    const expressions = [
      'ComboboxOption[]',
      'Partial<Record<ToasterSlots, string>>',
      "'sm' | 'md'",
      'Snippet<[item: ComboboxOption]>',
      '(value: ComboboxOption) => void',
      'Map<string, ApiProp[]>',
      'ApiProp'
    ];
    for (const expression of expressions) {
      expect(flatten(tokenizeTypeExpression(expression, TYPES))).toBe(expression);
    }
  });

  it('is not confused by a repeated scan (regex lastIndex is reset)', () => {
    const first = linked(tokenizeTypeExpression('ApiProp', TYPES));
    const second = linked(tokenizeTypeExpression('ApiProp', TYPES));
    expect(first).toEqual(['ApiProp']);
    expect(second).toEqual(['ApiProp']);
  });
});
