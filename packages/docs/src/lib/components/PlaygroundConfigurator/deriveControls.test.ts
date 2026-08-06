import { describe, expect, it } from 'vitest';
import { defaultValuesOf, deriveControls } from './deriveControls';

// Shaped like a real generated api.ts: variant axes carry their full value set,
// props carry a type and — for unions — the parsed values.
const SLIDER = {
  variants: [
    { name: 'intent', values: ['danger', 'neutral', 'primary'], defaultValue: 'primary' },
    { name: 'variant', values: ['default', 'rail'], defaultValue: 'default' },
    { name: 'disabled', values: ['true'], defaultValue: 'false' }
  ],
  props: [
    { name: 'label', type: 'string' },
    { name: 'step', type: 'number' },
    { name: 'range', type: 'boolean' },
    { name: 'outOfValidRangeIntent', type: "'danger' | 'warning'", values: ['danger', 'warning'] },
    { name: 'onValueChange', type: '(value: number) => void' }
  ]
};

describe('deriveControls', () => {
  it('turns a variant axis into a dropdown carrying every value the component accepts', () => {
    const [intent] = deriveControls(SLIDER, { pick: ['intent'] });

    expect(intent).toMatchObject({ type: 'dropdown', key: 'intent', defaultValue: 'primary' });
    // Values arrive alphabetically and come out in intent order.
    expect(intent.items?.map((i) => i.value)).toEqual(['primary', 'danger', 'neutral']);
  });

  it('treats a single-value `true` axis as a flag, not a one-item dropdown', () => {
    const [disabled] = deriveControls(SLIDER, { pick: ['disabled'] });

    expect(disabled).toMatchObject({ type: 'checkbox', key: 'disabled', defaultValue: false });
  });

  it('treats an axis declaring BOTH boolean keys as a flag carrying real booleans', () => {
    // `accentEdge: { true: {}, false: {} }` — the second idiomatic spelling of a
    // tv() flag. Derived as a dropdown it handed the stage the *string*
    // `'false'`, which is truthy: the switch read "on" while the component
    // stayed off (Drawer's accent edge).
    const [flag] = deriveControls(
      { variants: [{ name: 'accentEdge', values: ['false', 'true'], defaultValue: 'false' }] },
      { pick: ['accentEdge'] }
    );

    expect(flag).toMatchObject({ type: 'checkbox', key: 'accentEdge', defaultValue: false });
    expect(typeof flag.defaultValue).toBe('boolean');
  });

  it('derives control types from prop types', () => {
    const controls = deriveControls(SLIDER, { pick: ['label', 'step', 'range'] });

    expect(controls.map((c) => c.type)).toEqual(['text', 'number', 'checkbox']);
  });

  it('uses a union prop as a dropdown', () => {
    const [c] = deriveControls(SLIDER, { pick: ['outOfValidRangeIntent'] });

    expect(c.type).toBe('dropdown');
    expect(c.items?.map((i) => i.value)).toEqual(['warning', 'danger']);
  });

  it('reorders an alphabetical size axis into scale order', () => {
    // docs-gen emits variant values sorted alphabetically.
    const [size] = deriveControls(
      { variants: [{ name: 'size', values: ['lg', 'md', 'sm', 'xl', 'xs'], defaultValue: 'md' }] },
      { pick: ['size'] }
    );

    expect(size.items?.map((i) => i.value)).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });

  it('reorders an intent axis by semantic rank, not alphabet', () => {
    const [intent] = deriveControls(
      {
        variants: [
          {
            name: 'intent',
            values: ['danger', 'neutral', 'primary', 'secondary', 'success', 'warning'],
            defaultValue: 'primary'
          }
        ]
      },
      { pick: ['intent'] }
    );

    expect(intent.items?.map((i) => i.value)).toEqual([
      'primary',
      'secondary',
      'success',
      'warning',
      'danger',
      'neutral'
    ]);
  });

  it('sorts the terminals of a scale to its ends, not into the alphabet', () => {
    // Dialog's size axis: `full` and `fullscreen` are rungs above `xl`, `none`
    // is the rung below `sm` on a spacing axis — alphabetically they land in
    // the middle and break the scale.
    const [size] = deriveControls(
      {
        variants: [
          {
            name: 'size',
            values: ['full', 'fullscreen', 'lg', 'md', 'sm', 'xl'],
            defaultValue: 'md'
          }
        ]
      },
      { pick: ['size'] }
    );
    expect(size.items?.map((i) => i.value)).toEqual(['sm', 'md', 'lg', 'xl', 'full', 'fullscreen']);

    const [padding] = deriveControls(
      { variants: [{ name: 'padding', values: ['lg', 'md', 'none', 'sm', 'xl'] }] },
      { pick: ['padding'] }
    );
    expect(padding.items?.map((i) => i.value)).toEqual(['none', 'sm', 'md', 'lg', 'xl']);
  });

  it('recognises a scale by its values, whatever the axis is called', () => {
    const [c] = deriveControls(
      { variants: [{ name: 'itemSize', values: ['lg', 'sm'], defaultValue: 'sm' }] },
      { pick: ['itemSize'] }
    );

    expect(c.items?.map((i) => i.value)).toEqual(['sm', 'lg']);
  });

  it('leaves an axis it does not recognise in the order docs-gen emitted', () => {
    const [c] = deriveControls(
      { variants: [{ name: 'nodeAlign', values: ['justify', 'center', 'left'] }] },
      { pick: ['nodeAlign'] }
    );

    expect(c.items?.map((i) => i.value)).toEqual(['justify', 'center', 'left']);
  });

  it('resolves a named type alias to its values via types[]', () => {
    // The extractor records `size: ComponentSize` without values; the union
    // itself sits in types[].
    const [size] = deriveControls(
      {
        props: [{ name: 'size', type: 'ComponentSize' }],
        types: [{ name: 'ComponentSize', definition: "'xs' | 'sm' | 'md' | 'lg' | 'xl'" }]
      },
      { pick: ['size'] }
    );

    expect(size.type).toBe('dropdown');
    expect(size.items?.map((i) => i.value)).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });

  it('ignores an alias that holds no literal union', () => {
    // `(typeof INTENTS)[number]` and `VariantProps<typeof x>` carry no literals —
    // they need an explicit override rather than a wrong guess.
    expect(() =>
      deriveControls(
        {
          props: [{ name: 'intent', type: 'ComponentIntent' }],
          types: [{ name: 'ComponentIntent', definition: '(typeof INTENTS)[number]' }]
        },
        { pick: ['intent'] }
      )
    ).toThrow(/intent/);
  });

  it('parses the source literal in defaultValue instead of passing it through', () => {
    // api.ts stores defaults as source text: "'week'", "true", "42".
    const controls = deriveControls(
      {
        props: [
          { name: 'view', type: 'PlannerView', defaultValue: "'week'" },
          { name: 'open', type: 'boolean', defaultValue: 'true' },
          { name: 'height', type: 'number', defaultValue: '320' }
        ],
        types: [{ name: 'PlannerView', definition: "'week' | 'month' | 'range'" }]
      },
      { pick: ['view', 'open', 'height'] }
    );

    // Not "'week'" with quotes — that reached the Planner as an invalid view.
    expect(controls.map((c) => c.defaultValue)).toEqual(['week', true, 320]);
  });

  it('drops a default it cannot parse rather than passing a code fragment', () => {
    const [c] = deriveControls(
      { props: [{ name: 'items', type: 'string', defaultValue: '() => []' }] },
      { pick: ['items'] }
    );

    expect(c.defaultValue).toBeUndefined();
  });

  it('humanizes camelCase keys into labels', () => {
    const [c] = deriveControls(SLIDER, { pick: ['outOfValidRangeIntent'] });

    expect(c.label).toBe('Out of valid range intent');
  });

  it('keeps the order given in `pick`', () => {
    const controls = deriveControls(SLIDER, { pick: ['range', 'intent', 'label'] });

    expect(controls.map((c) => c.key)).toEqual(['range', 'intent', 'label']);
  });

  it('lets an override narrow a derived control without losing the rest', () => {
    const [step] = deriveControls(SLIDER, {
      pick: ['step'],
      overrides: { step: { min: 1, max: 25, label: 'Step size' } }
    });

    expect(step).toMatchObject({
      type: 'number',
      key: 'step',
      min: 1,
      max: 25,
      label: 'Step size'
    });
  });

  it('throws on a key the component does not have, instead of dropping it silently', () => {
    expect(() => deriveControls(SLIDER, { pick: ['shwoValue'] })).toThrow(/shwoValue/);
  });

  it('accepts an unresolvable prop when the override supplies a type', () => {
    const [c] = deriveControls(SLIDER, {
      pick: ['mint'],
      overrides: { mint: { type: 'checkbox', defaultValue: false } }
    });

    expect(c).toMatchObject({ type: 'checkbox', key: 'mint', label: 'Mint' });
  });

  it('appends demo-only controls, and places them when `at` is given', () => {
    const controls = deriveControls(SLIDER, {
      pick: ['intent', 'range'],
      extra: [
        { type: 'checkbox', key: 'showMarks', label: 'Show marks', defaultValue: false, at: 1 },
        { type: 'text', key: 'note', label: 'Note' }
      ]
    });

    expect(controls.map((c) => c.key)).toEqual(['intent', 'showMarks', 'range', 'note']);
  });
});

