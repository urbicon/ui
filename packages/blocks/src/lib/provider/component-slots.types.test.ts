import type { Snippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import BlocksProvider from './BlocksProvider.svelte';
import type { BlocksDefaults } from './blocks-context';
import type { SlotOf } from './component-slots';

/** Both directions, so neither a widened nor a narrowed answer passes. */
type Eq<X, Y> = [X] extends [Y] ? ([Y] extends [X] ? true : false) : false;

const children = null as unknown as Snippet;
const internal = null as unknown as never;

/**
 * The compile-time contract of the provider's slot keys, asserted **on the
 * component itself**.
 *
 * A Svelte 5 component is a callable `(internal, props)` — the same signature
 * svelte2tsx gives a `<BlocksProvider …>` attribute, and the one its generated
 * `.d.ts` declares. Calling it here therefore checks the real prop type with
 * the real inference, while a `.ts` file still lets `@ts-expect-error` carry
 * the *rejected* half, which markup has no way to express.
 *
 * That matters more than it sounds. A local restatement of the prop's signature
 * checks its own declaration, so it cannot see the prop change underneath it:
 * measured, replacing the prop with `defaults?: TDefaults` — the shape that let
 * a wrong key beside a right one through — left a restated pair completely
 * green. These calls go red on that, and on narrowing the prop to
 * `Record<TDefaultKeys, unknown>`.
 *
 * Two mechanics to keep:
 *
 * - the calls live in a closure nothing invokes. They exist to be type-checked;
 *   running one would mount a component.
 * - the directive belongs on the line the error *lands* on — above
 *   `defaults:`, not above `BlocksProvider(`, because the error sits inside the
 *   multi-line literal. Placed on the call it is reported unused.
 *
 * Every negative is an `@ts-expect-error`, so the day one stops being reported
 * the directive goes unused and this file fails to compile.
 */
describe('provider slot keys', () => {
  it('rejects a slot name the component does not have', () => {
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error `arc` is DonutChart's slot; LineChart never paints one
        defaults: { LineChart: { slotClasses: { arc: 'fill-red-500' } } }
      });
      BlocksProvider(internal, {
        children,
        // @ts-expect-error … and beside a key that does resolve
        defaults: { LineChart: { slotClasses: { mark: 'ok', arc: 'fill-red-500' } } }
      });
      BlocksProvider(internal, {
        children,
        defaults: { LineChart: { slotClasses: { mark: 'ok', point: 'ok' } } }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('checks the second slot record — `overrides[].class`', () => {
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error the condition key is free-form, the class record is not
        defaults: { LineChart: { overrides: [{ layout: 'cartesian', class: { arc: 'x' } }] } }
      });
      BlocksProvider(internal, {
        children,
        // @ts-expect-error the same record, reached through a preset
        presets: { LineChart: { dense: { overrides: [{ class: { arc: 'x' } }] } } }
      });
      BlocksProvider(internal, {
        children,
        defaults: { LineChart: { overrides: [{ layout: 'cartesian', class: { mark: 'ok' } }] } }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('checks presets under the same names as defaults', () => {
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error a preset is not a way around the component's slot names
        presets: { LineChart: { dense: { slotClasses: { arc: 'x' } } } }
      });
      BlocksProvider(internal, {
        children,
        presets: { LineChart: { dense: { slotClasses: { legendSwatch: 'ok' } } } }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('keeps each chart to the slots it paints', () => {
    // The five charts share one `chartVariants`, so a config-derived map would
    // give every chart every chart's slots. These are what separates them.
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error `point` is a LineChart slot; a donut has no data points
        defaults: { DonutChart: { slotClasses: { point: 'x' } } }
      });
      BlocksProvider(internal, {
        children,
        defaults: {
          DonutChart: { slotClasses: { arc: 'ok', centerLabel: 'ok' } },
          LineChart: { slotClasses: { point: 'ok' } }
        }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('keeps a deliberate narrowing narrow', () => {
    // SegmentGroup's props exclude `item`; SegmentItem owns it.
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        // @ts-expect-error `item` belongs to SegmentItem, not to the group
        defaults: { SegmentGroup: { slotClasses: { item: 'x' } } }
      });
      BlocksProvider(internal, {
        children,
        defaults: {
          SegmentGroup: { slotClasses: { base: 'ok', indicator: 'ok' } },
          SegmentItem: { slotClasses: { item: 'ok' } }
        }
      });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('does not see a wrong key beside a right one once the record is a variable', () => {
    // The blind spot, pinned rather than described: excess-property checking
    // reaches a fresh object literal only, so these same two keys — an error
    // written inline above — reach the provider unreported through a `const`.
    const sc = { mark: 'ok', arc: 'x' };
    const typeCheckedOnly = () => {
      BlocksProvider(internal, { children, defaults: { LineChart: { slotClasses: sc } } });
    };
    expect(typeCheckedOnly).toBeTypeOf('function');
  });

  it('leaves a name from outside this package alone', () => {
    // `resolveSlotClasses(config, 'YourWrapper', …)` is a documented consumer
    // path (COMPONENT-API-CONVENTIONS.md) and `@urbicon-ui/auth` resolves under
    // its own names too. Their slots are not knowable here, so any key passes.
    //
    // Asserted on `SlotOf` as well as through the component: an unknown name
    // resolving to `never` would make the value type `{}`, which accepts any
    // object for a different reason — the call below would keep compiling while
    // the typing was gone.
    const open: Eq<SlotOf<'MoneyField'>, string> = true;
    const known: Eq<SlotOf<'Popover'>, 'base'> = true;
    const typeCheckedOnly = () => {
      BlocksProvider(internal, {
        children,
        defaults: {
          MoneyField: { slotClasses: { currencyAffix: 'ok', anythingAtAll: 'ok' } },
          LoginPage: {
            slotClasses: { form: 'ok' },
            overrides: [{ variant: 'x', class: { form: 'ok' } }]
          }
        }
      });
    };
    expect([open, known, typeCheckedOnly]).toBeDefined();
  });

  it('admits the slot names a component reads past the config resolved for it', () => {
    // Five components read slot names the `tv()` config handed to the resolver
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
      Guide: { slotClasses: { next: 'ok', prev: 'ok', skip: 'ok' } },
      Popover: { slotClasses: { base: 'ok' } },
      Separator: { slotClasses: { base: 'ok' } }
    };
    expect(beyond).toBeDefined();
  });
});
