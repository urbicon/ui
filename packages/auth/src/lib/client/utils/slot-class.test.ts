import { describe, expect, it } from 'vitest';
import { slotClass } from './slot-class.js';

describe('slotClass', () => {
  it('joins base and slot when styled', () => {
    expect(slotClass(false, 'p-2 text-sm', 'custom')).toBe('p-2 text-sm custom');
  });

  it('drops the base entirely when unstyled — the slot always survives', () => {
    expect(slotClass(true, 'p-2 text-sm', 'custom')).toBe('custom');
  });

  it('emits no stray whitespace without a slot', () => {
    expect(slotClass(false, 'p-2')).toBe('p-2');
    expect(slotClass(true, 'p-2')).toBe('');
  });
});
