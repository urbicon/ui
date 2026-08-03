// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
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

    // The contract is the relationship, not the literal: the heading id is
    // instance-local (`$props.id()`), because it was hardcoded and the docs
    // page renders three instances — which left the second and third section
    // named by the FIRST one's heading. Asserting the string would pin the
    // very defect this became.
    expect(labelledBy).toBeTruthy();
    // The IDREF has to resolve, or the label is a dead end.
    expect(document.getElementById(labelledBy as string)?.tagName).toBe('H2');
  });

  it('gives two instances on one page two different names', () => {
    // The types-reference docs page renders three (one in the playground, two
    // in Docs.svelte). With the id hardcoded, all three `<section>` pointed at
    // the first heading, so the second and third announced someone else's
    // title. This is the assertion that catches that; the one above cannot.
    const first = render({ types: TYPES, title: 'Button types' });
    const firstLabel = first.querySelector('section')?.getAttribute('aria-labelledby');
    const firstCleanup = cleanup;

    const second = document.createElement('div');
    document.body.appendChild(second);
    const instance = mount(TypesReference, {
      target: second,
      props: { types: TYPES, title: 'Table types' } as TypesReferenceProps
    });
    const secondLabel = second.querySelector('section')?.getAttribute('aria-labelledby');

    expect(firstLabel).toBeTruthy();
    expect(secondLabel).toBeTruthy();
    expect(secondLabel).not.toBe(firstLabel);
    // Each label resolves to ITS OWN heading, not the other one's.
    expect(document.getElementById(secondLabel as string)?.textContent).toBe('Table types');
    expect(document.getElementById(firstLabel as string)?.textContent).toBe('Button types');

    unmount(instance);
    second.remove();
    cleanup = firstCleanup;
  });

  it('points the label at the heading that is actually rendered', () => {
    // Positive control for the test above: a fixed IDREF matching a fixed id
    // would pass even if the two were wired to different elements, so pin the
    // reference to a title only this test supplies.
    render({ types: TYPES, title: 'Exported types' });
    const labelledBy = document.querySelector('section')?.getAttribute('aria-labelledby') as string;

    expect(document.getElementById(labelledBy)?.textContent?.trim()).toBe('Exported types');
  });
});
