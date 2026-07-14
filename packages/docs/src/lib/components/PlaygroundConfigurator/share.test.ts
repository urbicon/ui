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

/** Stand-in for the emitting playground's `shareKey ?? componentName`. */
const SCOPE = 'Demo';

describe('encodeShareParams', () => {
  it('emits nothing when every value is at its default', () => {
    expect(encodeShareParams(controls, defaults, SCOPE)).toBe('');
  });

  it('emits only the modified keys, behind the scope', () => {
    expect(encodeShareParams(controls, { ...defaults, variant: 'outlined' }, SCOPE)).toBe(
      '_pg=Demo&variant=outlined'
    );
  });

  it('keeps declaration order across several modified keys', () => {
    const query = encodeShareParams(
      controls,
      { ...defaults, size: 'lg', variant: 'outlined', disabled: true },
      SCOPE
    );
    expect(query).toBe('_pg=Demo&variant=outlined&size=lg&disabled=1');
  });

  it('encodes booleans as 1 / 0 rather than true / false', () => {
    expect(encodeShareParams(controls, { ...defaults, disabled: true }, SCOPE)).toBe(
      '_pg=Demo&disabled=1'
    );
    // `false` is this control's default, so a `disabled=0` link is only
    // reachable for a control whose default is `true`.
    const inverted: ControlDefinition[] = [
      { type: 'checkbox', key: 'border', label: 'Border', defaultValue: true }
    ];
    expect(encodeShareParams(inverted, { border: false }, SCOPE)).toBe('_pg=Demo&border=0');
  });

  it('encodes numbers as decimal strings', () => {
    expect(encodeShareParams(controls, { ...defaults, width: 75 }, SCOPE)).toBe(
      '_pg=Demo&width=75'
    );
  });

  it('percent-encodes text that is not URL-safe', () => {
    const query = encodeShareParams(controls, { ...defaults, label: 'a b&c=d' }, SCOPE);
    expect(query).toBe('_pg=Demo&label=a+b%26c%3Dd');
    expect(new URLSearchParams(query).get('label')).toBe('a b&c=d');
  });

  it('percent-encodes a scope that is not URL-safe', () => {
    const query = encodeShareParams(controls, { ...defaults, size: 'lg' }, 'Button sizes');
    expect(new URLSearchParams(query).get('_pg')).toBe('Button sizes');
    expect(decodeShareParams(controls, `?${query}`, 'Button sizes')).toEqual({ size: 'lg' });
  });

  it('returns empty for undefined values', () => {
    expect(encodeShareParams(controls, undefined, SCOPE)).toBe('');
  });

  it('returns empty for undefined controls', () => {
    expect(encodeShareParams(undefined, defaults, SCOPE)).toBe('');
  });

  it('skips a control that declares no defaultValue, matching the dirty-state model', () => {
    const noDefault: ControlDefinition[] = [{ type: 'text', key: 'note', label: 'Note' }];
    expect(encodeShareParams(noDefault, { note: 'typed' }, SCOPE)).toBe('');
  });

  it('skips a value whose shape does not match its control type', () => {
    // A non-finite number cannot survive the round trip, so it is never written.
    expect(encodeShareParams(controls, { ...defaults, width: Number.NaN }, SCOPE)).toBe('');
    expect(
      encodeShareParams(controls, { ...defaults, width: Number.POSITIVE_INFINITY }, SCOPE)
    ).toBe('');
  });

  it('skips control types the strip does not render', () => {
    const unsupported: ControlDefinition[] = [
      { type: 'json', key: 'data', label: 'Data', defaultValue: 'a' }
    ];
    expect(encodeShareParams(unsupported, { data: 'b' }, SCOPE)).toBe('');
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
    expect(encodeShareParams(booleanish, { border: true }, SCOPE)).toBe('_pg=Demo&border=1');
  });

  it('never emits a lone scope: a link of pure defaults stays empty', () => {
    // Otherwise "nothing is modified" would still mint `?_pg=Demo`, and the
    // strip's own gate (share row hidden until `modifiedCount > 0`) and the
    // codec would stop telling the same story.
    expect(encodeShareParams(controls, defaults, SCOPE)).toBe('');
    expect(encodeShareParams(controls, { ...defaults, width: Number.NaN }, SCOPE)).toBe('');
  });
});

