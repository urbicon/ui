// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ReferenceSectionsData, ReferenceSectionsProps } from './index.js';
import ReferenceSections from './ReferenceSections.svelte';

let cleanup: (() => void) | null = null;

function render(props: ReferenceSectionsProps) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(ReferenceSections, { target, props });
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

// jsdom lays nothing out and ships no `scrollIntoView`; following a link
// scrolls to the row it opens.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => {};
});

/** Shaped like a generated `api.ts`: `size` arrives twice, once per source. */
const DATA: ReferenceSectionsData = {
  props: [
    {
      name: 'intent',
      type: 'ButtonIntent',
      description: 'Colour role.',
      source: { type: 'direct', name: 'ButtonProps' }
    },
    {
      name: 'size',
      type: "'sm' | 'md'",
      values: ['sm', 'md'],
      source: { type: 'direct', name: 'ButtonProps' }
    },
    {
      name: 'size',
      type: "'sm' | 'md'",
      values: ['sm', 'md'],
      source: { type: 'variant', name: 'ButtonVariantProps' }
    },
    { name: 'onclick', type: '(event: MouseEvent) => void', source: { type: 'direct' } }
  ],
  types: [
    {
      name: 'ButtonIntent',
      type: 'type',
      definition: "'primary' | 'neutral'",
      usedByProps: [{ component: 'Button', propName: 'intent', source: 'direct' }]
    },
    { name: 'ButtonProps', type: 'interface', definition: 'intent?: ButtonIntent;' }
  ]
};

describe('ReferenceSections', () => {
  it('renders the API section and the Types section under the ids a page lists', () => {
    const target = render({ componentData: DATA });
    const ids = [...target.querySelectorAll(':scope > section')].map((s) => s.id);

    // In this order: the TOC lists `api` before `types`, and the links run
    // from the first table into the second.
    expect(ids).toEqual(['api', 'types']);
    expect(target.querySelector('#api #api-reference table')).toBeTruthy();
    expect(target.querySelector('#types table')).toBeTruthy();
  });

  it('links every type name of the API table to a row of the Types table', () => {
    // The whole reason the component exists: both tables read one array, so a
    // link the first one emits has a row in the second.
    const target = render({ componentData: DATA });
    // A set: the table renders a desktop and a phone layout, each with the link.
    const hrefs = new Set(
      [...target.querySelectorAll('#api a[href^="#type-"]')].map((a) => a.getAttribute('href'))
    );

    expect([...hrefs]).toEqual(['#type-ButtonIntent']);
    for (const href of hrefs) {
      const name = (href ?? '').slice('#type-'.length);
      const row = [...target.querySelectorAll('#types tr[id]')].find((r) =>
        r.id.startsWith(`type-${name}-`)
      );
      expect(row, `no Types row for ${name}`).toBeTruthy();
    }
  });

  it('opens the linked type row when a type name is clicked', () => {
    const target = render({ componentData: DATA });
    const link = target.querySelector<HTMLAnchorElement>('#api a[href="#type-ButtonIntent"]');
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    flushSync();

    // `TypesReference` puts the anchor id on the expanded panel, so it exists
    // only once the row is open.
    expect(target.querySelector('#types #type-ButtonIntent')?.textContent).toContain(
      "type ButtonIntent = 'primary' | 'neutral'"
    );
  });

  it('counts the props the table shows, not the entries the data lists', () => {
    // Four entries, three rows: `size` is one prop declared in two places. The
    // count beside the heading and the one above the table are the same number.
    const target = render({ componentData: DATA });
    const heading = target.querySelector('#api header')?.textContent ?? '';
    const stats = target.querySelector('#api-reference')?.textContent ?? '';

    expect(heading).toContain('3 props');
    expect(heading).not.toContain('4 props');
    expect(stats).toContain('3 props');
  });

  it('heads the Types section with neither a count nor a subtitle', () => {
    // Its count is the toolbar's, right under the heading; a second one beside
    // the heading would repeat it.
    const target = render({ componentData: DATA });
    const header = target.querySelector('#types header');

    expect(header?.textContent).not.toMatch(/\d+ types/);
    expect(header?.querySelector('p')).toBeNull();
    expect(target.querySelector('#types')?.textContent).toContain('2 types');
  });

  it('tags both localized headings with the locale they render in', () => {
    // The headings come from the docs locale while the prose around them has a
    // language of its own (`lang="en"` on this site's article column), so each
    // heading declares its own. No provider here: the base locale.
    const target = render({ componentData: DATA });

    for (const id of ['api', 'types']) {
      const tagged = target.querySelector(`#${id}-title [lang]`);
      expect(tagged?.getAttribute('lang'), `#${id} heading`).toBe('en');
    }
    expect(target.querySelector('#api-title')?.textContent).toContain('API Reference');
    expect(target.querySelector('#types-title')?.textContent).toContain('Types');
  });

  it('puts a typesDescription under the Types heading', () => {
    const target = render({
      componentData: DATA,
      typesDescription: 'ButtonIntent is what intent accepts.'
    });

    expect(target.querySelector('#types header p')?.textContent?.trim()).toBe(
      'ButtonIntent is what intent accepts.'
    );
  });
});
