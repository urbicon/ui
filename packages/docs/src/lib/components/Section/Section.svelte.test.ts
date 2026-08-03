// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { SectionProps } from './index.js';
import Section from './Section.svelte';

// Svelte's own mount/unmount, not @testing-library/svelte — the latter pulls a
// second svelte instance and makes svelte-check see two unrelated `Snippet`
// types package-wide. See the `blocks-testing` skill.
let cleanup: (() => void) | null = null;

function render(props: SectionProps) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Section, { target, props });
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

describe('Section', () => {
  it('applies the class prop to the root element', () => {
    // Regression: `class` was declared in index.ts but never destructured, so
    // it was silently inert across 713 usages in this repo.
    const target = render({ id: 'usage', title: 'Usage', class: 'my-custom-class' });
    const section = target.querySelector('section');

    expect(section).not.toBeNull();
    expect(section?.classList.contains('my-custom-class')).toBe(true);
  });

  it('forwards arbitrary attributes to the root element', () => {
    const target = render({
      id: 'usage',
      title: 'Usage',
      'data-testid': 'section-root'
    } as SectionProps);

    expect(target.querySelector('section')?.getAttribute('data-testid')).toBe('section-root');
  });

  it('labels the section by its heading when there is a title', () => {
    render({ id: 'usage', title: 'Usage' });
    const section = document.querySelector('section#usage');

    expect(section?.getAttribute('aria-labelledby')).toBe('usage-title');
    // The IDREF has to resolve to a real element, or the label is a dead end.
    expect(document.getElementById('usage-title')?.textContent?.trim()).toBe('Usage');
  });

  it('omits aria-labelledby when the header carries no heading', () => {
    // Regression: `hasHeader` is true for a subtitle/meta/badges-only section,
    // but only a title renders the element carrying `headingId` — pointing
    // aria-labelledby at it left a dangling IDREF.
    render({ id: 'notes', subtitle: 'Some prose, no heading' });
    const section = document.querySelector('section#notes');

    expect(section?.getAttribute('aria-labelledby')).toBeNull();
    expect(document.getElementById('notes-title')).toBeNull();
  });

  it('keeps a real, referenced heading under titleHidden', () => {
    // The playground sections on 57 component pages render no heading by
    // design, and the table of contents offered a "Playground" entry that led
    // into an unnamed region. `titleHidden` has to give the section a heading
    // and a resolving aria-labelledby — hiding it visually is the only part
    // that changes.
    render({ id: 'playground', title: 'Playground', titleHidden: true });
    const section = document.querySelector('section#playground');

    expect(section?.getAttribute('aria-labelledby')).toBe('playground-title');
    expect(document.getElementById('playground-title')?.tagName).toBe('H2');
    expect(section?.querySelector('header')?.className).toBe('sr-only');
  });

  it('keeps the header visible when titleHidden is not set', () => {
    // Positive control for the test above: `sr-only` must come from the prop,
    // not from something the header always carries.
    render({ id: 'usage', title: 'Usage' });

    expect(document.querySelector('section#usage header')?.className).not.toContain('sr-only');
  });

  it('renders the requested heading level, clamped to 1..6', () => {
    render({ id: 'a', title: 'Level three', headingLevel: 3 });
    expect(screen.getByText('Level three').tagName).toBe('H3');
    cleanup?.();

    render({ id: 'b', title: 'Clamped', headingLevel: 99 as SectionProps['headingLevel'] });
    expect(screen.getByText('Clamped').tagName).toBe('H6');
  });

  it('drops tv defaults under unstyled but keeps slotClasses', () => {
    const target = render({
      id: 'usage',
      title: 'Usage',
      unstyled: true,
      slotClasses: { root: 'only-this' }
    });
    const section = target.querySelector('section');

    expect(section?.className).toBe('only-this');
  });

  it('renders duplicate badge labels side by side', () => {
    // Regression: badges were keyed on `badge.text`, so two badges sharing a
    // label collided.
    render({
      id: 'usage',
      title: 'Usage',
      badges: [{ text: 'beta' }, { text: 'beta' }]
    });

    expect(screen.getAllByText('beta')).toHaveLength(2);
  });
});
