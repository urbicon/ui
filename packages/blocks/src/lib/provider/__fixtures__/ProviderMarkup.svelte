<script lang="ts">
  import type { ComponentDefaults } from '../blocks-context';
  import BlocksProvider from '../BlocksProvider.svelte';

  /**
   * Every provider shape a consumer is allowed to write, at a real
   * `<BlocksProvider>` attribute — the only position where the props are
   * checked, since `defaults`/`presets` are inferred from what is written.
   *
   * This file carries the *accepted* half. A wrong key here is an error, so a
   * change that over-narrows the map (a component's slot missed, an unknown
   * name closed off) turns `bun run check` red on the surface consumers use,
   * not on a stand-in for it. The rejected half cannot live in markup —
   * `@ts-expect-error` has no markup form — and is held in
   * `component-slots.types.test.ts` against the type the props declare.
   */
  const inAVariable = { Button: { slotClasses: { base: 'rounded-full' } } };
  const annotated: Record<string, ComponentDefaults> = { Button: { slotClasses: { base: 'x' } } };
</script>

<BlocksProvider>nothing configured</BlocksProvider>
<BlocksProvider unstyled>flag only</BlocksProvider>
<BlocksProvider defaults={{}} presets={{}}>empty</BlocksProvider>

<!-- a known component, every slot it paints -->
<BlocksProvider defaults={{ LineChart: { slotClasses: { mark: 'a', point: 'b', root: 'c' } } }}>
  known
</BlocksProvider>

<!-- the two records that carry slot names, plus a free-form condition key -->
<BlocksProvider
  defaults={{
    Button: {
      slotClasses: { base: 'x', content: 'y', spinner: 'z' },
      overrides: [{ variant: 'outlined', class: { base: 'border' } }]
    }
  }}
  presets={{ Button: { hero: { slotClasses: { base: 'px-8' } } } }}
>
  both records
</BlocksProvider>

<!-- slots a component reads past the config resolved under its name -->
<BlocksProvider
  defaults={{
    NumberInput: { slotClasses: { stepper: 'a', stepperButton: 'b' } },
    SidebarLayout: { slotClasses: { sidebarFooter: 'c', sidebarBackdrop: 'd' } },
    Guide: { slotClasses: { skip: 'e', prev: 'f', next: 'g' } },
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
