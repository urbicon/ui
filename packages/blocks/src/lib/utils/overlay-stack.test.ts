import { describe, expect, it } from 'vitest';
import { overlayStack } from './overlay-stack.svelte';

describe('OverlayStack', () => {
  it('register adds an entry and the returned cleanup removes it', () => {
    const before = overlayStack.depth;
    const cleanup = overlayStack.register('test-1', () => {});
    expect(overlayStack.depth).toBe(before + 1);
    expect(overlayStack.topId).toBe('test-1');
    cleanup();
    expect(overlayStack.depth).toBe(before);
  });

  it('preserves stack order across multiple registrations', () => {
    const a = overlayStack.register('a', () => {});
    const b = overlayStack.register('b', () => {});
    expect(overlayStack.topId).toBe('b');
    expect(overlayStack.isTop('b')).toBe(true);
    expect(overlayStack.isTop('a')).toBe(false);
    b();
    expect(overlayStack.topId).toBe('a');
    a();
  });

  it('closeTop invokes only the topmost callback', () => {
    let aCalls = 0;
    let bCalls = 0;
    const a = overlayStack.register('a', () => (aCalls += 1));
    const b = overlayStack.register('b', () => (bCalls += 1));
    overlayStack.closeTop();
    expect(bCalls).toBe(1);
    expect(aCalls).toBe(0);
    a();
    b();
  });

  it('closeAll invokes every callback in reverse registration order', () => {
    const order: string[] = [];
    const a = overlayStack.register('a', () => order.push('a'));
    const b = overlayStack.register('b', () => order.push('b'));
    const c = overlayStack.register('c', () => order.push('c'));
    overlayStack.closeAll();
    expect(order).toEqual(['c', 'b', 'a']);
    a();
    b();
    c();
  });
});
