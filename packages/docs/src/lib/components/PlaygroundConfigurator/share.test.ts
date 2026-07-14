import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import { describe, expect, it } from 'vitest';
import { decodeShareParams, encodeShareParams } from './share.js';

const controls: ControlDefinition[] = [
  {
    type: 'dropdown',
    key: 'variant',
    label: 'Variant',
    items: [
      { label: 'filled', value: 'filled' },
      { label: 'outlined', value: 'outlined' },
      { label: 'soft', value: 'soft' }
    ],
    defaultValue: 'filled'
  },
  {
    type: 'dropdown',
    key: 'size',
    label: 'Size',
    items: [
      { label: 'sm', value: 'sm' },
      { label: 'md', value: 'md' },
      { label: 'lg', value: 'lg' }
    ],
    defaultValue: 'md'
  },
  { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
  { type: 'text', key: 'label', label: 'Label', defaultValue: 'New' },
  { type: 'slider', key: 'width', label: 'Width', min: 0, max: 100, defaultValue: 50 },
  { type: 'color', key: 'tint', label: 'Tint', defaultValue: '#000000' }
];

const defaults = {
  variant: 'filled',
  size: 'md',
  disabled: false,
  label: 'New',
  width: 50,
  tint: '#000000'
};

describe('encodeShareParams', () => {
  it('emits nothing when every value is at its default', () => {
    expect(encodeShareParams(controls, defaults)).toBe('');
  });

  it('emits only the modified keys', () => {
    expect(encodeShareParams(controls, { ...defaults, variant: 'outlined' })).toBe(
      'variant=outlined'
    );
  });

  it('keeps declaration order across several modified keys', () => {
    const query = encodeShareParams(controls, {
      ...defaults,
      size: 'lg',
      variant: 'outlined',
      disabled: true
    });
    expect(query).toBe('variant=outlined&size=lg&disabled=1');
  });

  it('encodes booleans as 1 / 0 rather than true / false', () => {
    expect(encodeShareParams(controls, { ...defaults, disabled: true })).toBe('disabled=1');
    // `false` is this control's default, so a `disabled=0` link is only
    // reachable for a control whose default is `true`.
    const inverted: ControlDefinition[] = [
      { type: 'checkbox', key: 'border', label: 'Border', defaultValue: true }
    ];
    expect(encodeShareParams(inverted, { border: false })).toBe('border=0');
  });

  it('encodes numbers as decimal strings', () => {
    expect(encodeShareParams(controls, { ...defaults, width: 75 })).toBe('width=75');
  });

  it('percent-encodes text that is not URL-safe', () => {
    const query = encodeShareParams(controls, { ...defaults, label: 'a b&c=d' });
    expect(query).toBe('label=a+b%26c%3Dd');
    expect(new URLSearchParams(query).get('label')).toBe('a b&c=d');
  });

  it('returns empty for undefined values', () => {
    expect(encodeShareParams(controls, undefined)).toBe('');
  });

  it('returns empty for undefined controls', () => {
    expect(encodeShareParams(undefined, defaults)).toBe('');
  });

  it('skips a control that declares no defaultValue, matching the dirty-state model', () => {
    const noDefault: ControlDefinition[] = [{ type: 'text', key: 'note', label: 'Note' }];
    expect(encodeShareParams(noDefault, { note: 'typed' })).toBe('');
  });

  it('skips a value whose shape does not match its control type', () => {
    // A non-finite number cannot survive the round trip, so it is never written.
    expect(encodeShareParams(controls, { ...defaults, width: Number.NaN })).toBe('');
    expect(encodeShareParams(controls, { ...defaults, width: Number.POSITIVE_INFINITY })).toBe('');
  });

  it('skips control types the strip does not render', () => {
    const unsupported: ControlDefinition[] = [
      { type: 'json', key: 'data', label: 'Data', defaultValue: 'a' }
    ];
    expect(encodeShareParams(unsupported, { data: 'b' })).toBe('');
  });

  it('routes a booleanish dropdown through the boolean arm', () => {
    const booleanish: ControlDefinition[] = [
      {
        type: 'dropdown',
        key: 'border',
        label: 'Border',
        items: [
          { label: 'yes', value: true },
          { label: 'no', value: false }
        ],
        defaultValue: false
      }
    ];
    expect(encodeShareParams(booleanish, { border: true })).toBe('border=1');
  });
});

describe('decodeShareParams', () => {
  it('returns an empty map for an empty search string', () => {
    expect(decodeShareParams(controls, '')).toEqual({});
    expect(decodeShareParams(controls, undefined)).toEqual({});
  });

  it('accepts a search string with or without the leading ?', () => {
    expect(decodeShareParams(controls, '?variant=outlined')).toEqual({ variant: 'outlined' });
    expect(decodeShareParams(controls, 'variant=outlined')).toEqual({ variant: 'outlined' });
  });

  it('decodes each supported type into its runtime shape', () => {
    expect(
      decodeShareParams(controls, '?variant=soft&disabled=1&width=20&label=Hi&tint=%23ff0000')
    ).toEqual({
      variant: 'soft',
      disabled: true,
      width: 20,
      label: 'Hi',
      tint: '#ff0000'
    });
  });

  it('decodes 0 as false, not as a falsy string', () => {
    expect(decodeShareParams(controls, '?disabled=0')).toEqual({ disabled: false });
  });

  it('ignores an unknown key', () => {
    expect(decodeShareParams(controls, '?bogus=1&variant=soft')).toEqual({ variant: 'soft' });
  });

  it('ignores an enum value that is not in items', () => {
    expect(decodeShareParams(controls, '?variant=neon')).toEqual({});
  });

  it('ignores a boolean that is not 1 or 0', () => {
    expect(decodeShareParams(controls, '?disabled=true')).toEqual({});
    expect(decodeShareParams(controls, '?disabled=')).toEqual({});
  });

  it('ignores a non-numeric, blank or non-finite number', () => {
    expect(decodeShareParams(controls, '?width=abc')).toEqual({});
    expect(decodeShareParams(controls, '?width=')).toEqual({});
    expect(decodeShareParams(controls, '?width=%20')).toEqual({});
    expect(decodeShareParams(controls, '?width=Infinity')).toEqual({});
    expect(decodeShareParams(controls, '?width=NaN')).toEqual({});
  });

  it('rejects an out-of-range number rather than clamping it', () => {
    expect(decodeShareParams(controls, '?width=999')).toEqual({});
    expect(decodeShareParams(controls, '?width=-1')).toEqual({});
    expect(decodeShareParams(controls, '?width=0')).toEqual({ width: 0 });
    expect(decodeShareParams(controls, '?width=100')).toEqual({ width: 100 });
  });

  it('ignores a malformed colour', () => {
    expect(decodeShareParams(controls, '?tint=red')).toEqual({});
    expect(decodeShareParams(controls, '?tint=%23fff')).toEqual({});
    expect(decodeShareParams(controls, '?tint=%23FF00AA')).toEqual({ tint: '#FF00AA' });
  });

  it('accepts any text, including the empty string', () => {
    expect(decodeShareParams(controls, '?label=')).toEqual({ label: '' });
  });

  it('ignores control types the strip does not render', () => {
    const unsupported: ControlDefinition[] = [
      { type: 'json', key: 'data', label: 'Data', defaultValue: 'a' }
    ];
    expect(decodeShareParams(unsupported, '?data=b')).toEqual({});
  });

  it('takes the first occurrence of a repeated key', () => {
    expect(decodeShareParams(controls, '?size=sm&size=lg')).toEqual({ size: 'sm' });
  });

  it('never throws on a hand-mangled URL', () => {
    expect(() => decodeShareParams(controls, '?&&=&variant&width=&%%%')).not.toThrow();
    expect(decodeShareParams(controls, '?&&=&variant&width=&%%%')).toEqual({});
  });

  it('routes a booleanish dropdown through the boolean arm', () => {
    const booleanish: ControlDefinition[] = [
      {
        type: 'dropdown',
        key: 'border',
        label: 'Border',
        items: [
          { label: 'yes', value: true },
          { label: 'no', value: false }
        ],
        defaultValue: false
      }
    ];
    expect(decodeShareParams(booleanish, '?border=1')).toEqual({ border: true });
    expect(decodeShareParams(booleanish, '?border=true')).toEqual({});
  });
});

describe('round trip', () => {
  it('restores the modified subset a reader actually chose', () => {
    const chosen = {
      ...defaults,
      variant: 'outlined',
      size: 'lg',
      disabled: true,
      label: 'Ship it',
      width: 12,
      tint: '#00ff88'
    };
    const decoded = decodeShareParams(controls, `?${encodeShareParams(controls, chosen)}`);
    expect({ ...defaults, ...decoded }).toEqual(chosen);
  });

  it('leaves the recipient on the defaults when nothing was modified', () => {
    const decoded = decodeShareParams(controls, `?${encodeShareParams(controls, defaults)}`);
    expect({ ...defaults, ...decoded }).toEqual(defaults);
  });
});