describe('defaultValuesOf', () => {
  it('collects the defaults of a control list', () => {
    const controls = deriveControls(SLIDER, { pick: ['intent', 'variant', 'range'] });

    expect(defaultValuesOf(controls)).toEqual({
      intent: 'primary',
      variant: 'default',
      range: false
    });
  });

  it('omits controls without a default rather than seeding undefined', () => {
    const controls = deriveControls(SLIDER, { pick: ['label'] });

    expect(defaultValuesOf(controls)).toEqual({});
  });
});

describe('componentDefault', () => {
  it('keeps the component default when an override moves the starting point', () => {
    // A playground may open at a different starting point than the prop's own
    // default — here 5 against a component default of 10.
    const [c] = deriveControls(
      { props: [{ name: 'stickyOffset', type: 'number', defaultValue: '10' }] },
      { pick: ['stickyOffset'], overrides: { stickyOffset: { defaultValue: 5 } } }
    );

    expect(c.defaultValue).toBe(5);
    expect(c.componentDefault).toBe(10);
  });

  it('leaves the two equal when nothing overrides the default', () => {
    const [c] = deriveControls(
      { variants: [{ name: 'size', values: ['sm', 'md', 'lg'], defaultValue: 'md' }] },
      { pick: ['size'] }
    );

    expect(c.componentDefault).toBe('md');
    expect(c.defaultValue).toBe('md');
  });
});
