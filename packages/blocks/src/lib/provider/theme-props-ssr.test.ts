import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import CascadeCompoundHost from './__fixtures__/CascadeCompoundHost.svelte';
import { MOUNT_FIXTURES } from './__fixtures__/cascade-mount-props';
import { type CascadeComponent, exportedComponents } from './__fixtures__/cascade-registry';
import ThemeHost from './__fixtures__/ThemeHost.svelte';
import { CALL_SITE_ATTRIBUTES, withoutAttribute } from './__fixtures__/theme-call-site';
import { themeVocabularies } from './__fixtures__/theme-vocabulary';
import type { PresetMap } from './blocks-context';

/**
 * The server half of `theme-props-sweep.svelte.test.ts`, for the one failure
 * only a server render has.
 *
 * A component reads its preset's `props` while `$props()` is destructured. The
 * client compiles `preset` into a read of the props object, so it is there in
 * any order; the server keeps the destructuring as written, so a style prop
 * listed before `preset` reads the binding before it exists and the render
 * throws. Measured: moving Card's `preset` below its `variant` keeps every jsdom
 * route green and fails this file.
 *
 * So each component renders on the server with a preset that sets each of its
 * theme props, and must render what the same value written at the call site
 * renders.
 */

const PRESET = 'zz-theme-ssr';

const registry = (await exportedComponents()).filter(
  (
    c
  ): c is CascadeComponent & { providerName: string; propsType: { name: string; file: string } } =>
    c.providerName !== null && c.propsType !== null
);
const vocabularies = themeVocabularies(
  registry.map((c) => ({ key: c.exportName, ...c.propsType }))
);
const themed = registry
  .map((c) => [c.exportName, c, vocabularies.get(c.exportName) ?? {}] as const)
  .filter(([, , vocabulary]) => Object.keys(vocabulary).length > 0);

function body(c: CascadeComponent, props: Record<string, unknown>, presets: PresetMap): string {
  const fixture = MOUNT_FIXTURES[c.exportName] ?? {};
  const merged: Record<string, unknown> = { ...fixture.props, ...props, preset: PRESET };
  if (c.declaredProps.includes('children') && !('children' in merged)) {
    merged.children = createRawSnippet(() => ({ render: () => '<span>content</span>' }));
  }
  const rendered = fixture.family
    ? render(CascadeCompoundHost, {
        props: {
          family: fixture.family,
          component: c.component,
          props: merged,
          tour: fixture.tour,
          presets
        }
      })
    : render(ThemeHost, { props: { component: c.component, props: merged, config: { presets } } });
  // Ids are per render; `s1`, `s2`, … on the server.
  return rendered.body.replace(/\bs\d+\b/g, 'sN');
}

describe('theme props on the server', () => {
  it('reaches the components the type admits theme props for', () => {
    expect(themed.map(([name]) => name)).toContain('Input');
  });

  describe.each(themed)('%s', (_, c, vocabulary) => {
    it.each(Object.entries(vocabulary))('%s', (prop, values) => {
      const name = c.providerName;
      const attribute = CALL_SITE_ATTRIBUTES[c.exportName]?.[prop]?.attribute;
      for (const value of values) {
        const fromPreset = body(c, {}, { [name]: { [PRESET]: { props: { [prop]: value } } } });
        const written = body(c, { [prop]: value }, { [name]: { [PRESET]: {} } });
        expect(withoutAttribute(fromPreset, attribute), `${prop}=${String(value)}`).toBe(
          withoutAttribute(written, attribute)
        );
      }
    });
  });
});
