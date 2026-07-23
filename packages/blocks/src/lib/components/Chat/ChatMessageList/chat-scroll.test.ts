import { describe, expect, it } from 'vitest';
import {
  appendedCount,
  classifyTransition,
  distanceFromBottom,
  type ListIdSnapshot,
  RESTICK_PX,
  resolveScrollIntent
} from './chat-scroll';

function snap(scrollTop: number, scrollHeight = 1000, clientHeight = 400) {
  return { scrollTop, scrollHeight, clientHeight };
}

function ids(
  firstId: string | undefined,
  lastId: string | undefined,
  length: number
): ListIdSnapshot {
  return { firstId, lastId, length };
}

describe('distanceFromBottom', () => {
  it('measures the gap below the viewport', () => {
    expect(distanceFromBottom(snap(0))).toBe(600);
    expect(distanceFromBottom(snap(600))).toBe(0);
  });

  it('clamps overscroll bounce to zero', () => {
    expect(distanceFromBottom(snap(650))).toBe(0);
  });
});

describe('resolveScrollIntent', () => {
  it('sticks anywhere inside the bottom zone regardless of direction', () => {
    expect(resolveScrollIntent(snap(600), 600)).toBe('stick');
    expect(resolveScrollIntent(snap(600 - RESTICK_PX), 600)).toBe('stick');
  });

  it('unsticks on upward movement outside the bottom zone', () => {
    expect(resolveScrollIntent(snap(300), 400)).toBe('unstick');
  });

  it('never unsticks on downward movement (programmatic follow scroll)', () => {
    expect(resolveScrollIntent(snap(300), 200)).toBe('none');
  });

  it('ignores sub-pixel upward jitter', () => {
    expect(resolveScrollIntent(snap(299.5), 300)).toBe('none');
  });

  it('bottom zone wins over upward direction (macOS bounce-back)', () => {
    expect(resolveScrollIntent(snap(590), 610)).toBe('stick');
  });

  it('reports none for a plain downward scroll away from the bottom', () => {
    expect(resolveScrollIntent(snap(100), 50)).toBe('none');
  });
});

describe('classifyTransition', () => {
  const empty = ids(undefined, undefined, 0);

  it('classifies the first non-empty render as initial', () => {
    expect(classifyTransition(empty, ids('a', 'c', 3))).toBe('initial');
  });

  it('classifies stable ids with stable length as none (streaming content growth)', () => {
    expect(classifyTransition(ids('a', 'c', 3), ids('a', 'c', 3))).toBe('none');
  });

  it('classifies new tail messages as append', () => {
    expect(classifyTransition(ids('a', 'c', 3), ids('a', 'e', 5))).toBe('append');
  });

  it('classifies a swapped tail id at equal length as append', () => {
    expect(classifyTransition(ids('a', 'c', 3), ids('a', 'd', 3))).toBe('append');
  });

  it('classifies history loading at the top as prepend', () => {
    expect(classifyTransition(ids('c', 'e', 3), ids('a', 'e', 8))).toBe('prepend');
  });

  it('degrades simultaneous prepend+append to replace', () => {
    expect(classifyTransition(ids('c', 'e', 3), ids('a', 'f', 9))).toBe('replace');
  });

  it('classifies clearing the list as replace', () => {
    expect(classifyTransition(ids('a', 'c', 3), empty)).toBe('replace');
  });

  it('stays none while both lists are empty', () => {
    expect(classifyTransition(empty, empty)).toBe('none');
  });

  it('classifies a single-message list swap as replace', () => {
    expect(classifyTransition(ids('a', 'a', 1), ids('b', 'b', 1))).toBe('replace');
  });

  it('classifies trailing deletion as truncate, never append', () => {
    expect(classifyTransition(ids('a', 'c', 3), ids('a', 'b', 2))).toBe('truncate');
  });

  it('still classifies a same-length tail swap as append (not truncate)', () => {
    expect(classifyTransition(ids('a', 'c', 3), ids('a', 'd', 3))).toBe('append');
  });
});

describe('appendedCount', () => {
  it('counts the length delta', () => {
    expect(appendedCount(3, 5)).toBe(2);
  });

  it('counts a same-length tail swap as one new message', () => {
    expect(appendedCount(3, 3)).toBe(1);
  });
});
