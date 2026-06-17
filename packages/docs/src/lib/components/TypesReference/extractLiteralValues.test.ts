import { describe, expect, it } from 'vitest';
import { extractLiteralValues } from './index';

describe('extractLiteralValues', () => {
  it('extracts single-quoted string literals', () => {
    expect(extractLiteralValues("'filled' | 'outlined' | 'ghost'")).toEqual([
      'filled',
      'outlined',
      'ghost'
    ]);
  });

  it('extracts double-quoted string literals', () => {
    expect(extractLiteralValues('"sm" | "md" | "lg"')).toEqual(['sm', 'md', 'lg']);
  });

  it('extracts boolean literals', () => {
    expect(extractLiteralValues('true | false')).toEqual(['true', 'false']);
  });

  it('extracts numeric literals', () => {
    expect(extractLiteralValues('1 | 2 | 3 | 4')).toEqual(['1', '2', '3', '4']);
  });

  it('handles mixed literal types', () => {
    expect(extractLiteralValues("'auto' | true | 42")).toEqual(['auto', 'true', '42']);
  });

  it('skips non-literal parts like complex types', () => {
    expect(extractLiteralValues("'sm' | 'md' | Record<string, any>")).toEqual(['sm', 'md']);
  });

  it('returns empty array for empty string', () => {
    expect(extractLiteralValues('')).toEqual([]);
  });

  it('returns empty array for undefined-like input', () => {
    expect(extractLiteralValues(undefined as unknown as string)).toEqual([]);
  });

  it('handles single literal value', () => {
    expect(extractLiteralValues("'only'")).toEqual(['only']);
  });

  it('handles whitespace around pipe separators', () => {
    expect(extractLiteralValues("  'a'  |  'b'  |  'c'  ")).toEqual(['a', 'b', 'c']);
  });

  it('does not extract template literal or complex expressions', () => {
    expect(extractLiteralValues('`${prefix}-${suffix}` | string')).toEqual([]);
  });

  it('extracts from real-world variant definitions', () => {
    const result = extractLiteralValues(
      "'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral'"
    );
    expect(result).toEqual(['primary', 'secondary', 'success', 'warning', 'danger', 'neutral']);
  });
});
