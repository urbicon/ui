// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRawSnippet, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ApiReference from './ApiReference/ApiReference.svelte';
import CodeExample from './CodeExample/CodeExample.svelte';
import CodePanel from './CodePanel/CodePanel.svelte';
import InfoCard from './InfoCard/InfoCard.svelte';
import Note from './NoteList/Note.svelte';
import NoteList from './NoteList/NoteList.svelte';
import PlaygroundConfigurator from './PlaygroundConfigurator/PlaygroundConfigurator.svelte';
import Section from './Section/Section.svelte';
import TableOfContents from './TableOfContents/TableOfContents.svelte';
import TypesReference from './TypesReference/TypesReference.svelte';

/**
 * What `slotClasses` means ON THE RENDERED ELEMENT.
 *
 * Three attempts, and the first two were green against the defect:
 *
 *   1. Asserting `variants().slot({ class })` tests the tv config. `tv()` has
 *      always folded; the question is whether the component ROUTES the
 *      override through it. Useless.
 *   2. Mounting, but picking whichever slot came to hand. An assertion that an
 *      override "strips" a default only means something when that default
 *      exists and shares the override's conflict bucket. Measured: five of six
 *      cases produced byte-identical output with and without the defect, and
 *      one asserted `p-4` against a slot whose padding is `pl-4 py-2`. One of
 *      ten components was actually covered.
 *
 * So every case below names a REAL default and collides with it deliberately,
 * and the pairs were derived by asking each tv config which of its slots can
 * be falsified at all — not by eye. Re-derive them the same way if a variants
 * file changes; a case whose `strips` class is not in the base is theatre.
 */

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(Component: unknown, props: Record<string, unknown>): void {
  const instance = mount(Component as Parameters<typeof mount>[0], {
    target: document.body,
    props: props as Record<string, never>
  });
  dispose = () => unmount(instance);
}

