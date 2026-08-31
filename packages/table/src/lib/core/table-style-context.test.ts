import { describe, expect, it } from 'vitest';
import { LAYOUT_SWITCH_CLASSES, tableContainerVariants } from '../variants/table.variants';
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

  it('folds `structural` (e.g. className) over a conflicting base utility too', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, false, 'w-auto');
    expect(result).toContain('w-auto');
    expect(result).not.toContain('w-full');
  });

  it('folds both slotClass and structural over their conflicting base/variant buckets', () => {
    // Both call-site overrides live in one fold source and each strips its own
    // base/variant conflict: slotClass `text-lg` beats the size variant's
    // `text-sm`; structural `w-auto` beats the base's `w-full`.
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

  it('returns slotClass + structural (only) when unstyled', () => {
    const result = resolveSlotClass(tableSlots.table, 'slot-class', true, 'extra');
    expect(result).toBe('slot-class extra');
  });

  it('returns an empty string when unstyled with no overrides', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, true);
    expect(result).toBe('');
  });

  it('applies only `structural` when unstyled with no slotClass', () => {
    const result = resolveSlotClass(tableSlots.table, undefined, true, 'extra-class');
    expect(result).toBe('extra-class');
  });
});

/**
 * `unstyled` is documented as a styling switch, and on the `container` slot it
 * was also a layout switch: it dropped everything the config emitted, and the
 * query container the desktop/card switch is measured against is a base class
 * of that slot. Its two `hidden` halves ride the `structural` argument and
 * always survived, so `unstyled` left the mechanism half-wired — neither half
 * could match, so neither layout hid (#271).
 *
 * These are string assertions; whether the classes then hide anything is CSS,
 * and `Table.layoutswitch.svelte.test.ts` pins the DOM-level invariant.
 */
describe('resolveSlotClass — what `unstyled` keeps of the container slot', () => {
  const { container } = tableContainerVariants({ cardsBelow: '48rem' });

  it('keeps the query container and nothing else', () => {
    expect(resolveSlotClass(container, undefined, true)).toBe('@container');
  });

  it('positive control: styled, the same slot emits the look it just dropped', () => {
    // Without this the assertion above would also pass on a slot that emitted
    // `@container` alone — i.e. on a filter that keeps everything.
    const styled = resolveSlotClass(container, undefined, false);
    for (const look of ['flex', 'flex-col', 'gap-2', 'w-full']) {
      expect(styled.split(/\s+/), `styled container is missing ${look}`).toContain(look);
    }
    const unstyled = resolveSlotClass(container, undefined, true).split(/\s+/);
    for (const look of ['flex', 'flex-col', 'gap-2', 'w-full']) {
      expect(unstyled, `unstyled container still carries ${look}`).not.toContain(look);
    }
  });

  it('orders the kept class before the overrides, so a tie still goes to the caller', () => {
    expect(resolveSlotClass(container, 'my-grid', true, 'relative')).toBe(
      '@container my-grid relative'
    );
  });

  it('keeps nothing from a slot that declares no structural class', () => {
    // The `table` slot is pure look, so `unstyled` empties it — the control
    // that the branch above filters rather than passes through.
    expect(resolveSlotClass(tableSlots.table, undefined, true)).toBe('');
    expect(LAYOUT_SWITCH_CLASSES).not.toContain('w-full');
  });

  // ── the fifth parameter: the consumer's own `class` prop ──────────────────
  //
  // `className` is a source of its own AFTER `slotClass`/`structural`, which is
  // the top rung of the override ladder. `structural` deliberately shares its
  // source with `slotClass` — see the docstring — so these two questions have
  // different answers on purpose.

  it('lets the class prop beat a slotClass in the same bucket', () => {
    const result = resolveSlotClass(tableSlots.table, 'w-auto', false, undefined, 'w-px');
    expect(result).toContain('w-px');
    expect(result).not.toContain('w-auto');
    expect(result).not.toContain('w-full');
  });

  it('leaves slotClass and structural to the cascade between themselves', () => {
    // The pair the layout switch depends on: `structural` must not be able to
    // strip a `slotClass`, nor the other way round.
    const result = resolveSlotClass(tableSlots.table, 'w-auto', false, 'w-px').split(/\s+/);
    expect(result).toContain('w-auto');
    expect(result).toContain('w-px');
  });

  it('lets the class prop beat the library default under `unstyled` too', () => {
    const result = resolveSlotClass(tableSlots.table, 'w-auto', true, undefined, 'w-px');
    expect(result.split(/\s+/)).toEqual(['w-px']);
  });

  it('keeps the query container when the class prop collides with it', () => {
    // `@container` and `@container/x` both write `container-type`. Folding the
    // kept structural classes together with `className` removed the container
    // the desktop/card switch is measured against, and with it the switch: the
    // grid and the card list would render at the same time.
    const result = resolveSlotClass(container, undefined, true, undefined, '@container/x').split(
      /\s+/
    );
    expect(result, 'the query container survives its own bucket').toContain('@container');
    expect(result, "the caller's container name arrives too").toContain('@container/x');
  });

  it('keeps every switch half when the class prop collides with one', () => {
    const half = LAYOUT_SWITCH_CLASSES.find((cls) => cls.includes('48rem'));
    const result = resolveSlotClass(container, undefined, true, undefined, half).split(/\s+/);
    expect(result.filter((cls) => cls === half).length, 'the half is not duplicated').toBe(1);
    for (const kept of LAYOUT_SWITCH_CLASSES.filter((cls) => container().includes(cls))) {
      expect(result, `${kept} was stripped by the class prop`).toContain(kept);
    }
  });

  it('protects every step of the switch, not just the default', () => {
    // A step added to CARDS_BELOW_STEPS joins the protected set on its own;
    // this is the assertion that would fail if that derivation were replaced by
    // a hand-written list.
    for (const step of ['24rem', '32rem', '48rem', '56rem'] as const) {
      expect(LAYOUT_SWITCH_CLASSES).toContain(`@max-[${step}]:hidden`);
      expect(LAYOUT_SWITCH_CLASSES).toContain(`@min-[${step}]:hidden`);
    }
  });
});
