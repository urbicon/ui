<script lang="ts">
  import type { ComponentDefaults } from '../blocks-context';
  import BlocksProvider from '../BlocksProvider.svelte';

  /**
   * Provider shapes a consumer is allowed to write, at a real
   * `<BlocksProvider>` attribute — the position the props are actually checked
   * in, since `defaults` and `presets` infer their keys from what is written.
   *
   * **What this file catches: a slot a component has going missing from the
   * map.** Over-narrowing reddens the entry that uses it, at the attribute
   * consumers use rather than at a stand-in. Measured: dropping `stepper` from
   * `NumberInputProps` reddens the `NumberInput` line below.
   *
   * **What it does not catch, though it reads as if it should: an unknown name
   * being closed off.** `SlotOf` answering `never` makes the value type `{}`,
   * and `{}` accepts any object — so the `MoneyField` line keeps compiling
   * while the typing behind it is gone. `component-slots.types.test.ts` asserts
   * `SlotOf` directly for that reason. The same collapse hides a component
   * whose slot set disappears **entirely**: measured, emptying `SegmentItem`'s
   * one slot leaves this file and the type test both green.
   *
   * The rejected half is not here — `@ts-expect-error` has no markup form. It
   * lives in `component-slots.types.test.ts`, which calls the component as the
   * function it is and so checks the same prop type.
   *
   * The class *values* below are inert placeholders, never real utilities, and
   * no real utility may be named in this comment either. The file sits under
   * `src/lib` and is not named `.test.`, so the docs site's word-bounded token
   * census counts anything Tailwind-shaped in it — prose included. One weight
   * utility written here for realism moved that page's published use count by
   * one and failed its test.
   */
  const inAVariable = { Button: { slotClasses: { base: 'c1' } } };
  const annotated: Record<string, ComponentDefaults> = { Button: { slotClasses: { base: 'x' } } };
  const dense = { LineChart: { slotClasses: { mark: 'c4' } } };
  let compact = $state(false);
</script>

<BlocksProvider>nothing configured</BlocksProvider>
<BlocksProvider unstyled>flag only</BlocksProvider>
<BlocksProvider defaults={{}} presets={{}}>empty</BlocksProvider>

<!-- a known component, several of the slots it paints -->
<BlocksProvider defaults={{ LineChart: { slotClasses: { mark: 'a', point: 'b', root: 'c' } } }}>
  known
</BlocksProvider>

<!-- all four provider slot records at once: both `slotClasses`, both `overrides[].class` -->
<BlocksProvider
  defaults={{
    Button: {
      slotClasses: { base: 'x', content: 'y', spinner: 'z' },
      overrides: [{ variant: 'outlined', class: { base: 'c6' } }]
    }
  }}
  presets={{
    Button: {
      hero: {
        slotClasses: { base: 'c2' },
        overrides: [{ variant: 'filled', class: { content: 'c3' } }]
      }
    }
  }}
>
  both records, both branches
</BlocksProvider>

<!-- a config switched on at runtime: the union must not be a false alarm -->
<BlocksProvider defaults={compact ? dense : {}}>conditional</BlocksProvider>
<BlocksProvider defaults={compact ? dense : { Button: { slotClasses: { base: 'c5' } } }}>
  ternary over different components
</BlocksProvider>

<!-- slots a component reads past the config resolved under its name -->
<BlocksProvider
  defaults={{
    NumberInput: { slotClasses: { stepper: 'a', stepperButton: 'b' } },
    SidebarLayout: { slotClasses: { sidebarFooter: 'c', sidebarBackdrop: 'd' } },
    Guide: { slotClasses: { next: 'e', prev: 'f', skip: 'g' } },
    Popover: { slotClasses: { base: 'h' } },
    Separator: { slotClasses: { base: 'i' } }
  }}
>
  past the config
</BlocksProvider>

<!-- a deliberate split: the group has no `item`, the item has nothing else -->
<BlocksProvider
  defaults={{
    SegmentGroup: { slotClasses: { base: 'a', indicator: 'b' } },
    SegmentItem: { slotClasses: { item: 'c' } }
  }}
>
  split
</BlocksProvider>

<!-- names from outside this package: a consumer wrapper and an auth component -->
<BlocksProvider
  defaults={{
    MoneyField: { slotClasses: { currencyAffix: 'a', anythingAtAll: 'b' } },
    LoginForm: { slotClasses: { form: 'c' }, overrides: [{ variant: 'x', class: { form: 'd' } }] }
  }}
>
  foreign
</BlocksProvider>

<BlocksProvider defaults={inAVariable}>variable</BlocksProvider>
<BlocksProvider defaults={annotated}>annotated</BlocksProvider>