describe('decodeShareParams', () => {
  it('returns an empty map for an empty search string', () => {
    expect(decodeShareParams(controls, '', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, undefined, SCOPE)).toEqual({});
  });

  it('accepts a search string with or without the leading ?', () => {
    expect(decodeShareParams(controls, '?_pg=Demo&variant=outlined', SCOPE)).toEqual({
      variant: 'outlined'
    });
    expect(decodeShareParams(controls, '_pg=Demo&variant=outlined', SCOPE)).toEqual({
      variant: 'outlined'
    });
  });

  it('decodes each supported type into its runtime shape', () => {
    expect(
      decodeShareParams(
        controls,
        '?_pg=Demo&variant=soft&disabled=1&width=20&label=Hi&tint=%23ff0000',
        SCOPE
      )
    ).toEqual({
      variant: 'soft',
      disabled: true,
      width: 20,
      label: 'Hi',
      tint: '#ff0000'
    });
  });

  it('decodes 0 as false, not as a falsy string', () => {
    expect(decodeShareParams(controls, '?disabled=0', SCOPE)).toEqual({ disabled: false });
  });

  it('ignores an unknown key', () => {
    expect(decodeShareParams(controls, '?bogus=1&variant=soft', SCOPE)).toEqual({
      variant: 'soft'
    });
  });

  it('ignores an enum value that is not in items', () => {
    expect(decodeShareParams(controls, '?variant=neon', SCOPE)).toEqual({});
  });

  it('ignores a boolean that is not 1 or 0', () => {
    expect(decodeShareParams(controls, '?disabled=true', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?disabled=', SCOPE)).toEqual({});
  });

  it('ignores a non-numeric, blank or non-finite number', () => {
    expect(decodeShareParams(controls, '?width=abc', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?width=', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?width=%20', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?width=Infinity', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?width=NaN', SCOPE)).toEqual({});
  });

  it('rejects an out-of-range number rather than clamping it', () => {
    expect(decodeShareParams(controls, '?width=999', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?width=-1', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?width=0', SCOPE)).toEqual({ width: 0 });
    expect(decodeShareParams(controls, '?width=100', SCOPE)).toEqual({ width: 100 });
  });

  it('ignores a malformed colour', () => {
    expect(decodeShareParams(controls, '?tint=red', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?tint=%23fff', SCOPE)).toEqual({});
    expect(decodeShareParams(controls, '?tint=%23FF00AA', SCOPE)).toEqual({ tint: '#FF00AA' });
  });

  it('accepts any text, including the empty string', () => {
    expect(decodeShareParams(controls, '?label=', SCOPE)).toEqual({ label: '' });
  });

  it('ignores control types the strip does not render', () => {
    const unsupported: ControlDefinition[] = [
      { type: 'json', key: 'data', label: 'Data', defaultValue: 'a' }
    ];
    expect(decodeShareParams(unsupported, '?data=b', SCOPE)).toEqual({});
  });

  it('takes the first occurrence of a repeated key', () => {
    expect(decodeShareParams(controls, '?size=sm&size=lg', SCOPE)).toEqual({ size: 'sm' });
  });

  it('never throws on a hand-mangled URL', () => {
    expect(() => decodeShareParams(controls, '?&&=&variant&width=&%%%', SCOPE)).not.toThrow();
    expect(decodeShareParams(controls, '?&&=&variant&width=&%%%', SCOPE)).toEqual({});
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
    expect(decodeShareParams(booleanish, '?border=1', SCOPE)).toEqual({ border: true });
    expect(decodeShareParams(booleanish, '?border=true', SCOPE)).toEqual({});
  });
});

/**
 * The scope exists for the multi-instance page, so the regression is stated
 * against one: these two control sets are copied verbatim from
 * `/docs/components/playground-configurator`, which mounts eight playgrounds
 * on one query string. Both declare an `intent` whose items include `danger`,
 * so before `_pg` a link copied from the Button Builder turned the Alert demo
 * beside it red — a change its author never made.
 */
describe('instance scoping', () => {
  const buttonBuilder: ControlDefinition[] = [
    { key: 'label', type: 'text', label: 'Label', defaultValue: 'Submit' },
    {
      key: 'intent',
      type: 'dropdown',
      label: 'Intent',
      items: [
        { label: 'Primary', value: 'primary' },
        { label: 'Success', value: 'success' },
        { label: 'Danger', value: 'danger' },
        { label: 'Neutral', value: 'neutral' }
      ],
      defaultValue: 'primary'
    }
  ];
  const alert: ControlDefinition[] = [
    {
      key: 'intent',
      type: 'dropdown',
      label: 'Intent',
      items: [
        { label: 'Success', value: 'success' },
        { label: 'Warning', value: 'warning' },
        { label: 'Danger', value: 'danger' }
      ],
      defaultValue: 'success'
    },
    { key: 'dismissible', type: 'boolean', label: 'Dismissible', defaultValue: false }
  ];

  const link = encodeShareParams(buttonBuilder, { label: 'Submit', intent: 'danger' }, 'Button');

  it('names the playground the link was copied from', () => {
    expect(link).toBe('_pg=Button&intent=danger');
  });

  it('seeds the playground that emitted it', () => {
    expect(decodeShareParams(buttonBuilder, `?${link}`, 'Button')).toEqual({ intent: 'danger' });
  });

  it('does not seed a different playground that happens to share the key', () => {
    expect(decodeShareParams(alert, `?${link}`, 'Alert')).toEqual({});
  });

  it('scopes by the whole key, not by a prefix of it', () => {
    expect(decodeShareParams(buttonBuilder, `?${link}`, 'Butto')).toEqual({});
    expect(decodeShareParams(buttonBuilder, `?${link}`, 'Button2')).toEqual({});
  });

  it('honours a link that names no playground — that one is hand-written', () => {
    // Read tolerantly: the codec never mints an unscoped link, so this can
    // only be a human editing the URL, and they get what they asked for.
    expect(decodeShareParams(alert, '?intent=danger', 'Alert')).toEqual({ intent: 'danger' });
    expect(decodeShareParams(buttonBuilder, '?intent=danger', 'Button')).toEqual({
      intent: 'danger'
    });
  });

  it('keeps two same-named instances apart once they declare a shareKey', () => {
    // `componentName` is the default scope, which already separates the seven
    // differently-named playgrounds on that page. The three Button demos an
    // `{#each}` mounts share a name, and need an explicit key to be told apart.
    const trio = encodeShareParams(buttonBuilder, { label: 'Hi', intent: 'primary' }, 'Button-sm');
    expect(trio).toBe('_pg=Button-sm&label=Hi');
    expect(decodeShareParams(buttonBuilder, `?${trio}`, 'Button-sm')).toEqual({ label: 'Hi' });
    expect(decodeShareParams(buttonBuilder, `?${trio}`, 'Button-lg')).toEqual({});
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
    const decoded = decodeShareParams(
      controls,
      `?${encodeShareParams(controls, chosen, SCOPE)}`,
      SCOPE
    );
    expect({ ...defaults, ...decoded }).toEqual(chosen);
  });

  it('leaves the recipient on the defaults when nothing was modified', () => {
    const decoded = decodeShareParams(
      controls,
      `?${encodeShareParams(controls, defaults, SCOPE)}`,
      SCOPE
    );
    expect({ ...defaults, ...decoded }).toEqual(defaults);
  });

  /**
   * Encode and decode must agree on what a link may carry. They did not: the
   * number arm of `encodeValue` checked only `Number.isFinite`, while
   * `decodeValue` also enforced `min`/`max`. So a value outside the range was
   * written to the URL and dropped on arrival — the recipient silently saw the
   * default instead, with no error at either end.
   */
  describe('encode and decode agree on range', () => {
    // Verbatim from the "All Controls" playground on
    // /docs/components/playground-configurator.
    const count: ControlDefinition[] = [
      { key: 'count', type: 'number', label: 'Count', defaultValue: 3, min: 0, max: 20, step: 1 }
    ];

    it('does not write a number the recipient would drop', () => {
      expect(encodeShareParams(count, { count: 999 }, SCOPE)).toBe('');
      expect(encodeShareParams(count, { count: -1 }, SCOPE)).toBe('');
    });

    it('agrees on both bounds and on the values just outside them', () => {
      for (const value of [0, 1, 19, 20]) {
        const query = encodeShareParams(count, { count: value }, SCOPE);
        expect(query).toBe(`_pg=Demo&count=${value}`);
        expect(decodeShareParams(count, `?${query}`, SCOPE)).toEqual({ count: value });
      }
      for (const value of [-1, 21, 999]) {
        expect(encodeShareParams(count, { count: value }, SCOPE)).toBe('');
        // The hand-typed form of the same link is refused on read too.
        expect(decodeShareParams(count, `?_pg=Demo&count=${value}`, SCOPE)).toEqual({});
      }
    });

    it('emits every number a control with no bounds can hold', () => {
      const free: ControlDefinition[] = [
        { key: 'count', type: 'number', label: 'Count', defaultValue: 3 }
      ];
      expect(encodeShareParams(free, { count: 999 }, SCOPE)).toBe('_pg=Demo&count=999');
      expect(decodeShareParams(free, '?_pg=Demo&count=999', SCOPE)).toEqual({ count: 999 });
    });

    it('holds for a one-sided bound', () => {
      // `/table/table` "Items per page": a floor, no ceiling. Clearing the
      // field used to make `Number('')` → 0 and ship `?itemsPerPage=0`.
      const itemsPerPage: ControlDefinition[] = [
        { key: 'itemsPerPage', type: 'number', label: 'Items per page', defaultValue: 5, min: 3 }
      ];
      expect(encodeShareParams(itemsPerPage, { itemsPerPage: 0 }, SCOPE)).toBe('');
      expect(encodeShareParams(itemsPerPage, { itemsPerPage: 3 }, SCOPE)).toBe(
        '_pg=Demo&itemsPerPage=3'
      );
      expect(encodeShareParams(itemsPerPage, { itemsPerPage: 9999 }, SCOPE)).toBe(
        '_pg=Demo&itemsPerPage=9999'
      );
    });

    it('holds for the slider arm too, not just number', () => {
      expect(encodeShareParams(controls, { ...defaults, width: 101 }, SCOPE)).toBe('');
      expect(encodeShareParams(controls, { ...defaults, width: 100 }, SCOPE)).toBe(
        '_pg=Demo&width=100'
      );
    });

    /**
     * The property the two halves owe each other, stated directly: anything
     * encode writes, decode must give back. `values` is a public bindable
     * prop, so a consumer can put any number in it — the guard cannot rely on
     * the strip alone.
     */
    it('round-trips whatever it chose to write, across the range and past it', () => {
      for (let value = -5; value <= 25; value++) {
        const query = encodeShareParams(count, { count: value }, SCOPE);
        if (query === '') continue;
        expect(decodeShareParams(count, `?${query}`, SCOPE)).toEqual({ count: value });
      }
    });
  });
});
