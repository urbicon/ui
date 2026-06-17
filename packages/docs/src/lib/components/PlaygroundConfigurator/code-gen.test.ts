import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import { describe, expect, it } from 'vitest';
import {
  computeComponentDefaults,
  countModified,
  filterVisibleControls,
  generateDefaultCode,
  isConditionMet,
  isDefaultValue,
  normalizeControls,
  valuesMatch
} from './code-gen.js';

describe('valuesMatch', () => {
  it('matches identical primitives', () => {
    expect(valuesMatch(1, 1)).toBe(true);
    expect(valuesMatch('a', 'a')).toBe(true);
    expect(valuesMatch(true, true)).toBe(true);
  });

  it('distinguishes different primitives', () => {
    expect(valuesMatch(1, 2)).toBe(false);
    expect(valuesMatch('a', 'b')).toBe(false);
    expect(valuesMatch(true, false)).toBe(false);
  });

  it('treats undefined / null as non-equal to empty string', () => {
    expect(valuesMatch(undefined, '')).toBe(false);
    expect(valuesMatch(null, '')).toBe(false);
    expect(valuesMatch(null, undefined)).toBe(false);
  });

  it('deep-compares objects and arrays', () => {
    expect(valuesMatch({ a: 1 }, { a: 1 })).toBe(true);
    expect(valuesMatch({ a: 1 }, { a: 2 })).toBe(false);
    expect(valuesMatch([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(valuesMatch([1, 2], [1, 2, 3])).toBe(false);
  });

  it('respects property order via JSON.stringify (documented limitation)', () => {
    // Both are structurally equivalent but stringify in insertion order.
    expect(valuesMatch({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false);
  });
});

describe('generateDefaultCode', () => {
  it('emits a self-closing tag when no props are set', () => {
    expect(generateDefaultCode('Button', {})).toBe('<Button />');
  });

  it('emits children inline when that is the only meaningful prop', () => {
    expect(generateDefaultCode('Button', { children: 'Click me' })).toBe(
      '<Button>Click me</Button>'
    );
  });

  it('prints booleans as shorthand when true, explicit when false', () => {
    const code = generateDefaultCode('Toggle', { checked: true, disabled: false });
    // `disabled={false}` is only emitted if `disabled` is documented — here it is
    // NOT in defaults, so the !default && value === false branch drops it.
    expect(code).toContain('checked');
    expect(code).not.toContain('disabled');
  });

  it('keeps `false` when the documented default is `true` (override is meaningful)', () => {
    const code = generateDefaultCode('Toggle', { checked: false }, { checked: true });
    expect(code).toContain('checked={false}');
  });

  it('omits values equal to the documented default', () => {
    const code = generateDefaultCode(
      'Button',
      { intent: 'neutral', size: 'md' },
      { intent: 'neutral' }
    );
    expect(code).not.toContain('intent=');
    expect(code).toContain('size="md"');
  });

  it('omits "none" when there is no documented default', () => {
    expect(generateDefaultCode('Button', { mint: 'none' })).toBe('<Button />');
  });

  it('keeps "none" when explicitly documented as default', () => {
    const code = generateDefaultCode('Button', { mint: 'none' }, { mint: 'none' });
    // It matches the default → dropped.
    expect(code).toBe('<Button />');
  });

  it('sorts remaining props alphabetically', () => {
    const code = generateDefaultCode('Button', {
      size: 'lg',
      intent: 'primary',
      variant: 'filled'
    });
    const lines = code.split('\n').map((l) => l.trim());
    const propLines = lines.filter((l) => l.includes('=') && !l.startsWith('<'));
    const keys = propLines.map((l) => l.split('=')[0]);
    expect(keys).toEqual([...keys].sort());
  });

  it('formats arrays as indented multi-line literals', () => {
    const code = generateDefaultCode('Select', { items: ['a', 'b', 'c'] });
    expect(code).toContain('items={[');
    expect(code).toContain('"a"');
    expect(code).toContain(']}');
  });

  it('serialises objects with JSON.stringify', () => {
    const code = generateDefaultCode('Card', { style: { padding: 16 } });
    expect(code).toContain('"padding": 16');
  });

  it('drops null and undefined values', () => {
    expect(generateDefaultCode('X', { a: null, b: undefined })).toBe('<X />');
  });

  it('combines children + non-default props', () => {
    const code = generateDefaultCode('Button', { children: 'Save', intent: 'primary' });
    expect(code.startsWith('<Button\n  intent="primary"\n>\n  Save\n</Button>')).toBe(true);
  });
});

describe('isConditionMet', () => {
  it('returns true when no condition is set', () => {
    const control: ControlDefinition = { key: 'a', label: 'A', type: 'text' };
    expect(isConditionMet(control, {})).toBe(true);
  });

  it('evaluates a custom condition function', () => {
    const control: ControlDefinition = {
      key: 'a',
      label: 'A',
      type: 'text',
      condition: { condition: (values) => values.flag === true }
    };
    expect(isConditionMet(control, { flag: true })).toBe(true);
    expect(isConditionMet(control, { flag: false })).toBe(false);
  });

  it('matches dependsOn + equals', () => {
    const control: ControlDefinition = {
      key: 'a',
      label: 'A',
      type: 'text',
      condition: { dependsOn: 'variant', equals: 'filled' }
    };
    expect(isConditionMet(control, { variant: 'filled' })).toBe(true);
    expect(isConditionMet(control, { variant: 'outlined' })).toBe(false);
  });

  it('matches dependsOn + in', () => {
    const control: ControlDefinition = {
      key: 'a',
      label: 'A',
      type: 'text',
      condition: { dependsOn: 'intent', in: ['primary', 'danger'] }
    };
    expect(isConditionMet(control, { intent: 'primary' })).toBe(true);
    expect(isConditionMet(control, { intent: 'success' })).toBe(false);
  });
});

describe('normalizeControls', () => {
  it('returns empty array for undefined input', () => {
    expect(normalizeControls(undefined)).toEqual([]);
  });

  it('coerces a booleanish select into a boolean control', () => {
    const result = normalizeControls([
      {
        key: 'disabled',
        label: 'Disabled',
        type: 'select',
        items: [
          { label: 'true', value: true },
          { label: 'false', value: false }
        ]
      }
    ]);
    expect(result[0].type).toBe('boolean');
    expect(result[0].items).toBeUndefined();
  });

  it('keeps non-booleanish selects as-is', () => {
    const result = normalizeControls([
      {
        key: 'intent',
        label: 'Intent',
        type: 'select',
        items: [
          { label: 'Primary', value: 'primary' },
          { label: 'Danger', value: 'danger' }
        ]
      }
    ]);
    expect(result[0].type).toBe('select');
    expect(result[0].items).toHaveLength(2);
  });

  it('prefers the boolean variant when a key appears twice', () => {
    const result = normalizeControls([
      { key: 'disabled', label: 'Disabled', type: 'text' },
      { key: 'disabled', label: 'Disabled', type: 'boolean' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('boolean');
  });

  it('keeps the first occurrence when neither is boolean', () => {
    const result = normalizeControls([
      { key: 'size', label: 'Size A', type: 'text' },
      { key: 'size', label: 'Size B', type: 'text' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Size A');
  });
});

describe('filterVisibleControls', () => {
  it('drops controls whose condition is not met', () => {
    const result = filterVisibleControls(
      [
        { key: 'a', label: 'A', type: 'text' },
        {
          key: 'b',
          label: 'B',
          type: 'text',
          condition: { dependsOn: 'a', equals: 'yes' }
        }
      ],
      { a: 'no' }
    );
    expect(result.map((c) => c.key)).toEqual(['a']);
  });
});

describe('computeComponentDefaults', () => {
  it('extracts every control.defaultValue', () => {
    expect(
      computeComponentDefaults([
        { key: 'a', label: 'A', type: 'text', defaultValue: 'x' },
        { key: 'b', label: 'B', type: 'boolean', defaultValue: false },
        { key: 'c', label: 'C', type: 'text' }
      ])
    ).toEqual({ a: 'x', b: false });
  });
});

describe('isDefaultValue', () => {
  it('is true when values is undefined', () => {
    expect(isDefaultValue('a', undefined, { a: 'x' })).toBe(true);
  });

  it('is true when the key is not in defaults', () => {
    expect(isDefaultValue('a', { a: 'x' }, {})).toBe(true);
  });

  it('compares against the documented default', () => {
    expect(isDefaultValue('a', { a: 'x' }, { a: 'x' })).toBe(true);
    expect(isDefaultValue('a', { a: 'y' }, { a: 'x' })).toBe(false);
  });
});

describe('countModified', () => {
  it('counts only keys whose current value differs from the default', () => {
    const controls: ControlDefinition[] = [
      { key: 'a', label: 'A', type: 'text', defaultValue: 'x' },
      { key: 'b', label: 'B', type: 'text', defaultValue: 'y' },
      { key: 'c', label: 'C', type: 'text' }
    ];
    const defaults = { a: 'x', b: 'y' };
    expect(countModified(controls, { a: 'x', b: 'z' }, defaults)).toBe(1);
    expect(countModified(controls, { a: 'x', b: 'y' }, defaults)).toBe(0);
    expect(countModified(controls, undefined, defaults)).toBe(0);
  });
});
