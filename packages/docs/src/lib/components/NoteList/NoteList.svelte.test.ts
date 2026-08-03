// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NoteListHarness from './__fixtures__/NoteListHarness.svelte';
import Note from './Note.svelte';
import NoteList from './NoteList.svelte';

// Svelte's own mount/unmount, not @testing-library/svelte — the latter pulls a
// second svelte instance and makes svelte-check see two unrelated `Snippet`
// types package-wide. See the `blocks-testing` skill.
let cleanup: (() => void) | null = null;

function render<P extends Record<string, unknown>>(
  Component: Parameters<typeof mount>[0],
  props: P
): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Component, { target, props });
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

describe('NoteList', () => {
  it('renders the card and the divided row container', () => {
    const target = render(NoteList, {});
    const root = target.firstElementChild as HTMLElement;

    expect(root.className).toContain('bg-surface-elevated');
    expect(root.firstElementChild?.className).toContain('divide-y');
  });

  it('drops the card chrome under the flush variant', () => {
    const target = render(NoteList, { variant: 'flush' });
    const root = target.firstElementChild as HTMLElement;

    expect(root.className).toContain('border-0');
    // The rules between rows are the point of the component; only the outer
    // card goes away.
    expect(root.firstElementChild?.className).toContain('divide-y');
  });

  it('forwards arbitrary attributes and merges class onto the root', () => {
    const target = render(NoteList, { class: 'my-card', 'data-testid': 'notes' });
    const root = target.firstElementChild as HTMLElement;

    expect(root.classList.contains('my-card')).toBe(true);
    expect(root.getAttribute('data-testid')).toBe('notes');
  });

  it('drops tv defaults under unstyled but keeps slotClasses', () => {
    const target = render(NoteList, { unstyled: true, slotClasses: { root: 'only-this' } });
    const root = target.firstElementChild as HTMLElement;

    expect(root.className).toBe('only-this');
  });
});

describe('Note', () => {
  it('renders the title as an h3 by default', () => {
    // A note sits under a Section (h2) alongside CodeExample titles, which are
    // h3. h4 here — the level the hand-written markup used before this
    // component existed — put an h2 → h4 skip on every page with an
    // accessibility card, and made that card the only sub-block on the page
    // that was not h3.
    render(Note, { title: 'Built-in ARIA' });

    expect(screen.getByText('Built-in ARIA').tagName).toBe('H3');
  });

  it('renders the requested heading level, clamped to 1..6', () => {
    render(Note, { title: 'Level four', headingLevel: 4 });
    expect(screen.getByText('Level four').tagName).toBe('H4');
    cleanup?.();

    render(Note, { title: 'Clamped', headingLevel: 99 });
    expect(screen.getByText('Clamped').tagName).toBe('H6');
  });

  it('omits the heading entirely when there is no title', () => {
    const target = render(Note, {});

    expect(target.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
  });

  it('carries the prose tokens on the row, not on an inner paragraph', () => {
    // The body must be free to be a <ul> or several <p>s. If the component
    // wrapped it in a <p>, block content inside a note would be invalid HTML.
    const target = render(Note, { title: 'Keyboard' });
    const root = target.firstElementChild as HTMLElement;

    expect(root.className).toContain('text-text-secondary');
    expect(root.className).toContain('leading-relaxed');
  });

  it('spaces every row identically instead of positionally', () => {
    // Regression guard for the reason this component exists: the hand-written
    // markup used pb-4 / py-4 / pt-4 depending on where a row sat, so inserting
    // a note meant fixing its neighbours. Every row now carries the same class
    // and the edges are handled by first:/last: variants.
    render(NoteListHarness, {});
    const rows = [...document.querySelectorAll('[data-note-row]')] as HTMLElement[];

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.className).toContain('py-4');
      expect(row.className).toContain('first:pt-0');
      expect(row.className).toContain('last:pb-0');
    }
  });
});
