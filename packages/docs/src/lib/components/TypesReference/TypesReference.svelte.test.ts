// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { TypesReferenceProps } from './index.js';
import TypesReference from './TypesReference.svelte';

let cleanup: (() => void) | null = null;

function render(props: TypesReferenceProps) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(TypesReference, { target, props });
  cleanup = () => {
    unmount(component);
    target.remove();
  };
  return target;
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const TYPES: TypesReferenceProps['types'] = [
  { name: 'ButtonIntent', type: 'type', definition: "'primary' | 'neutral'" }
];

describe('TypesReference', () => {
  it('names its region by its own heading', () => {
    // The section carried a heading and no reference to it, so a screen reader
    // announced the region as nothing. Found on /table/table, 2026-08.
    const target = render({ types: TYPES });
    const section = target.querySelector('section');
    const labelledBy = section?.getAttribute('aria-labelledby');

    expect(labelledBy).toBeTruthy();
    // The IDREF has to resolve, or the label is a dead end.
    expect(document.getElementById(labelledBy as string)?.tagName).toBe('H2');
  });

  it('derives the heading id from the section id', () => {
    // The single contract that replaced two half-solutions. While this
    // component hand-built its section, the heading id was instance-local
    // (`$props.id()`) but the section id was the hardcoded `types` — so two
    // instances announced different names from two elements sharing one id,
    // which is invalid HTML and sends the `#types` anchor to whichever came
    // first. Rendering a real `<Section>` ties both halves to `id`: rename it
    // once and the anchor, the region and its label move together.
    const target = render({ types: TYPES, id: 'types-button', title: 'Button types' });
    const section = target.querySelector('section');

    expect(section?.id).toBe('types-button');
    expect(section?.getAttribute('aria-labelledby')).toBe('types-button-title');
    expect(document.getElementById('types-button-title')?.textContent?.trim()).toBe('Button types');
  });

  it('gives two instances on one page two different names', () => {
    // The types-reference docs page renders three (one in the playground, two
    // in Docs.svelte), and each already passes its own id — which is what makes
    // this pass. The assertion is that the id reaches BOTH halves: a component
    // that took the id for the section but kept a fixed heading id would give
    // the second instance the first one's name.
    const first = render({ types: TYPES, id: 'types-button', title: 'Button types' });
    const firstLabel = first.querySelector('section')?.getAttribute('aria-labelledby');
    const firstCleanup = cleanup;

    const second = document.createElement('div');
    document.body.appendChild(second);
    const instance = mount(TypesReference, {
      target: second,
      props: { types: TYPES, id: 'types-table', title: 'Table types' } as TypesReferenceProps
    });
    const secondLabel = second.querySelector('section')?.getAttribute('aria-labelledby');

    expect(firstLabel).toBeTruthy();
    expect(secondLabel).toBeTruthy();
    expect(secondLabel).not.toBe(firstLabel);
    // Each label resolves to ITS OWN heading, not the other one's.
    expect(document.getElementById(secondLabel as string)?.textContent?.trim()).toBe('Table types');
    expect(document.getElementById(firstLabel as string)?.textContent?.trim()).toBe('Button types');

    unmount(instance);
    second.remove();
    cleanup = firstCleanup;
  });

  it('anchors on `types` by default', () => {
    // The other half of the anchor pair ApiReference jumps to
    // (`fallbackSectionId: 'types'`). A page that renders one instance — every
    // component page — must not have to know that.
    const target = render({ types: TYPES });
    expect(target.querySelector('section')?.id).toBe('types');
  });

  const USED: TypesReferenceProps['types'] = [
    {
      name: 'CalendarView',
      type: 'type',
      definition: "'month' | 'week'",
      usedByProps: [
        { component: 'Calendar', propName: 'view', source: 'direct' },
        { component: 'Calendar', propName: 'views', source: 'direct' }
      ]
    },
    { name: 'CalendarProps', type: 'interface', definition: 'view?: CalendarView;' },
    { name: 'CalendarSlots', type: 'type', definition: "'root'" }
  ];

  it('counts the same types in the heading and the toolbar, filtered or not', () => {
    // The API Reference counts its props, not the rows its search leaves; both
    // of its counts stay put. "Only referenced" hides two rows here and must not
    // make the toolbar disagree with the heading above it.
    const target = render({ types: USED });
    const counts = () => [
      target.querySelector('header')?.textContent?.match(/\d+ types/)?.[0],
      target.querySelector('section > div [class*="justify-between"] > span')?.textContent?.trim()
    ];

    expect(counts()).toEqual(['3 types', '3 types']);
    target.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    flushSync();
    expect(
      target.querySelectorAll('[data-table-layout=desktop] tbody tr[id^="type-"]')
    ).toHaveLength(1);
    expect(counts()).toEqual(['3 types', '3 types']);
  });

  it('keeps each "Used by" comma on its link', () => {
    // The line is a wrapping flex row; a bare ", " between two links is a flex
    // item of its own, set off by the gap on both sides ("view , views").
    const target = render({ types: USED });
    target
      .querySelector<HTMLElement>('[data-table-layout=desktop] tr[id^="type-CalendarView-"]')
      ?.click();
    flushSync();

    const links = [
      ...target.querySelectorAll(
        '[data-table-layout=desktop] #type-CalendarView a[href="#api-reference"]'
      )
    ];
    expect(links.map((a) => a.parentElement?.textContent)).toEqual([
      'Calendar.view,',
      'Calendar.views'
    ]);
    const line = links[0]?.parentElement?.parentElement;
    const looseText = [...(line?.childNodes ?? [])].filter(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.includes(',')
    );
    expect(looseText).toHaveLength(0);
  });

  it('lists a prop declared in two sources as one user', () => {
    // The generated list names `mint` once as a direct prop and once as a tv()
    // axis. Keyed on as given, opening the row throws `each_key_duplicate`.
    const target = render({
      types: [
        {
          name: 'MintProp',
          type: 'type',
          definition: 'MintName | MintConfig',
          usedByProps: [
            { component: 'NumberInput', propName: 'mint', source: 'direct' },
            { component: 'NumberInput', propName: 'mint', source: 'variant' }
          ]
        }
      ]
    });
    const row = target.querySelector<HTMLElement>(
      '[data-table-layout=desktop] tr[id^="type-MintProp-"]'
    );

    expect(row?.textContent).toContain('1');
    expect(row?.textContent).not.toContain('2');
    row?.click();
    flushSync();
    const links = target.querySelectorAll(
      '[data-table-layout=desktop] #type-MintProp a[href="#api-reference"]'
    );
    expect([...links].map((a) => a.textContent)).toEqual(['NumberInput.mint']);
  });
});
