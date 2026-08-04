import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import PlaygroundConfigurator from './PlaygroundConfigurator.svelte';

/**
 * The third of #10's surfaces, on the server.
 *
 * The control defaults were seeded inside an `$effect`, and effects do not run
 * during SSR — so the prerendered playground had `values = {}`. Two things
 * followed, both measured by diffing the server output with the seed against
 * the server output without it:
 *
 *  - every control read as *changed* relative to the component defaults, so the
 *    page announced "Settings modified: 2" and offered a reset affordance for
 *    settings nobody had touched;
 *  - the controls themselves rendered unset — the boolean toggle came out
 *    `aria-checked="false"` on a knob whose default is on.
 *
 * The generated snippet is deliberately **not** asserted here: for these
 * controls it is `<Button />` either way, because a value equal to the
 * component default is omittable. An assertion on it would pass with the defect
 * in place, which is worse than no assertion.
 */

const CONTROLS: ControlDefinition[] = [
  {
    key: 'variant',
    label: 'Variant',
    type: 'select',
    defaultValue: 'outlined',
    items: [
      { value: 'filled', label: 'Filled' },
      { value: 'outlined', label: 'Outlined' }
    ]
  },
  { key: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: true }
];

type PlaygroundProps = ComponentProps<typeof PlaygroundConfigurator>;

const bodyOf = (props: Partial<PlaygroundProps>) =>
  render(PlaygroundConfigurator, { props: props as PlaygroundProps }).body;

describe('PlaygroundConfigurator — server render', () => {
  it('renders the controls at their defaults, not unset', () => {
    const body = bodyOf({ controls: CONTROLS, componentName: 'Button' });

    expect(body).toContain('aria-checked="true"');
  });

  it('reports nothing as modified on a playground nobody has touched', () => {
    const body = bodyOf({ controls: CONTROLS, componentName: 'Button' });

    expect(body).not.toContain('modified');
  });

  it('leaves values the caller supplied alone', () => {
    // The seed is a fallback for an empty object, not an override — a caller
    // binding its own state has to win on the server exactly as in the browser.
    const body = bodyOf({
      controls: CONTROLS,
      componentName: 'Button',
      values: { variant: 'filled' }
    });

    expect(body).toContain('filled');
  });
});
