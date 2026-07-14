import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import { describe, expect, it } from 'vitest';
import {
  clampToRange,
  computeComponentDefaults,
  countModified,
  filterVisibleControls,
  generateDefaultCode,
  isConditionMet,
  isDefaultValue,
  isWithinRange,
  normalizeControls,
  numberFieldValue,
  readNumberField,
  reconcileNumberField,
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

/**
 * `min`/`max` on `<input type="number">` are validity constraints, not input
 * filters: the field hands back whatever was typed. The strip used to write
 * `Number(e.currentTarget.value)` straight into `values`, so clearing the
 * field meant `Number('')` → 0 and typing past a bound stuck an out-of-range
 * number into a map the share codec then refused to carry.
 */
describe('number field', () => {
  // Verbatim from the "All Controls" playground on
  // /docs/components/playground-configurator.
  const count: ControlDefinition = {
    key: 'count',
    type: 'number',
    label: 'Count',
    defaultValue: 3,
    min: 0,
    max: 20,
    step: 1
  };
  const unbounded: ControlDefinition = { key: 'count', type: 'number', label: 'Count' };
  // `/table/table` "Items per page": a floor, no ceiling.
  const floored: ControlDefinition = {
    key: 'itemsPerPage',
    type: 'number',
    label: 'Items per page',
    defaultValue: 5,
    min: 3
  };

  describe('isWithinRange', () => {
    it('admits both bounds and rejects just outside them', () => {
      expect(isWithinRange(count, 0)).toBe(true);
      expect(isWithinRange(count, 20)).toBe(true);
      expect(isWithinRange(count, -1)).toBe(false);
      expect(isWithinRange(count, 21)).toBe(false);
    });

    it('admits anything when a bound is absent', () => {
      expect(isWithinRange(unbounded, -9999)).toBe(true);
      expect(isWithinRange(unbounded, 9999)).toBe(true);
      expect(isWithinRange(floored, 9999)).toBe(true);
      expect(isWithinRange(floored, 2)).toBe(false);
    });
  });

  describe('clampToRange', () => {
    it('pulls a value to the bound it violates and leaves the rest alone', () => {
      expect(clampToRange(count, 999)).toBe(20);
      expect(clampToRange(count, -5)).toBe(0);
      expect(clampToRange(count, 7)).toBe(7);
      expect(clampToRange(unbounded, 999)).toBe(999);
      expect(clampToRange(floored, 0)).toBe(3);
    });
  });

  describe('numberFieldValue', () => {
    it('prefers the current value, then the default, then the floor', () => {
      expect(numberFieldValue(count, { count: 7 })).toBe(7);
      expect(numberFieldValue(count, {})).toBe(3);
      expect(numberFieldValue(count, undefined)).toBe(3);
      expect(numberFieldValue(floored, {})).toBe(5);
      // No value, no default: the floor, never a hardcoded 0 that would sit
      // below `min` and be rejected by the codec on the way out.
      expect(numberFieldValue({ key: 'n', type: 'number', label: 'N', min: 3 }, {})).toBe(3);
      expect(numberFieldValue({ key: 'n', type: 'number', label: 'N' }, {})).toBe(0);
    });

    it('ignores a value of the wrong shape', () => {
      expect(numberFieldValue(count, { count: 'seven' })).toBe(3);
      expect(numberFieldValue(count, { count: Number.NaN })).toBe(3);
      expect(numberFieldValue(count, { count: Number.POSITIVE_INFINITY })).toBe(3);
    });
  });

  describe('readNumberField', () => {
    it('commits an in-range number', () => {
      expect(readNumberField(count, '7')).toBe(7);
      expect(readNumberField(count, '0')).toBe(0);
      expect(readNumberField(count, '20')).toBe(20);
    });

    it('holds back a blank field instead of reading it as 0', () => {
      // `Number('')` and `Number(' ')` are both 0. Committing that meant
      // clearing "Items per page" silently asked the Table for zero rows.
      expect(readNumberField(count, '')).toBeUndefined();
      expect(readNumberField(count, '   ')).toBeUndefined();
      expect(readNumberField(floored, '')).toBeUndefined();
    });

    it('holds back an unparseable field', () => {
      expect(readNumberField(count, 'abc')).toBeUndefined();
      expect(readNumberField(count, 'Infinity')).toBeUndefined();
      expect(readNumberField(count, 'NaN')).toBeUndefined();
    });

    it('holds back an out-of-range number rather than clamping under the caret', () => {
      // A reader typing "15" into a `min: 10` field passes through "1".
      const tens: ControlDefinition = { key: 'n', type: 'number', label: 'N', min: 10, max: 99 };
      expect(readNumberField(tens, '1')).toBeUndefined();
      expect(readNumberField(tens, '15')).toBe(15);
      expect(readNumberField(count, '999')).toBeUndefined();
      expect(readNumberField(count, '-1')).toBeUndefined();
    });
  });

  describe('reconcileNumberField', () => {
    it('clamps what the reader typed once they leave the field', () => {
      expect(reconcileNumberField(count, '999', 3)).toBe(20);
      expect(reconcileNumberField(count, '-5', 3)).toBe(0);
      expect(reconcileNumberField(floored, '0', 5)).toBe(3);
    });

    it('restores the committed value when the field is left blank or broken', () => {
      expect(reconcileNumberField(count, '', 7)).toBe(7);
      expect(reconcileNumberField(count, '   ', 7)).toBe(7);
      expect(reconcileNumberField(count, 'abc', 7)).toBe(7);
      expect(reconcileNumberField(count, 'NaN', 7)).toBe(7);
    });

    it('leaves an in-range number exactly as typed', () => {
      expect(reconcileNumberField(count, '12', 3)).toBe(12);
      expect(reconcileNumberField(unbounded, '999', 3)).toBe(999);
    });

    it('always settles somewhere the codec will carry', () => {
      // The property the strip owes `share.ts`: whatever a reader does to the
      // field, what lands in `values` is in range, so the link can hold it.
      for (const raw of ['', ' ', 'abc', 'NaN', 'Infinity', '-999', '999', '0', '20', '7.5']) {
        expect(isWithinRange(count, reconcileNumberField(count, raw, 3))).toBe(true);
      }
    });
  });
});
