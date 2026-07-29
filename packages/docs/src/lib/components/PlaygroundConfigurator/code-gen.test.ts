import type { ControlDefinition, ControlOption } from '@urbicon-ui/shared-types/playground';
import { describe, expect, it } from 'vitest';
import {
  clampToRange,
  computeComponentDefaults,
  computeDemoOnlyKeys,
  computeOmittableDefaults,
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
  resolveSegmentValue,
  resolveSelectValue,
  selectDisplayValue,
  serializeValue,
  valuesMatch
} from './code-gen.js';
import { deriveControls } from './deriveControls';

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

describe('generateDefaultCode — extracted child markup', () => {
  it('prints markup between the tags instead of self-closing', () => {
    const markup =
      '<SegmentItem value="list">List</SegmentItem>\n<SegmentItem value="grid">Grid</SegmentItem>';
    expect(generateDefaultCode('SegmentGroup', {}, {}, undefined, markup)).toBe(
      [
        '<SegmentGroup>',
        '  <SegmentItem value="list">List</SegmentItem>',
        '  <SegmentItem value="grid">Grid</SegmentItem>',
        '</SegmentGroup>'
      ].join('\n')
    );
  });

  it('breaks a long one-liner rather than running past the print width', () => {
    const long = `<Button variant="outlined">${'x'.repeat(90)}</Button>`;
    const code = generateDefaultCode('Tooltip', {}, {}, undefined, long);
    expect(code.startsWith('<Tooltip>\n  <Button')).toBe(true);
  });

  it('indents multi-line markup one level under the tag', () => {
    const markup = '{#snippet header()}\n  <div>Card Title</div>\n{/snippet}';
    expect(generateDefaultCode('Card', { variant: 'outlined' }, {}, undefined, markup)).toBe(
      [
        '<Card',
        '  variant="outlined"',
        '>',
        '  {#snippet header()}',
        '    <div>Card Title</div>',
        '  {/snippet}',
        '</Card>'
      ].join('\n')
    );
  });

  it('keeps a one-liner on one line', () => {
    expect(generateDefaultCode('Tooltip', {}, {}, undefined, '<Button>Hover me</Button>')).toBe(
      '<Tooltip><Button>Hover me</Button></Tooltip>'
    );
  });

  it('lets a `children` control win — that is the reader’s own text', () => {
    const code = generateDefaultCode('Button', { children: 'Click me' }, {}, undefined, '<Icon />');
    expect(code).toBe('<Button>Click me</Button>');
  });

  it('falls back to the self-closing tag for blank or absent markup', () => {
    expect(generateDefaultCode('Card', {}, {}, undefined, null)).toBe('<Card />');
    expect(generateDefaultCode('Card', {}, {}, undefined, '   \n  ')).toBe('<Card />');
  });

  it('composes with a codeSetup script block', () => {
    const code = generateDefaultCode(
      'Chat',
      {},
      {},
      { consts: { messages: [{ id: '1' }] }, bind: ['messages'] },
      '<ChatMessageList {messages} />'
    );
    expect(code).toContain('const messages = ');
    expect(code).toContain('<Chat\n  {messages}\n>\n  <ChatMessageList {messages} />\n</Chat>');
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

  it('converts the string defaults along with the type', () => {
    // The type said boolean, the value stayed `'false'` — and `Boolean('false')`
    // is `true`, so the switch rendered "on" while the component read the
    // string back as off. A boolean control must carry booleans.
    const result = normalizeControls([
      {
        key: 'accentEdge',
        label: 'Accent Edge',
        type: 'dropdown',
        defaultValue: 'false',
        componentDefault: 'false',
        items: [
          { label: 'false', value: 'false' },
          { label: 'true', value: 'true' }
        ]
      }
    ]);
    expect(result[0].type).toBe('boolean');
    expect(result[0].defaultValue).toBe(false);
    expect(result[0].componentDefault).toBe(false);
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

/**
 * Reproduces the `[Select] value 2 has no matching option` DEV warning on
 * `/docs/components/section`: the dropdown `<Select>` branch builds its
 * options via `items.map(item => String(item.value))` (strings) while
 * `headingLevel` itself is bound as the raw number `2`. `2 !== '2'`, so the
 * trigger fell back to the placeholder even though a value was set.
 */
describe('selectDisplayValue / resolveSelectValue (Select boundary)', () => {
  const headingLevelItems: ControlOption[] = [
    { label: 'H1', value: 1 },
    { label: 'H2', value: 2 },
    { label: 'H3', value: 3 },
    { label: 'H4', value: 4 },
    { label: 'H5', value: 5 },
    { label: 'H6', value: 6 }
  ];

  describe('selectDisplayValue', () => {
    it('stringifies a numeric value so it matches the string-valued options', () => {
      expect(selectDisplayValue(2)).toBe('2');
    });

    it('stringifies booleans and strings the same way', () => {
      expect(selectDisplayValue(true)).toBe('true');
      expect(selectDisplayValue('primary')).toBe('primary');
    });

    it('passes null/undefined through unchanged (placeholder / null-option branch)', () => {
      expect(selectDisplayValue(null)).toBeNull();
      expect(selectDisplayValue(undefined)).toBeNull();
    });
  });

  describe('resolveSelectValue', () => {
    it('maps the selected string back to the original, typed item.value', () => {
      expect(resolveSelectValue(headingLevelItems, '2')).toBe(2);
      expect(typeof resolveSelectValue(headingLevelItems, '2')).toBe('number');
    });

    it('round-trips display -> selection back to the same typed value', () => {
      const original = 2;
      const displayed = selectDisplayValue(original);
      expect(resolveSelectValue(headingLevelItems, displayed)).toBe(original);
    });

    it('maps null straight through (the null-option / "clear" selection)', () => {
      expect(resolveSelectValue(headingLevelItems, null)).toBeNull();
    });

    it('falls back to the raw string when no item matches', () => {
      expect(resolveSelectValue(headingLevelItems, '99')).toBe('99');
    });
  });

  describe('resolveSegmentValue (SegmentGroup boundary)', () => {
    const booleanItems: ControlOption[] = [
      { label: 'On', value: true },
      { label: 'Off', value: false }
    ];

    it('maps a numeric enum selection back to its typed value', () => {
      expect(resolveSegmentValue(headingLevelItems, '3')).toBe(3);
      expect(typeof resolveSegmentValue(headingLevelItems, '3')).toBe('number');
    });

    it('maps a boolean enum selection back to its typed value', () => {
      expect(resolveSegmentValue(booleanItems, 'false')).toBe(false);
    });

    it("maps SegmentGroup's cleared-selection empty string to null", () => {
      expect(resolveSegmentValue(headingLevelItems, '')).toBeNull();
    });

    it('round-trips display -> segment selection back to the same typed value', () => {
      const original = 4;
      const displayed = selectDisplayValue(original) ?? '';
      expect(resolveSegmentValue(headingLevelItems, displayed)).toBe(original);
    });
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

describe('serializeValue', () => {
  it('prints strings in the repo style, not JSON style', () => {
    expect(serializeValue('Berlin')).toBe("'Berlin'");
    expect(serializeValue("it's")).toBe("'it\\'s'");
  });

  // A quoted literal with a line break in it does not parse. `CodeBlock`'s
  // `code` const shipped exactly that: a snippet whose first line ended in an
  // unterminated string, under a "copy" button.
  it('prints a multi-line string as a template literal', () => {
    expect(serializeValue('line one\nline two')).toBe('`line one\nline two`');
  });

  it('escapes what would end or interpolate the template literal', () => {
    expect(serializeValue('a `tick`\nand ${expr}')).toBe('`a \\`tick\\`\nand \\${expr}`');
  });

  it('leaves a single-line string quoted, backticks and all', () => {
    expect(serializeValue('a `tick`')).toBe("'a `tick`'");
  });

  it('leaves identifier keys unquoted', () => {
    expect(serializeValue({ accessor: 'name', sortable: true })).toBe(
      "{ accessor: 'name', sortable: true }"
    );
  });

  it('quotes a key that is not an identifier', () => {
    expect(serializeValue({ 'data-id': 1 })).toBe("{ 'data-id': 1 }");
  });

  it('keeps a short array on one line and breaks one that holds objects', () => {
    expect(serializeValue([1, 2, 3])).toBe('[1, 2, 3]');

    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: i,
      name: `A rather long employee name ${i}`,
      role: 'Staff Engineer'
    }));
    const out = serializeValue(rows);
    expect(out.startsWith('[\n')).toBe(true);
    // Each row still fits on its own line — only the outer array breaks.
    expect(out.split('\n')).toHaveLength(5);
  });

  it('never splits a flat record, however long it gets', () => {
    // A data row is one unit. Spread over six lines it reads worse than a few
    // characters of overflow — and eight of them turn a snippet into a wall.
    const row = {
      id: 1,
      name: 'Emma Wilson',
      role: 'Staff Engineer',
      department: 'Platform',
      location: 'Berlin'
    };
    const out = serializeValue([row], 2);

    expect(out.split('\n')).toHaveLength(3);
    expect(out).toContain(
      "{ id: 1, name: 'Emma Wilson', role: 'Staff Engineer', department: 'Platform', location: 'Berlin' }"
    );
  });

  it('breaks a nested record once it outgrows the line, but not before', () => {
    // Nesting alone is no reason to unfold — a short tree reads fine inline.
    expect(serializeValue({ id: 'root', meta: { a: 1 }, children: ['x'] })).toBe(
      "{ id: 'root', meta: { a: 1 }, children: ['x'] }"
    );

    const wide = {
      id: 'root',
      component: 'Column',
      children: ['title', 'email', 'password', 'submit', 'footnote', 'disclaimer']
    };
    expect(serializeValue(wide).split('\n').length).toBeGreaterThan(1);
  });

  it('refuses functions rather than dropping them silently', () => {
    // A printed arrow function usually closes over identifiers the snippet
    // does not contain, so a copied snippet would not compile.
    expect(() => serializeValue({ sort: () => 0 })).toThrow(/raw/);
  });

  it('passes a raw wrapper through untouched', () => {
    expect(serializeValue({ raw: '(a, b) => a - b' })).toBe('(a, b) => a - b');
  });

  it('prints a Date as constructible source', () => {
    expect(serializeValue(new Date('2026-01-01T09:41:00.000Z'))).toBe(
      "new Date('2026-01-01T09:41:00.000Z')"
    );
  });
});

describe('generateDefaultCode with a codeSetup', () => {
  const SETUP = {
    imports: ["import { Table } from '@urbicon-ui/table';"],
    consts: { columns: [{ accessor: 'name', title: 'Name' }], items: [{ id: 1, name: 'Emma' }] },
    bind: ['columns', 'items']
  };

  it('emits a complete file: imports, data, then the tag', () => {
    const code = generateDefaultCode('Table', { itemsPerPage: 5 }, { itemsPerPage: 10 }, SETUP);

    expect(code).toBe(
      `<script lang="ts">
  import { Table } from '@urbicon-ui/table';

  const columns = [{ accessor: 'name', title: 'Name' }];
  const items = [{ id: 1, name: 'Emma' }];
</script>

<Table
  {columns}
  {items}
  itemsPerPage={5}
/>`
    );
  });

  it('still drops control values that match the component default', () => {
    const code = generateDefaultCode('Table', { itemsPerPage: 10 }, { itemsPerPage: 10 }, SETUP);

    expect(code).not.toContain('itemsPerPage');
    expect(code).toContain('{columns}');
  });

  it('omits demo-only controls — they are not props of the component', () => {
    // A2UIView's scenario switch drives the payload; `scenario="survey"` as an
    // attribute would be an API that does not exist.
    const code = generateDefaultCode(
      'A2UIView',
      { scenario: 'survey', streaming: true },
      {},
      { bind: ['payload'], demoOnly: ['scenario'] }
    );

    expect(code).not.toContain('scenario');
    expect(code).toContain('streaming');
  });

  it('is byte-identical to the old output when no setup is given', () => {
    expect(generateDefaultCode('Button', { variant: 'ghost', children: 'Get started' })).toBe(
      '<Button\n  variant="ghost"\n>\n  Get started\n</Button>'
    );
  });
});

describe('computeOmittableDefaults', () => {
  it('prefers the component default over the playground starting point', () => {
    // Otherwise the snippet omits `itemsPerPage={5}` — and a reader copying it
    // gets ten rows per page while the preview above shows five.
    const controls = [
      {
        key: 'itemsPerPage',
        label: 'Items per page',
        type: 'number' as const,
        defaultValue: 5,
        componentDefault: 10
      }
    ];

    expect(computeOmittableDefaults(controls)).toEqual({ itemsPerPage: 10 });
    expect(computeComponentDefaults(controls)).toEqual({ itemsPerPage: 5 });
  });

  it('falls back to the starting point when no component default is recorded', () => {
    const controls = [{ key: 'label', label: 'Label', type: 'text' as const, defaultValue: 'Hi' }];

    expect(computeOmittableDefaults(controls)).toEqual({ label: 'Hi' });
  });
});

describe('generateDefaultCode with bindable state', () => {
  it('declares the state and binds it, rather than printing a dead attribute', () => {
    const code = generateDefaultCode(
      'Dialog',
      { title: 'Confirm' },
      {},
      {
        imports: ["import { Dialog } from '@urbicon-ui/blocks';"],
        state: { open: false },
        twoWay: ['open']
      }
    );

    expect(code).toContain('let open = $state(false);');
    expect(code).toContain('bind:open');
    expect(code).not.toContain('{open}');
  });

  it('keeps `consts` on the shorthand form and `state` on the bind form', () => {
    const code = generateDefaultCode(
      'FileUpload',
      {},
      {},
      { consts: { accept: ['image/*'] }, state: { files: [] }, bind: ['accept'], twoWay: ['files'] }
    );

    expect(code).toContain('{accept}');
    expect(code).toContain('bind:files');
  });

  it('drops a control the derivation marked demo-only', () => {
    // `extra` controls steer the demo; as an attribute they would document an
    // API that does not exist.
    const controls = deriveControls(
      { variants: [{ name: 'size', values: ['sm', 'md'], defaultValue: 'sm' }] },
      {
        pick: ['size'],
        extra: [{ type: 'dropdown', key: 'scenario', label: 'Scenario', defaultValue: 'a' }]
      }
    );
    expect(controls.find((c) => c.key === 'scenario')?.demoOnly).toBe(true);
    expect(controls.find((c) => c.key === 'size')?.demoOnly).toBeUndefined();

    const code = generateDefaultCode(
      'A2UIView',
      { scenario: 'b', size: 'md' },
      { size: 'sm' },
      { demoOnly: computeDemoOnlyKeys(controls) }
    );
    expect(code).not.toContain('scenario');
    expect(code).toContain('size="md"');
  });
});

describe('computeOmittableDefaults and props without a component default', () => {
  it('never omits a value the component has no default for', () => {
    // An Alert whose `title` is dropped from the snippet renders without a
    // heading — a different component than the preview shows.
    const controls = deriveControls(
      { props: [{ name: 'title', type: 'string' }] },
      { pick: ['title'], overrides: { title: { defaultValue: 'Heads up!' } } }
    );

    expect(computeOmittableDefaults(controls)).toEqual({});
    expect(
      generateDefaultCode('Alert', { title: 'Heads up!' }, computeOmittableDefaults(controls))
    ).toContain('title="Heads up!"');
  });

  it('still omits a value that equals a documented component default', () => {
    const controls = deriveControls(
      { variants: [{ name: 'size', values: ['sm', 'md'], defaultValue: 'md' }] },
      { pick: ['size'] }
    );

    expect(generateDefaultCode('Badge', { size: 'md' }, computeOmittableDefaults(controls))).toBe(
      '<Badge />'
    );
  });
});
