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

    expect(labelledBy).toBe('types-title');
    // The IDREF has to resolve, or the label is a dead end.
    expect(document.getElementById(labelledBy as string)?.tagName).toBe('H2');
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
