// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ApiReference from './ApiReference.svelte';
import type { ApiProp, ApiReferenceProps } from './index.js';

let cleanup: (() => void) | null = null;

function render(props: ApiReferenceProps) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(ApiReference, { target, props });
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

const INHERITED: ApiProp = {
  name: '...HTMLButtonAttributes',
  type: 'HTMLAttributes',
  description: "HTML attributes (excluding: 'children')",
  source: {
    type: 'inherited',
    name: "Omit<HTMLButtonAttributes, 'children'>",
    package: 'svelte/elements'
  }
};

const LONG: ApiProp = {
  name: 'preset',
  type: 'string',
  description: 'A'.repeat(600),
  source: { type: 'direct', name: 'ButtonProps' }
};

/** Expands a prop row by clicking it, then lets the effects settle. */
function expandRow(target: HTMLElement, rowId: string) {
  const row = target.querySelector<HTMLElement>(`tr[id="${CSS.escape(rowId)}"]`);
  expect(row, `row ${rowId} not rendered`).toBeTruthy();
  row?.click();
  flushSync();
  return target.querySelector<HTMLElement>(`tr[data-testid="expanded-row-${rowId}"]`);
}

describe('ApiReference', () => {
  it('names where an inherited prop is declared', () => {
    // `source.name`/`source.package` is present on every prop in the generated
    // data and used to be visible nowhere: the `inherited` badge said THAT a
    // prop came from elsewhere, never from what. That is the reason the row
    // discloses at all, so it is what this test pins.
    const target = render({ props: [INHERITED] });
    const detail = expandRow(target, 'prop-...HTMLButtonAttributes');

    expect(detail?.textContent).toContain("Omit<HTMLButtonAttributes, 'children'>");
    expect(detail?.textContent).toContain('svelte/elements');
  });

  it('prints the declaration line, marking optional props with `?`', () => {
    const target = render({
      props: [
        { name: 'disabled', type: 'boolean', source: { type: 'direct', name: 'ButtonProps' } },
        {
          name: 'items',
          type: 'string[]',
          required: true,
          source: { type: 'direct', name: 'ButtonProps' }
        }
      ]
    });

    expect(expandRow(target, 'prop-disabled')?.textContent).toContain('disabled?: boolean');
    // Required props carry no `?` — the whole point of printing the signature.
    const required = expandRow(target, 'prop-items')?.textContent ?? '';
    expect(required).toContain('items: string[]');
    expect(required).not.toContain('items?:');
  });

  it('shows the description in full only in the expanded row', () => {
    // The cell clamps at two lines via CSS, so the text is in both places —
    // what must not happen is the expanded row repeating the CLAMPED node
    // instead of carrying its own copy. Asserting the class is the only way to
    // tell those apart in jsdom, which does not lay text out.
    const target = render({ props: [LONG] });
    const clamped = target.querySelectorAll('.line-clamp-2');
    expect(clamped.length).toBe(1);

    const detail = expandRow(target, 'prop-preset');
    expect(detail?.textContent).toContain('A'.repeat(600));
    expect(detail?.querySelector('.line-clamp-2')).toBeNull();
  });

  it('leaves the literal union complete in the expanded row', () => {
    // The Type cell caps the chips; a union that is longer than the cap has to
    // stay readable somewhere, or the cap loses information rather than noise.
    const values = ['danger', 'neutral', 'primary', 'secondary', 'success', 'warning'];
    const target = render({
      props: [
        {
          name: 'intent',
          type: 'string',
          values,
          source: { type: 'variant', name: 'ButtonVariants' }
        }
      ]
    });

    const detail = expandRow(target, 'prop-intent');
    for (const value of values) {
      expect(detail?.textContent).toContain(value);
    }
  });
});
