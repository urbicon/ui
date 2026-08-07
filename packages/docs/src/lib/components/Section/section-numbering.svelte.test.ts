// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NumberingHarness from './__fixtures__/NumberingHarness.svelte';

let cleanup: (() => void) | null = null;

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(NumberingHarness, { target, props });
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

/** The marker stamps, in document order, for the sections that carry one. */
function markers(target: HTMLElement): string[] {
  return [...target.querySelectorAll('section > header h2 > span')].map(
    (s) => s.textContent?.trim() ?? ''
  );
}

describe('section numbering', () => {
  it('numbers the sections that ask, in render order', () => {
    // The three defects the hand-written markers had accumulated — a duplicate
    // `04` on /blocks/primitives/badge, a skipped `03` on
    // /blocks/components/sparkline, a page starting at `02` on
    // /blocks/primitives/journey-timeline — are all the same defect: a literal
    // that no longer matches its position. A position cannot disagree with
    // itself.
    const target = render();

    expect(markers(target)).toEqual(['01', '02', '03']);
  });

  it('skips sections that ask for no marker', () => {
    // Every component page has an unnumbered playground at the top, and two
    // have an unnumbered overview. Counting every section would have stamped
    // those and shifted all the real numbers by one.
    const target = render();
    const all = [...target.querySelectorAll('section[id]')].map((s) => s.id);

    expect(all).toContain('playground');
    expect(target.querySelector('#playground header h2 > span')).toBeNull();
  });

  it('never numbers a section nested in another', () => {
    // What keeps a `<TypesReference>` inside a playground stage unnumbered
    // while the same component at page level is numbered — without the caller
    // having to know which case it is in.
    const target = render();
    const nested = target.querySelector('#nested-in-stage');

    expect(nested).toBeTruthy();
    expect(nested?.querySelector('header h2 > span')).toBeNull();
  });

  it('lets a literal win over the count', () => {
    // The escape hatch for a page that numbers by hand. It deliberately does
    // NOT consume a number: a hand-numbered section is outside the sequence.
    const target = render({ literalOnSecond: '99' });

    expect(markers(target)).toEqual(['01', '99', '02']);
  });

  it('renders no marker outside a numbering scope', () => {
    // `<Section marker>` in a page that never mounted a DocsLayout has nothing
    // to count within. It must render no stamp rather than throw — the getter
    // of `createContext()` would have thrown here, which is why this uses
    // `hasContext`.
    const target = render({ withoutLayout: true });

    expect(markers(target)).toEqual([]);
    expect(target.querySelectorAll('section[id]').length).toBeGreaterThan(0);
  });
});
