// @vitest-environment jsdom
import type { ComponentDefaults, PresetMap } from '@urbicon-ui/blocks';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { LAYOUT_SWITCH_CLASSES } from '../variants/table.variants';
import ProviderTableHarness from './__fixtures__/ProviderTableHarness.svelte';

/**
 * The table under a `<BlocksProvider>`: `defaults.Table`, its `overrides`,
 * `presets.Table` and the provider-wide `unstyled`, resolved once in
 * `Table.svelte` and read by every subcomponent through the table style
 * context.
 *
 * jsdom evaluates no stylesheet, so what this file measures is the class
 * attribute of each slot's element. Which of two same-bucket utilities then
 * paints is the cascade's business and is pinned in blocks
 * (`provider/override-precedence.test.ts`); here the probe classes match no
 * Tailwind utility, so the bucket resolver cannot strip them and every layer's
 * mark either reaches its element or does not.
 *
 * Before the table read the provider at all, all seven marks of the first test
 * were absent while the search field inside the same tree followed the
 * provider — a half-themed table (#274).
 */

const ROWS = [
  { id: 1, name: 'Ada', amount: 100 },
  { id: 2, name: 'Grace', amount: 200 }
];

/** The six slots of the measurement, one mark each — none is a Tailwind utility. */
const SIX_SLOTS = {
  container: 'probe-container',
  table: 'probe-table',
  thead: 'probe-thead',
  scrollArea: 'probe-scrollarea',
  row: 'probe-row',
  cell: 'probe-cell'
};

/** Where each slot lands in the rendered tree. */
const SLOT_ELEMENT: Record<keyof typeof SIX_SLOTS, string> = {
  container: '[data-table-container]',
  table: 'table',
  thead: 'thead',
  scrollArea: '[data-table-layout="desktop"]',
  row: 'tbody tr',
  cell: 'tbody td'
};

let target: HTMLElement | null = null;
let comp: Record<string, unknown> | null = null;

function mountUnderProvider(
  provider: {
    defaults?: Record<string, ComponentDefaults>;
    presets?: PresetMap;
    unstyled?: boolean;
  },
  table: Record<string, unknown> = {}
): HTMLElement {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(ProviderTableHarness, { target, props: { ...provider, items: ROWS, ...table } });
  flushSync();
  return target;
}

function classesOf(root: HTMLElement, selector: string): string[] {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`${selector} did not render`);
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

afterEach(() => {
  if (comp) unmount(comp);
  target?.remove();
  comp = null;
  target = null;
});

describe('Table under a BlocksProvider', () => {
  it('every provider layer reaches the element its slot names', () => {
    const root = mountUnderProvider(
      {
        defaults: {
          Table: {
            slotClasses: SIX_SLOTS,
            overrides: [{ variant: 'framed', class: { table: 'probe-framed' } }]
          }
        },
        presets: { Table: { brand: { slotClasses: { row: 'probe-brand' } } } }
      },
      { variant: 'framed', preset: 'brand' }
    );

    for (const [slot, mark] of Object.entries(SIX_SLOTS)) {
      const selector = SLOT_ELEMENT[slot as keyof typeof SIX_SLOTS];
      expect(classesOf(root, selector), `defaults.Table.slotClasses.${slot}`).toContain(mark);
    }
    expect(classesOf(root, 'table'), 'defaults.Table.overrides[variant=framed]').toContain(
      'probe-framed'
    );
    expect(classesOf(root, 'tbody tr'), 'presets.Table.brand').toContain('probe-brand');
  });

  it('an override for another variant lands nowhere', () => {
    const root = mountUnderProvider(
      {
        defaults: {
          Table: {
            overrides: [
              { variant: 'flush', class: { table: 'probe-flush' } },
              // The matching rule is the control: overrides are read at all.
              { variant: 'framed', class: { table: 'probe-framed' } }
            ]
          }
        }
      },
      { variant: 'framed' }
    );

    expect(classesOf(root, 'table')).toContain('probe-framed');
    expect(root.querySelector('.probe-flush')).toBeNull();
  });

  it('overrides match the resolved container axes, not the props they derive from', () => {
    const provider: { defaults: Record<string, ComponentDefaults> } = {
      defaults: {
        Table: {
          overrides: [
            { contained: true, class: { container: 'probe-contained' } },
            { stickyToolbar: true, class: { toolbar: 'probe-pinned' } },
            // `fit` is a prop, not an axis of `tableContainerVariants`.
            { fit: 'viewport', class: { container: 'probe-fit' } }
          ]
        }
      }
    };

    const viewport = mountUnderProvider(provider, { fit: 'viewport' });
    expect(classesOf(viewport, '[data-table-container]')).toContain('probe-contained');
    expect(classesOf(viewport, '[data-table-container]')).not.toContain('probe-fit');
    // A contained table never page-pins its toolbar (`resolveStickyMode`).
    expect(classesOf(viewport, '[data-table-toolbar]')).not.toContain('probe-pinned');
    unmount(comp as Record<string, unknown>);
    comp = null;

    const pinned = mountUnderProvider(provider, { sticky: true });
    expect(classesOf(pinned, '[data-table-toolbar]')).toContain('probe-pinned');
    expect(classesOf(pinned, '[data-table-container]')).not.toContain('probe-contained');
  });

  it('instance slotClasses win over a preset within one Tailwind bucket', () => {
    const root = mountUnderProvider(
      // The mark is the control: the preset was consulted, and only its
      // conflicting utility gave way.
      { presets: { Table: { brand: { slotClasses: { cell: 'p-2 probe-preset-cell' } } } } },
      { preset: 'brand', slotClasses: { cell: 'p-4' } }
    );

    const cell = classesOf(root, 'tbody td');
    expect(cell).toContain('probe-preset-cell');
    expect(cell).toContain('p-4');
    expect(cell).not.toContain('p-2');
  });

  it('a provider that says nothing about the table changes nothing', () => {
    const root = mountUnderProvider({});

    expect(classesOf(root, 'table')).toEqual(
      expect.arrayContaining(['w-full', 'border-collapse', 'text-sm'])
    );
    expect(classesOf(root, 'input[type="search"]').length).toBeGreaterThan(0);
  });

  it('provider-wide unstyled strips the table and its search field in one step', () => {
    const root = mountUnderProvider({ unstyled: true });

    const table = classesOf(root, 'table');
    for (const look of ['w-full', 'border-collapse', 'text-sm']) {
      expect(table, `<table> still carries ${look}`).not.toContain(look);
    }
    // The desktop/card switch is structure and survives (`LAYOUT_SWITCH_CLASSES`).
    expect(LAYOUT_SWITCH_CLASSES).toContain('@container');
    expect(LAYOUT_SWITCH_CLASSES).toContain('@max-[48rem]:hidden');
    expect(classesOf(root, '[data-table-container]')).toContain('@container');
    expect(classesOf(root, '[data-table-layout="desktop"]')).toContain('@max-[48rem]:hidden');
    // One switch for both sides: the blocks Input inside the toolbar reads the
    // same provider, so the search field is bare too.
    expect(classesOf(root, 'input[type="search"]')).toEqual([]);
  });
});
