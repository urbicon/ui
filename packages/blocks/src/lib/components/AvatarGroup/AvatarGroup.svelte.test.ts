// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AvatarGroup from './AvatarGroup.svelte';
import type { AvatarGroupProps } from './index';

// Render + composition layer for AvatarGroup: the overlap row, `max` capping to a
// "+N" overflow chip, shared sizing, and the labelled group semantics.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: AvatarGroupProps) {
  const instance = mount(AvatarGroup, {
    target: document.body,
    props: props as AvatarGroupProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const group = () => screen.getByRole('group');

const TEAM = [
  { name: 'Ada Lovelace' },
  { name: 'Alan Turing' },
  { name: 'Grace Hopper' },
  { name: 'Katherine Johnson' },
  { name: 'Edsger Dijkstra' }
];

describe('AvatarGroup', () => {
  it('renders one avatar per item inside a labelled group', () => {
    render({ items: TEAM.slice(0, 3) });
    expect(group().getAttribute('role')).toBe('group');
    expect(group().getAttribute('aria-label')).toBeTruthy();
    expect(group().children.length).toBe(3);
  });

  it('caps at `max` and renders a "+N" overflow chip as the last item', () => {
    render({ items: TEAM, max: 3 });
    // max = 3 → 2 avatars + 1 overflow chip = 3 rendered.
    expect(group().children.length).toBe(3);
    const last = group().children[group().children.length - 1];
    // 5 items, showing max-1 = 2 → overflow is 5 - 2 = 3.
    expect(last.textContent).toContain('+3');
    expect(last.getAttribute('aria-label')).toBe('+3');
  });

  it('shows every avatar and no chip when under `max`', () => {
    render({ items: TEAM.slice(0, 3), max: 5 });
    expect(group().children.length).toBe(3);
    expect(group().textContent).not.toContain('+');
  });

  it('lets a consumer override the group label', () => {
    render({ items: TEAM.slice(0, 2), 'aria-label': 'Project team' });
    expect(group().getAttribute('aria-label')).toBe('Project team');
  });

  it('applies the overlap spacing on the row', () => {
    render({ items: TEAM.slice(0, 2), spacing: 'tight' });
    expect(group().className).toContain('-space-x-4');
  });

  it('max=1 renders only the overflow chip', () => {
    render({ items: TEAM, max: 1 });
    // max - 1 = 0 avatars + 1 chip; N = all 5.
    expect(group().children.length).toBe(1);
    expect(group().children[0].textContent).toContain('+5');
  });

  it('renders no chip when max equals the item count', () => {
    render({ items: TEAM, max: 5 });
    expect(group().children.length).toBe(5);
    expect(group().textContent).not.toContain('+');
  });

  it('shows all avatars when max is 0 (treated as uncapped)', () => {
    render({ items: TEAM, max: 0 });
    expect(group().children.length).toBe(5);
    expect(group().textContent).not.toContain('+');
  });

  it('renders an empty labelled group for empty items without throwing', () => {
    render({ items: [] });
    expect(group().getAttribute('role')).toBe('group');
    expect(group().children.length).toBe(0);
  });
});
