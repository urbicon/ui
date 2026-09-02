import { describe, expect, it } from 'vitest';
import type { BlocksDefaults, BlocksPresets } from './blocks-context';
import type { SlotOf } from './component-slots';

/** Both directions, so neither a widened nor a narrowed answer passes. */
type Eq<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

/**
 * The compile-time contract of the provider's slot keys. Assertions live in the
 * type positions; the single runtime `expect` only keeps vitest satisfied.
 *
 * `BlocksDefaults<{ Name: unknown }>` is the target a `<BlocksProvider
 * defaults={{ … }}>` attribute produces: the key is known, the value is a fresh
 * object literal. That pairing is what makes excess-property checking apply, and
 * it is why these run sharper than a generic call — inference from an argument
 * makes the literal its own target, where a wrong key beside a right one passes.
 * Measured; `MIGRATION.md` carries the table.
 *
 * Every negative is an `@ts-expect-error`, so the day one of these stops being
 * reported the directive goes unused and this file fails to compile.
 */
describe('provider slot keys', () => {
  it('rejects a slot name the component does not have', () => {
    type D = BlocksDefaults<{ LineChart: unknown }>;

    // @ts-expect-error `arc` is DonutChart's slot; LineChart never paints one
    const alone: D = { LineChart: { slotClasses: { arc: 'fill-red-500' } } };
    // @ts-expect-error … and beside a key that does resolve
    const beside: D = { LineChart: { slotClasses: { mark: 'ok', arc: 'fill-red-500' } } };
    const good: D = { LineChart: { slotClasses: { mark: 'ok', point: 'ok' } } };

    expect([alone, beside, good]).toBeDefined();
  });

  it('does not see a wrong key beside a right one once the record is a variable', () => {
    // The blind spot, pinned rather than described: excess-property checking
    // reaches a fresh object literal only, so these same two keys — an error in
    // the attribute above — reach the provider unreported through a `const`.
    const sc = { mark: 'ok', arc: 'x' };
    const through: BlocksDefaults<{ LineChart: unknown }> = { LineChart: { slotClasses: sc } };
    expect(through).toBeDefined();
  });

  it('checks the second slot record — `overrides[].class`', () => {
    type D = BlocksDefaults<{ LineChart: unknown }>;
    type P = BlocksPresets<{ LineChart: unknown }>;

    // @ts-expect-error the condition key is free-form, the class record is not
    const d: D = { LineChart: { overrides: [{ layout: 'cartesian', class: { arc: 'x' } }] } };
    // @ts-expect-error same record, reached through a preset
    const p: P = { LineChart: { dense: { overrides: [{ class: { arc: 'x' } }] } } };
    const ok: D = { LineChart: { overrides: [{ layout: 'cartesian', class: { mark: 'ok' } }] } };

    expect([d, p, ok]).toBeDefined();
  });

  it('checks presets under the same names as defaults', () => {
    type P = BlocksPresets<{ LineChart: unknown }>;
    // @ts-expect-error a preset is not a way around the component's slot names
    const bad: P = { LineChart: { dense: { slotClasses: { arc: 'x' } } } };
    const good: P = { LineChart: { dense: { slotClasses: { legendSwatch: 'ok' } } } };
    expect([bad, good]).toBeDefined();
  });

  it('keeps each chart to the slots it paints', () => {
    type Charts = BlocksDefaults<{ DonutChart: unknown; LineChart: unknown }>;
    // The five charts share one `chartVariants`, so a config-derived map would
    // give every chart every chart's slots. These two are what separates them.
    const donut: Charts = {
      DonutChart: { slotClasses: { arc: 'ok', centerLabel: 'ok' } },
      LineChart: { slotClasses: { point: 'ok' } }
    };
    // @ts-expect-error `point` is a LineChart slot; a donut has no data points
    const crossed: Charts = { DonutChart: { slotClasses: { point: 'x' } }, LineChart: {} };
    expect([donut, crossed]).toBeDefined();
  });

  it('admits the slot names a component reads past its own config', () => {
    // Five components read slot names the `tv()` config they hand the resolver
    // does not declare. The map comes from their props, so none of these is
    // reported — a config-derived one would call all five a typo.
    const beyond: BlocksDefaults<{
      NumberInput: unknown;
      SidebarLayout: unknown;
      Guide: unknown;
      Popover: unknown;
      Separator: unknown;
    }> = {
      NumberInput: { slotClasses: { stepper: 'ok', stepperButton: 'ok' } },
      SidebarLayout: { slotClasses: { sidebarFooter: 'ok', sidebarBackdrop: 'ok' } },
      Guide: { slotClasses: { skip: 'ok', next: 'ok' } },
      Popover: { slotClasses: { base: 'ok' } },
      Separator: { slotClasses: { base: 'ok' } }
    };
    expect(beyond).toBeDefined();
  });

  it('keeps a deliberate narrowing narrow', () => {
    // SegmentGroup's props exclude `item`; SegmentItem owns it.
    type S = BlocksDefaults<{ SegmentGroup: unknown; SegmentItem: unknown }>;
    const split: S = {
      SegmentGroup: { slotClasses: { base: 'ok', indicator: 'ok' } },
      SegmentItem: { slotClasses: { item: 'ok' } }
    };
    // @ts-expect-error `item` belongs to SegmentItem, not to the group
    const merged: S = { SegmentGroup: { slotClasses: { item: 'x' } }, SegmentItem: {} };
    expect([split, merged]).toBeDefined();
  });

  it('leaves a name from outside this package alone', () => {
    // `resolveSlotClasses(config, 'YourWrapper', …)` is a documented consumer
    // path (COMPONENT-API-CONVENTIONS.md) and `@urbicon-ui/auth` resolves under
    // its own names too. Their slots are not knowable here, so any key passes.
    // Asserted on `SlotOf` itself: an unknown name resolving to `never` would
    // make the value type `{}`, which accepts any object for a different reason
    // — the usage below would keep compiling while the typing was gone.
    const open: Eq<SlotOf<'MoneyField'>, string> = true;
    const known: Eq<SlotOf<'Popover'>, 'base'> = true;

    const foreign: BlocksDefaults<{ MoneyField: unknown; LoginPage: unknown }> = {
      MoneyField: { slotClasses: { currencyAffix: 'ok', anythingAtAll: 'ok' } },
      LoginPage: {
        slotClasses: { form: 'ok' },
        overrides: [{ variant: 'x', class: { form: 'ok' } }]
      }
    };
    expect([open, known, foreign]).toBeDefined();
  });
});
