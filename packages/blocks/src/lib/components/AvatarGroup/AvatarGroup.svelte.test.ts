// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AvatarGroup from './AvatarGroup.svelte';
import { avatarGroupVariants } from './avatar-group.variants';
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

/**
 * Overlapping avatars must not eat the second initial.
 *
 * Each avatar centres its initials and the next one covers its right edge, so
 * with two-letter initials the second letter was painted underneath the
 * neighbour: "Io Nakamura" read "II", "Ada Lovelace" read "AI". The docs page
 * demonstrated the defect in its own default example.
 *
 * jsdom computes no layout, so these cases assert the *mechanism*: the marker
 * lands on the right nodes, and the counter-shift is scoped to exactly the
 * avatars that are covered. Whether 6px is the right offset for a given size is
 * a visual judgement and belongs to the VR suite; that the last avatar is
 * excluded, and that an image is never shifted, is logic and belongs here.
 */
describe('AvatarGroup — initials under the overlap', () => {
  const NAMED = [{ name: 'Io Nakamura' }, { name: 'Ada Lovelace' }, { name: 'Grace Hopper' }];

  it('marks every initials span so the shift can reach it', () => {
    render({ items: NAMED });
    const marked = document.querySelectorAll('[data-avatar-fallback]');
    expect(marked).toHaveLength(3);
    // Both letters were always in the DOM. The defect was where they painted.
    expect(marked[0].textContent?.trim()).toBe('IN');
  });

  it('does not mark an image avatar', () => {
    // With an image the overlap is the intended stack — nothing must move.
    render({ items: [{ src: 'https://example.com/a.png', name: 'Io Nakamura' }] });
    expect(document.querySelectorAll('[data-avatar-fallback]')).toHaveLength(0);
    expect(document.querySelector('img')).not.toBeNull();
  });

  it('does not mark the overflow chip', () => {
    // The chip renders through `children`, not the fallback path, and it is last
    // — nothing covers it.
    render({ items: NAMED, max: 2 });
    expect(document.querySelectorAll('[data-avatar-fallback]')).toHaveLength(1);
  });

  describe('the shift is scoped to the covered avatars', () => {
    // Read off the variant config: jsdom applies no Tailwind, so the class
    // string is the observable.
    const base = (spacing: 'tight' | 'normal' | 'loose') => avatarGroupVariants({ spacing }).base();

    it('excludes the last avatar via :not(:last-child)', () => {
      // The rightmost avatar is covered by nothing, so its initials stay
      // centred. When an overflow chip follows, the last real avatar IS covered
      // — and stops being :last-child, so it shifts. One selector, both cases.
      expect(base('normal')).toContain(':not(:last-child)');
    });

    it('targets the initials, not the frame', () => {
      // A selector on the frame would move an image too.
      expect(base('normal')).toContain('[data-avatar-fallback]');
    });

    it('shifts by half the COVERED width — margin plus ring — per spacing', () => {
      // The ring counts: AvatarGroup renders every avatar with `ring-2
      // ring-offset-2`, a 4px opaque annulus outside the border box that the
      // later sibling paints over. So -space-x-4 covers 16+4 → shift 10 (2.5),
      // -3 covers 12+4 → 8 (2), -2 covers 8+4 → 6 (1.5). Scale steps rather than
      // arbitrary px, so the shift tracks a --spacing override.
      expect(base('tight')).toContain('-translate-x-2.5');
      expect(base('normal')).toContain('-translate-x-2');
      expect(base('loose')).toContain('-translate-x-1.5');
    });

    it('flips the direction in RTL', () => {
      for (const spacing of ['tight', 'normal', 'loose'] as const) {
        expect(base(spacing), spacing).toMatch(/rtl:\[&>\*:not\(:last-child\)/);
      }
    });
  });
});
