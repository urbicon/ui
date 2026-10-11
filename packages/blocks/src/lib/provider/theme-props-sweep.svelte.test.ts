// @vitest-environment jsdom
import { type Component, createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import CascadeCompoundHost from './__fixtures__/CascadeCompoundHost.svelte';
import { MOUNT_FIXTURES } from './__fixtures__/cascade-mount-props';
import { type CascadeComponent, exportedComponents } from './__fixtures__/cascade-registry';
import ThemeHost from './__fixtures__/ThemeHost.svelte';
import ThemeParentHost, { type ThemeChildren } from './__fixtures__/ThemeParentHost.svelte';
import {
  CALL_SITE_ATTRIBUTES,
  firstAttribute,
  withoutAttribute
} from './__fixtures__/theme-call-site';
import { themeVocabularies, type Vocabulary } from './__fixtures__/theme-vocabulary';
import type { ComponentDefaults, PresetMap } from './blocks-context';

/**
 * Every theme prop the provider's type admits, on every component that admits
 * one, mounted: a value set through `defaults.<Name>.props` must render exactly
 * what the same value written at the call site renders.
 *
 * This is what holds the wiring. The type (`ThemePropsOf`) decides which keys
 * and values a provider entry may carry, from the component's own props; it
 * cannot see whether the component reads them. A component that never reads
 * its theme, reads it for one prop and forgets another, or reads it and then
 * renders from the raw prop renders the theme mount like the default mount —
 * and fails here for every value that is visible at all.
 *
 * Both halves of the population are derived: the components are the cascade
 * registry's, the props and values are the checker's answer for
 * `StylePropsOf<TheirProps>` (`theme-vocabulary.ts`). Nothing here lists a
 * component or a prop except to say why one cannot be measured.
 *
 * Three routes per prop: every value, theme against instance; the preset rung
 * for the first value that shows; and an instance value beating a different
 * theme value.
 */

type AnyComponent = Component<Record<string, unknown>>;
type Config = { defaults?: Record<string, ComponentDefaults>; presets?: PresetMap };

interface Probe {
  /** Instance props without which this prop paints nothing in the mount. */
  props?: Record<string, unknown>;
  /** A real child, for a parent whose prop paints only what it hands down. */
  child?: ThemeChildren;
  /** A selector clicked once after mounting, for a prop that paints an opened panel. */
  open?: string;
  why: string;
}

const HEADER = createRawSnippet(() => ({ render: () => '<span>header</span>' }));

/**
 * A prop that changes nothing in the sweep's mount without some other prop
 * set, or without a real child. An entry is stale — an error — when the prop
 * shows without it.
 */
const PROBES: Record<string, Record<string, Probe>> = {
  Accordion: { size: { child: 'accordionItem', why: 'sizes the items, not the root' } },
  Avatar: {
    statusPosition: {
      props: { status: 'online' },
      why: 'places the status dot, drawn only with a status'
    }
  },
  AvatarGroup: { size: { props: { items: [{ name: 'Ada Lovelace' }] }, why: 'sizes the avatars' } },
  Button: {
    loadingPlacement: {
      props: { loading: true },
      why: 'places the spinner, drawn only while loading'
    }
  },
  ButtonGroup: {
    size: { child: 'button', why: 'reaches the Buttons through the group context' },
    intent: { child: 'button', why: 'reaches the Buttons through the group context' },
    variant: { child: 'button', why: 'reaches the Buttons through the group context' }
  },
  Card: { dividers: { props: { header: HEADER }, why: 'rules off a header or footer' } },
  Checkbox: { intent: { props: { checked: true }, why: 'colours the checked box' } },
  DatePicker: {
    calendarVariant: { open: 'button[aria-expanded]', why: 'paints the calendar the field opens' }
  },
  DateRangePicker: {
    calendarVariant: { open: 'button[aria-expanded]', why: 'paints the calendar the field opens' }
  },
  GuideMarker: {
    size: { props: { children: undefined }, why: 'sizes the default icon, which children replace' }
  },
  Menu: {
    itemSize: {
      props: { open: true, items: ['A'], children: undefined },
      why: 'sizes the rows of the open list, which children replace'
    }
  },
  RadioGroup: {
    size: { child: 'radioItem', why: 'reaches the items through the group context' },
    intent: {
      child: 'radioItem',
      props: { value: 'a' },
      why: 'colours the checked item, reached through the group context'
    },
    variant: { child: 'radioItem', why: 'reaches the items through the group context' },
    tier: { child: 'radioItem', why: 'reaches the items through the group context' }
  },
  Stepper: {
    size: { child: 'stepperStep', why: 'reaches the steps through the stepper context' },
    variant: { child: 'stepperStep', why: 'reaches the steps through the stepper context' },
    tier: { child: 'stepperStep', why: 'reaches the steps through the stepper context' }
  },
  Tab: { tier: { child: 'tabItem', why: 'shapes the tabs, not the strip' } },
  Toggle: { intent: { props: { checked: true }, why: 'colours the checked track' } },
  Toolbar: { tier: { child: 'button', why: 'reaches its children as a TierContext' } }
};

const PRESET = 'zz-theme-sweep';

function render(
  c: CascadeComponent,
  props: Record<string, unknown>,
  config: Config,
  probe?: Probe
): string {
  const fixture = MOUNT_FIXTURES[c.exportName] ?? {};
  const merged: Record<string, unknown> = { ...fixture.props, ...probe?.props, ...props };
  // The cascade sweep's stand-in, for the components that render their children.
  if (!probe?.child && c.declaredProps.includes('children') && !('children' in merged)) {
    merged.children = createRawSnippet(() => ({ render: () => '<span>content</span>' }));
  }
  const target = document.createElement('div');
  document.body.append(target);
  const app = probe?.child
    ? mount(ThemeParentHost, {
        target,
        props: { component: c.component as AnyComponent, child: probe.child, props: merged, config }
      })
    : fixture.family
      ? mount(CascadeCompoundHost, {
          target,
          props: {
            family: fixture.family,
            component: c.component,
            props: merged,
            tour: fixture.tour,
            defaults: config.defaults,
            presets: config.presets
          }
        })
      : mount(ThemeHost, {
          target,
          props: { component: c.component as AnyComponent, props: merged, config }
        });
  flushSync();
  if (probe?.open) {
    const opener = target.querySelector<HTMLElement>(probe.open);
    if (!opener) throw new Error(`${c.exportName}: nothing matches ${probe.open} to open`);
    opener.click();
    flushSync();
  }
  // The whole body: a portalled panel lands outside the target.
  const html = document.body.innerHTML.replace(/\bc\d+\b/g, 'cN');
  unmount(app);
  document.body.replaceChildren();
  return html;
}

const registry = (await exportedComponents()).filter(
  (
    c
  ): c is CascadeComponent & { providerName: string; propsType: { name: string; file: string } } =>
    c.providerName !== null && c.propsType !== null
);
const vocabularies = themeVocabularies(
  registry.map((c) => ({ key: c.exportName, ...c.propsType }))
);
const themed: [string, CascadeComponent & { providerName: string }, Vocabulary][] = registry
  .map((c) => [c, vocabularies.get(c.exportName) ?? {}] as const)
  .filter(([, vocabulary]) => Object.keys(vocabulary).length > 0)
  .map(([c, vocabulary]) => [c.exportName, c, vocabulary]);

describe('theme props reach every component that admits them', () => {
  it('finds the components the type admits theme props for', () => {
    // A vocabulary that came back empty for every component would make every
    // route below vacuous; Input is the component the issue is about.
    expect(themed.map(([name]) => name)).toContain('Input');
  });

  describe.each(themed)('%s', (_, c, vocabulary) => {
    const name = c.providerName;
    for (const [prop, values] of Object.entries(vocabulary)) {
      it(prop, () => {
        const probe = PROBES[c.exportName]?.[prop];
        const at = (props: Record<string, unknown>, config: Config = {}) =>
          render(c, props, config, probe);
        const plain = at({});

        // Route 1 — every value, from the theme and from the call site.
        const callSite = CALL_SITE_ATTRIBUTES[c.exportName]?.[prop];
        const look = (html: string | undefined) =>
          withoutAttribute(html ?? '', callSite?.attribute);
        const written = new Map<string | boolean, string>();
        let callSiteDiffers = false;
        for (const value of values) {
          written.set(value, at({ [prop]: value }));
          const fromTheme = at({}, { defaults: { [name]: { props: { [prop]: value } } } });
          expect(look(fromTheme), `${prop}=${String(value)} from the theme`).toBe(
            look(written.get(value))
          );
          if (callSite) {
            // The exception's other half: the theme leaves the attribute where
            // a mount with no value at all has it.
            expect(
              firstAttribute(fromTheme, callSite.attribute),
              `${prop}=${String(value)} from the theme sets ${callSite.attribute}`
            ).toBe(firstAttribute(plain, callSite.attribute));
          }
          if (fromTheme !== written.get(value)) callSiteDiffers = true;
        }
        if (callSite) {
          expect(callSiteDiffers, `stale CALL_SITE_ATTRIBUTES entry: ${callSite.why}`).toBe(true);
        }
        const shown = values.find((value) => written.get(value) !== plain);
        expect(shown, `${prop} paints nothing here — a PROBES entry?`).toBeDefined();
        if (probe) {
          const unprobed = values.some(
            (value) => render(c, { [prop]: value }, {}) !== render(c, {}, {})
          );
          expect(unprobed, `stale PROBES entry, ${prop} shows without it: ${probe.why}`).toBe(
            false
          );
        }
        if (shown === undefined) return;

        // Routes 2 and 3 contest two values that render apart, so a rung read
        // in the wrong order cannot pass by painting the same thing.
        const other = values.find((value) => written.get(value) !== written.get(shown));
        if (other === undefined) return;
        const fromPreset = at(
          { preset: PRESET },
          {
            defaults: { [name]: { props: { [prop]: other } } },
            presets: { [name]: { [PRESET]: { props: { [prop]: shown } } } }
          }
        );
        const writtenWithPreset = at(
          { preset: PRESET, [prop]: shown },
          { presets: { [name]: { [PRESET]: {} } } }
        );
        expect(look(fromPreset), "a preset's props rank above the defaults").toBe(
          look(writtenWithPreset)
        );

        const contested = at(
          { [prop]: shown },
          { defaults: { [name]: { props: { [prop]: other } } } }
        );
        expect(contested, 'the instance value outranks the theme').toBe(written.get(shown));
      });
    }
  });
});