function classesOf(select: string): string[] {
  const el = document.body.querySelector(select);
  return (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

/**
 * `[slot, default-in-the-base, override-in-the-same-bucket, selector]` per
 * component. The override is what the caller passes; the default is what must
 * disappear because of it.
 */
const CASES: ReadonlyArray<{
  name: string;
  mount: (slotClasses: Record<string, string>) => void;
  slot: string;
  strips: string;
  override: string;
  select: string;
}> = [
  {
    name: 'Section.header',
    mount: (slotClasses) => render(Section, { id: 's', title: 'T', slotClasses }),
    slot: 'header',
    strips: 'mt-8',
    override: 'mt-1',
    select: 'header'
  },
  {
    name: 'InfoCard.container',
    mount: (slotClasses) => render(InfoCard, { title: 'T', slotClasses }),
    slot: 'container',
    strips: 'pl-4',
    override: 'pl-1',
    select: 'aside'
  },
  {
    name: 'Note.root',
    mount: (slotClasses) => render(Note, { title: 'T', slotClasses }),
    slot: 'root',
    strips: 'py-4',
    override: 'py-1',
    select: 'div'
  },
  {
    name: 'NoteList.root',
    mount: (slotClasses) => render(NoteList, { slotClasses }),
    slot: 'root',
    strips: 'p-6',
    override: 'p-1',
    select: 'div'
  },
  {
    name: 'CodeExample.title',
    mount: (slotClasses) =>
      render(CodeExample, { title: 'T', code: 'a', preview: false, slotClasses }),
    slot: 'title',
    strips: 'px-4',
    override: 'px-1',
    select: 'h3'
  },
  {
    name: 'CodePanel.toolbar',
    mount: (slotClasses) => render(CodePanel, { code: 'const a = 1;', slotClasses }),
    slot: 'toolbar',
    strips: 'px-4',
    override: 'px-1',
    select: '[class*="px-"]'
  },
  {
    name: 'TableOfContents.title',
    mount: (slotClasses) =>
      render(TableOfContents, { navigation: [{ id: 'a', title: 'A' }], slotClasses }),
    slot: 'title',
    strips: 'mb-3',
    override: 'mb-1',
    select: 'aside > p'
  },
  {
    name: 'TypesReference.toolbar',
    mount: (slotClasses) =>
      render(TypesReference, {
        types: [{ name: 'X', type: 'type', definition: "'a'" }],
        slotClasses
      }),
    slot: 'toolbar',
    strips: 'p-3',
    override: 'p-1',
    select: '[class*="p-1"]'
  },
  {
    name: 'ApiReference.usageNotes',
    mount: (slotClasses) =>
      render(ApiReference, {
        props: [{ name: 'a', type: 'string' }],
        usageNotes: createRawSnippet(() => ({ render: () => '<p>note</p>' })),
        slotClasses
      }),
    slot: 'usageNotes',
    strips: 'pl-4',
    override: 'pl-1',
    select: '[class*="pl-1"]'
  },
  {
    name: 'PlaygroundConfigurator.title',
    mount: (slotClasses) => render(PlaygroundConfigurator, { title: 'P', slotClasses }),
    slot: 'title',
    strips: 'mb-1',
    override: 'mb-2',
    select: 'h2'
  }
];

describe('slotClasses reaches the element as an override, not as an addition', () => {
  for (const c of CASES) {
    it(`${c.name}: "${c.override}" strips "${c.strips}"`, () => {
      c.mount({ [c.slot]: c.override });
      const classes = classesOf(c.select);
      expect(classes, `nothing matched ${c.select}`).not.toHaveLength(0);
      expect(classes, `${c.name}: the override must reach the element`).toContain(c.override);
      expect(
        classes,
        `${c.name}: "${c.strips}" must be folded away, got "${classes.join(' ')}"`
      ).not.toContain(c.strips);
    });
  }

  it('an unrelated override leaves the defaults alone', () => {
    render(Section, { id: 's', title: 'T', slotClasses: { header: 'outline-hidden' } });
    const classes = classesOf('header');
    expect(classes).toContain('outline-hidden');
    expect(classes).toContain('mt-8');
  });

  it('unstyled drops the defaults and keeps the override', () => {
    render(Section, {
      id: 's',
      title: 'T',
      unstyled: true,
      slotClasses: { header: 'mt-1' }
    });
    expect(classesOf('header')).toEqual(['mt-1']);
  });
});

/**
 * DocsLayout needs a host page's context and snippets to mount, so it has no
 * case above — and a component with no case is a component whose helper can
 * quietly revert. This reads the source instead: every `slot()` in the package
 * must hand the override to the tv function, never concatenate it.
 *
 * It is a shape check, deliberately: the concatenating form is one specific
 * expression, it is what the sweep left behind twice (in `NoteList.svelte`
 * after `Note.svelte` was converted), and it is trivially greppable.
 */
describe('every slot() helper folds', () => {
  const COMPONENTS = [
    'ApiReference/ApiReference.svelte',
    'CodeExample/CodeExample.svelte',
    'CodePanel/CodePanel.svelte',
    'DocsLayout/DocsLayout.svelte',
    'InfoCard/InfoCard.svelte',
    'NoteList/Note.svelte',
    'NoteList/NoteList.svelte',
    'PlaygroundConfigurator/PlaygroundConfigurator.svelte',
    'Section/Section.svelte',
    'TableOfContents/TableOfContents.svelte',
    'TypesReference/TypesReference.svelte'
  ];

  for (const rel of COMPONENTS) {
    it(`${rel} routes slotClasses through tv()`, () => {
      const src = readFileSync(join(import.meta.dirname, rel), 'utf8');
      expect(src, `${rel} has no slot() helper`).toMatch(/(?:const|function) slot\b/);
      // The concatenating shape, in either spelling it appeared in.
      expect(src, `${rel} concatenates slotClasses instead of folding through tv()`).not.toMatch(
        /\[\s*unstyled \? ''\s*:\s*styles\[name\]\(\)\s*,\s*slotClasses\[name\]/
      );
      // And the folding call has to be there.
      expect(src, `${rel} never passes slotClasses into a tv slot function`).toMatch(
        /\(\s*\{\s*class:\s*slotClasses\??\.?\[?name\]?/
      );
    });
  }
});
