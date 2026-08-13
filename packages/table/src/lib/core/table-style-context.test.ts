import { describe, expect, it } from 'vitest';
import { tableContainerVariants } from '../variants/table.variants';
import { resolveSlotClass } from './table-style-context';

// The real `table` slot: base `w-full border-collapse`, plus `text-sm` from the
// size axis. `w-full` is the base utility a consumer's
// `slotClasses={{ table: 'w-auto' }}` needs to beat.
//
// These assertions used to name `min-w-[42rem]`, a per-step floor the config no
// longer carries — and every `not.toContain('min-w-[42rem]')` among them went on
// passing trivially once it was gone, which is the same shape of green-for-
// nothing this file exists to catch. The override target has to be a class the
// slot actually emits.
const tableSlots = tableContainerVariants({ cardsBelow: '48rem' });

describe('resolveSlotClass', () => {
  it('folds a slotClass over a conflicting base/variant utility (the fix)', () => {
    // Before the fold refactor this returned both `w-full` and `w-auto` and
    // stylesheet order decided (the landing had to reach for `!min-w-0`).
    const result = resolveSlotClass(tableSlots.table, 'w-auto', false);
    expect(result).toContain('w-auto');
    expect(result).not.toContain('w-full');
    // Non-conflicting base classes still survive the fold.
    expect(result).toContain('border-collapse');
  });

  it('keeps base + variant classes when no slotClass is given', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, false);
    expect(result).toContain('w-full');
    expect(result).toContain('border-collapse');
    expect(result).toContain('text-sm');
  });

  it('merges a non-conflicting slotClass with the base classes', () => {
    const result = resolveSlotClass(tableSlots.table, 'bg-surface-quiet', false);
    expect(result).toContain('bg-surface-quiet');
    expect(result).toContain('w-full');
    expect(result).toContain('border-collapse');
  });

  it('folds `extra` (e.g. className) over a conflicting base utility too', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, false, 'w-auto');
    expect(result).toContain('w-auto');
    expect(result).not.toContain('w-full');
  });

  it('folds both slotClass and extra over their conflicting base/variant buckets', () => {
    // Both call-site overrides live in one fold source and each strips its own
    // base/variant conflict: slotClass `text-lg` beats the size variant's
    // `text-sm`; extra `w-auto` beats the base's `w-full`.
    const result = resolveSlotClass(tableSlots.table, 'text-lg', false, 'w-auto');
    expect(result).toContain('text-lg');
    expect(result).not.toContain('text-sm');
    expect(result).toContain('w-auto');
    expect(result).not.toContain('w-full');
  });

  it('strips variant classes when unstyled, returning only the slotClass', () => {
    const result = resolveSlotClass(tableSlots.table, 'my-custom', true);
    expect(result).toBe('my-custom');
  });

  it('returns slotClass + extra (only) when unstyled', () => {
    const result = resolveSlotClass(tableSlots.table, 'slot-class', true, 'extra');
    expect(result).toBe('slot-class extra');
  });

  it('returns an empty string when unstyled with no overrides', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, true);
    expect(result).toBe('');
  });

  it('applies only `extra` when unstyled with no slotClass', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, true, 'extra-class');
    expect(result).toBe('extra-class');
  });
});
