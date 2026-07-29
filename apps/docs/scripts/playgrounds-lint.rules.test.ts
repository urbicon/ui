import { describe, expect, it } from 'vitest';
import { closingIndex, controlKeysOf, describeUnshownData } from './playgrounds-lint.rules';

/**
 * The cases are the ones that actually got past the first version of the rule —
 * three playgrounds shipped a snippet without the data their preview rendered,
 * and `playgrounds:lint` reported 76/76 green while they did.
 */
const DECLARED = new Set(['DEMO', 'content', 'partFor', 'SCENARIOS', 'labels', 'toKeys']);

describe('describeUnshownData', () => {
  it('catches an object literal built in the tag', () => {
    expect(describeUnshownData("{ type: 'reasoning', text: sampleText }", DECLARED)).not.toBeNull();
  });

  it('catches an array literal', () => {
    expect(describeUnshownData("[{ id: 1, label: 'One' }]", DECLARED)).not.toBeNull();
  });

  it('catches a call into a local factory, even with a control value inside', () => {
    expect(describeUnshownData('partFor(values.state as ToolState)', DECLARED)).toBe('partFor');
  });

  it('catches a fallback chain over declared data', () => {
    expect(describeUnshownData('content || DEMO', DECLARED)).toBe('content, DEMO');
  });

  it('catches an index into declared data', () => {
    expect(
      describeUnshownData("SCENARIOS[(values.scenario as string) ?? 'signin']", DECLARED)
    ).toBe('SCENARIOS');
  });

  it('catches a property read off declared data', () => {
    expect(describeUnshownData('labels.label', DECLARED)).toBe('labels');
  });

  it('leaves a plain control value alone', () => {
    expect(describeUnshownData("values.layout as 'bubble' | 'plain'", DECLARED)).toBeNull();
  });

  it('leaves a callback alone — behaviour is not data', () => {
    expect(describeUnshownData("() => goto(resolve('/'))", DECLARED)).toBeNull();
    expect(describeUnshownData('(v) => (content = v)', DECLARED)).toBeNull();
  });

  it('does not read a string literal as a reference', () => {
    // `'content'` is the word, not the const — blanking string bodies is what
    // keeps `title="DEMO"` from reporting the `DEMO` const.
    expect(describeUnshownData("'content'", DECLARED)).toBeNull();
  });

  it('honours the site-only list', () => {
    const siteOnly = new Set(['labels']);
    expect(describeUnshownData('labels.label', DECLARED, siteOnly)).toBeNull();
  });

  it('leaves a built-in call alone', () => {
    expect(describeUnshownData('Number(values.headingLevelStart ?? 3)', DECLARED)).toBeNull();
  });
});

/**
 * The knob-hint rule reads whatever the panel reads, so its whole job is
 * finding the keys the panel actually shows. Both playground shapes are in the
 * tree, and `extra` looks exactly like a control list without being one.
 */
describe('controlKeysOf', () => {
  it('reads a pick list', () => {
    const src = `
      const controls = deriveControls(componentData, {
        pick: ['variant', 'intent', 'size']
      });`;
    expect(controlKeysOf(src).keys).toEqual(['variant', 'intent', 'size']);
  });

  it('reads a pick list spread over several lines', () => {
    const src = `
      const controls = deriveControls(componentData, {
        pick: [
          'locale',
          'currency'
        ]
      });`;
    expect(controlKeysOf(src).keys).toEqual(['locale', 'currency']);
  });

  it('reads a hand-written controls array', () => {
    const src = `
      <PlaygroundConfigurator
        controls={[
          { type: 'dropdown', key: 'align', label: 'Align' },
          { type: 'checkbox', key: 'snap', label: 'Snap' }
        ]}
      />`;
    expect(controlKeysOf(src).keys).toEqual(['align', 'snap']);
  });

  it('ignores keys inside `extra` — those are demo-only, not props', () => {
    const src = `
      const controls = deriveControls(componentData, {
        pick: ['variant'],
        extra: [{ type: 'checkbox', key: 'showMarks', label: 'Show marks' }]
      });`;
    const { keys } = controlKeysOf(src);
    expect(keys).toEqual(['variant']);
    expect(keys).not.toContain('showMarks');
  });

  it('marks a key whose override brings its own description', () => {
    const src = `
      const controls = deriveControls(componentData, {
        pick: ['locale', 'currency'],
        overrides: {
          locale: { description: 'Which locale formats the amount.' },
          currency: { items: CURRENCIES }
        }
      });`;
    const { selfDocumented } = controlKeysOf(src);
    expect(selfDocumented.has('locale')).toBe(true);
    // The bug this guards: searching the whole overrides block for
    // `description:` would absolve every key sitting beside a documented one.
    expect(selfDocumented.has('currency')).toBe(false);
  });

  it('does not read a `description` prop of the demo data as a control description', () => {
    // Calendar's demo events carry a `description` field; EmptyState has a
    // `description` *prop*. Neither documents a knob.
    const src = `
      const events = [{ id: '1', title: 'Sprint 14', description: 'Planning' }];
      const controls = deriveControls(componentData, {
        pick: ['view'],
        overrides: { view: { label: 'View' } }
      });`;
    expect(controlKeysOf(src).selfDocumented.size).toBe(0);
  });

  it('reports each key once even when the source repeats it', () => {
    const src = `
      const controls = deriveControls(componentData, { pick: ['size', 'size'] });`;
    expect(controlKeysOf(src).keys).toEqual(['size']);
  });
});

describe('closingIndex', () => {
  it('walks past nested brackets', () => {
    const src = 'a[b[c]d]e';
    expect(closingIndex(src, 1, '[', ']')).toBe(7);
  });

  it('returns the end when nothing closes', () => {
    expect(closingIndex('a[b', 1, '[', ']')).toBe(3);
  });
});
