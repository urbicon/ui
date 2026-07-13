import { describe, expect, it } from 'vitest';
import { tableContainerVariants } from '../variants/table.variants';
import { resolveSlotClass } from './table-style-context';

// The real `table` slot: base `w-full border-collapse`, and with the default
// `responsive: true` it also carries `min-w-[600px]` — the exact base utility a
// consumer's `slotClasses={{ table: 'min-w-0' }}` needs to beat.
const tableSlots = tableContainerVariants({ responsive: true });

describe('resolveSlotClass', () => {
  it('folds a slotClass over a conflicting base/variant utility (the fix)', () => {
    // Before the fold refactor this returned both `min-w-[600px]` and `min-w-0`
    // and stylesheet order decided (the landing had to reach for `!min-w-0`).
    const result = resolveSlotClass(tableSlots.table, 'min-w-0', false);
    expect(result).toContain('min-w-0');
    expect(result).not.toContain('min-w-[600px]');
    // Non-conflicting base classes still survive the fold.
    expect(result).toContain('border-collapse');
  });

  it('keeps base + variant classes when no slotClass is given', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, false);
    expect(result).toContain('w-full');
    expect(result).toContain('border-collapse');
    expect(result).toContain('min-w-[600px]');
  });

  it('merges a non-conflicting slotClass with the base classes', () => {
    const result = resolveSlotClass(tableSlots.table, 'bg-surface-quiet', false);
    expect(result).toContain('bg-surface-quiet');
    expect(result).toContain('w-full');
    expect(result).toContain('min-w-[600px]');
  });

  it('folds `extra` (e.g. className) over a conflicting base utility too', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, false, 'min-w-0');
    expect(result).toContain('min-w-0');
    expect(result).not.toContain('min-w-[600px]');
  });

  it('folds both slotClass and extra over their conflicting base/variant buckets', () => {
    // Both call-site overrides live in one fold source and each strips its own
    // base/variant conflict: slotClass `text-lg` beats the size variant's
    // `text-sm`; extra `min-w-0` beats the responsive base's `min-w-[600px]`.
    const result = resolveSlotClass(tableSlots.table, 'text-lg', false, 'min-w-0');
    expect(result).toContain('text-lg');
    expect(result).not.toContain('text-sm');
    expect(result).toContain('min-w-0');
    expect(result).not.toContain('min-w-[600px]');
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
