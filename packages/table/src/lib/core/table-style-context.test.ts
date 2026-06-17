import { describe, expect, it } from 'vitest';
import { resolveSlotClass } from './table-style-context';

describe('resolveSlotClass', () => {
  it('returns variant classes when not unstyled', () => {
    const result = resolveSlotClass('bg-white p-4', undefined, false);
    expect(result).toBe('bg-white p-4');
  });

  it('merges slotClass with variant classes when not unstyled', () => {
    const result = resolveSlotClass('bg-white p-4', 'my-custom', false);
    expect(result).toBe('bg-white p-4 my-custom');
  });

  it('merges extra class with variant classes when not unstyled', () => {
    const result = resolveSlotClass('bg-white p-4', undefined, false, 'extra-class');
    expect(result).toBe('bg-white p-4 extra-class');
  });

  it('merges all three when not unstyled', () => {
    const result = resolveSlotClass('bg-white', 'slot-class', false, 'extra');
    expect(result).toBe('bg-white slot-class extra');
  });

  it('strips variant classes when unstyled', () => {
    const result = resolveSlotClass('bg-white p-4', undefined, true);
    expect(result).toBe('');
  });

  it('applies only slotClass when unstyled', () => {
    const result = resolveSlotClass('bg-white p-4', 'my-custom', true);
    expect(result).toBe('my-custom');
  });

  it('applies slotClass + extra when unstyled', () => {
    const result = resolveSlotClass('bg-white p-4', 'slot-class', true, 'extra');
    expect(result).toBe('slot-class extra');
  });

  it('handles empty variant classes', () => {
    const result = resolveSlotClass('', 'slot-class', false);
    expect(result).toBe('slot-class');
  });

  it('handles all undefined/empty inputs', () => {
    const result = resolveSlotClass('', undefined, true);
    expect(result).toBe('');
  });
});
