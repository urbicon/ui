// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RegistryHarness from './__fixtures__/RegistryHarness.svelte';
import { SectionRegistry } from './section-registry.svelte.js';

/**
 * The table of contents and the markers in the browser: the same list the
 * server writes (section-registry.ssr.test.ts), kept right while sections come
 * and go. A section revealed later registers last, so it is the document
 * position, not the registration order, that has to put it in its place.
 */

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
  vi.restoreAllMocks();
});

function render(props: { showCustomization?: boolean; withoutLayout?: boolean }) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(RegistryHarness, { target, props });
  cleanup = () => {
    unmount(component);
    target.remove();
  };
  flushSync();
  return target;
}

function railHrefs(target: HTMLElement): (string | null)[] {
  const aside = target.querySelector('aside[data-docs-toc]');
  return [...(aside?.querySelectorAll('nav a') ?? [])].map((a) => a.getAttribute('href'));
}

function markers(target: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of target.querySelectorAll('section[id]')) {
    const stamp = document.getElementById(`${section.id}-title`)?.firstElementChild;
    const text = stamp?.textContent?.trim() ?? '';
    if (/^\d+$/.test(text)) out[section.id] = text;
  }
  return out;
}

describe('section registry — in the browser', () => {
  it('lists and numbers what the server lists and numbers', () => {
    const target = render({});

    expect(railHrefs(target)).toEqual(['#playground', '#examples', '#api', '#installation']);
    expect(markers(target)).toEqual({
      examples: '01',
      api: '02',
      installation: '03',
      'stage-demo': '01',
      'example-demo': '01'
    });
  });

  it('puts a section revealed later where it renders, and takes it out again', () => {
    const props = $state({ showCustomization: false });
    const target = render(props);

    props.showCustomization = true;
    flushSync();

    expect(railHrefs(target)).toEqual([
      '#playground',
      '#examples',
      '#customization',
      '#api',
      '#installation'
    ]);
    expect(markers(target)).toMatchObject({
      examples: '01',
      customization: '02',
      api: '03',
      installation: '04'
    });

    props.showCustomization = false;
    flushSync();

    expect(railHrefs(target)).toEqual(['#playground', '#examples', '#api', '#installation']);
    expect(markers(target)).toMatchObject({ examples: '01', api: '02', installation: '03' });
    expect(markers(target)).not.toHaveProperty('customization');
  });

  it('lists a nested section as a child entry of its parent', () => {
    // The rail shows a parent's children while one of them is the active
    // section. jsdom lays nothing out, so the trigger line is placed by hand:
    // everything up to `nested` has crossed it, nothing after.
    const crossed = new Set(['playground', 'examples', 'nested']);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      return { top: crossed.has(this.id) ? 0 : 10_000 } as DOMRect;
    });
    const target = render({});
    const aside = target.querySelector('aside[data-docs-toc]');
    const links = [...(aside?.querySelectorAll('nav a') ?? [])];

    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#playground',
      '#examples',
      '#nested',
      '#api',
      '#installation'
    ]);
    expect(aside?.querySelector('a[href="#nested"]')?.getAttribute('aria-current')).toBe(
      'location'
    );
  });

  it('renders the sections without a layout, unnumbered and unlisted', () => {
    const target = render({ withoutLayout: true });

    expect(target.querySelector('section#examples')).not.toBeNull();
    expect(target.querySelector('aside[data-docs-toc]')).toBeNull();
    expect(Object.keys(markers(target)).sort()).toEqual(['example-demo', 'stage-demo']);
  });
});

describe('SectionRegistry', () => {
  const heading = createRawSnippet(() => ({ render: () => '<span>Heading</span>' }));

  function source(id: string, opts: { marker?: boolean; titled?: boolean } = {}) {
    return { id, heading: opts.titled === false ? undefined : heading, marker: !!opts.marker };
  }

  it('numbers only what asks for a number and can show it', () => {
    const registry = new SectionRegistry(true);
    const a = registry.register(source('a', { marker: true }));
    const untitled = registry.register(source('untitled', { marker: true, titled: false }));
    const plain = registry.register(source('plain'));
    const b = registry.register(source('b', { marker: true }));

    // A marked section without a heading has nowhere to show its number, so it
    // takes none and leaves no gap.
    expect([a.number, untitled.number, plain.number, b.number]).toEqual([
      1,
      undefined,
      undefined,
      2
    ]);
  });

  it('numbers nothing on a nested level', () => {
    const registry = new SectionRegistry(true);
    const parent = registry.register(source('parent', { marker: true }));
    const child = parent.children.register(source('child', { marker: true }));

    expect(parent.number).toBe(1);
    expect(child.number).toBeUndefined();
    expect(
      registry.toc.map(({ id, children }) => ({ id, children: children?.map((c) => c.id) }))
    ).toEqual([{ id: 'parent', children: ['child'] }]);
  });

  it('sorts by document position once the elements are in the document', () => {
    const registry = new SectionRegistry(true);
    const first = document.createElement('section');
    const second = document.createElement('section');
    document.body.append(first, second);

    // Registered in the wrong order, as a section revealed later is.
    const late = registry.register(source('second', { marker: true }));
    const early = registry.register(source('first', { marker: true }));
    expect(registry.sections.map((s) => s.id)).toEqual(['second', 'first']);

    late.element = second;
    early.element = first;
    expect(registry.sections.map((s) => s.id)).toEqual(['first', 'second']);
    expect([early.number, late.number]).toEqual([1, 2]);

    first.remove();
    second.remove();
  });
});
