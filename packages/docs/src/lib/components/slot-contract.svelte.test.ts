// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ApiReference from './ApiReference/ApiReference.svelte';
import type { ApiReferenceProps } from './ApiReference/index.js';
import CodeExample from './CodeExample/CodeExample.svelte';
import type { CodeExampleProps } from './CodeExample/index.js';
import InfoCard from './InfoCard/InfoCard.svelte';
import type { InfoCardProps } from './InfoCard/index.js';
import type { NoteProps } from './NoteList/index.js';
import Note from './NoteList/Note.svelte';
import type { SectionProps } from './Section/index.js';
import Section from './Section/Section.svelte';
import type { TableOfContentsProps } from './TableOfContents/index.js';
import TableOfContents from './TableOfContents/TableOfContents.svelte';

/**
 * What `slotClasses` means ON THE RENDERED ELEMENT.
 *
 * The per-component `*.variants.test.ts` files compare the tv config against a
 * hand-maintained slot list, and a first attempt at this file asserted
 * `variants().slot({ class })` — the config. Both stay green while the defect
 * is present, because neither can see how a component *calls* its config:
 * `tv()` has always folded, the question is whether the component routes the
 * override through it.
 *
 * It briefly did not. Seven components built their classes by concatenation
 * (`[styles[name](), slotClasses[name]].join(' ')`), so an override and the
 * default it contradicts both reached the element and stylesheet order picked
 * the winner instead of the caller. Verified 2026-08 by putting that helper
 * back: the config-level test stayed green, this one failed with
 * `"leading-relaxed mb-8 text-sm text-text-secondary mb-2"`.
 *
 * So: mount, read `class`, assert the default is gone.
 */

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

/** Class list of the first `select` match under the mount target. */
function classesOf(select: string): string[] {
  const el = document.body.querySelector(select);
  return (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

function renderSection(props: Partial<SectionProps> = {}) {
  const instance = mount(Section, {
    target: document.body,
    props: { id: 'x', title: 'T', ...props } as SectionProps
  });
  dispose = () => unmount(instance);
}

describe('slotClasses reaches the element as an override, not as an addition', () => {
  it('Section.subtitle: "mb-2" strips the default "mb-8"', () => {
    renderSection({ subtitle: 'S', slotClasses: { subtitle: 'mb-2' } });
    const classes = classesOf('p');
    expect(classes, 'nothing rendered').not.toHaveLength(0);
    expect(classes).toContain('mb-2');
    expect(classes, `got "${classes.join(' ')}"`).not.toContain('mb-8');
  });

  it('an unrelated override leaves the defaults alone', () => {
    renderSection({ subtitle: 'S', slotClasses: { subtitle: 'outline-hidden' } });
    const classes = classesOf('p');
    expect(classes).toContain('outline-hidden');
    expect(classes).toContain('mb-8');
  });

  it('unstyled drops the defaults and keeps the override', () => {
    renderSection({ subtitle: 'S', unstyled: true, slotClasses: { subtitle: 'mb-2' } });
    expect(classesOf('p')).toEqual(['mb-2']);
  });

  it('InfoCard.container folds an override into the root', () => {
    const instance = mount(InfoCard, {
      target: document.body,
      props: { title: 'T', slotClasses: { container: 'p-2' } } as InfoCardProps
    });
    dispose = () => unmount(instance);
    const classes = classesOf('aside');
    expect(classes).toContain('p-2');
    expect(classes, `got "${classes.join(' ')}"`).not.toContain('p-4');
  });

  it('Note.root folds an override into the root', () => {
    const instance = mount(Note, {
      target: document.body,
      props: { title: 'T', slotClasses: { root: 'py-1' } } as NoteProps
    });
    dispose = () => unmount(instance);
    const classes = classesOf('div');
    expect(classes).toContain('py-1');
  });

  // The two call sites that reached past the helper into `styles.x()`. Their
  // key is public via `SlotNames<…>`, so the type checker accepted a
  // `slotClasses` entry the runtime then dropped — a shape no list comparison
  // can see.
  it('ApiReference honours a slotClasses entry on its root', () => {
    const instance = mount(ApiReference, {
      target: document.body,
      props: {
        props: [{ name: 'a', type: 'string' }],
        slotClasses: { base: 'p-2' }
      } as unknown as ApiReferenceProps
    });
    dispose = () => unmount(instance);
    expect(classesOf('#api-reference')).toContain('p-2');
  });

  it('CodeExample honours a slotClasses entry on its root', () => {
    const instance = mount(CodeExample, {
      target: document.body,
      props: {
        title: 'T',
        code: 'const a = 1;',
        preview: false,
        slotClasses: { container: 'my-1' }
      } as CodeExampleProps
    });
    dispose = () => unmount(instance);
    expect(classesOf('div')).toContain('my-1');
  });

  it('TableOfContents honours a slotClasses entry on its root', () => {
    const instance = mount(TableOfContents, {
      target: document.body,
      props: {
        navigation: [{ id: 'a', title: 'A' }],
        slotClasses: { aside: 'p-2' }
      } as unknown as TableOfContentsProps
    });
    dispose = () => unmount(instance);
    expect(classesOf('aside')).toContain('p-2');
  });
});
