<script lang="ts" module>
  const ladderFoldVariants = tv({
    slots: {
      base: 'flex flex-col gap-2 p-2',
      row: 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal',
      rowState: 'bg-surface-hover font-medium'
    }
  });
</script>

<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { tv } from '$lib/utils/variants';

  /**
   * A component built to carry the defect route D's co-located pass exists to
   * catch: `rowState`'s library class is folded in *after* the consumer's
   * `row` entry, in one `class` array, so the consumer cannot win that bucket.
   *
   * It is not a demonstration — it is the positive control for that branch,
   * and it is the only thing in the corpus that fails it. `stateOn` moves the
   * state between the two rows without changing the fold, which is what
   * separates "route D sees the fold" from "route D sees the fold on the first
   * element `row` lands on"; both answers are asserted by name in
   * `provider-cascade.svelte.test.ts`.
   *
   * `bg-surface-hover` rather than an arbitrary colour: route D picks its
   * challenger from `COLLISION_CANDIDATES` by asking `resolveClassChain`, so
   * the class has to sit in a bucket the engine knows.
   */
  let {
    stateOn = 'first',
    unstyled = false,
    slotClasses: slotClassesProp = {}
  }: {
    stateOn?: 'first' | 'second';
    unstyled?: boolean;
    slotClasses?: Partial<Record<'base' | 'row' | 'rowState', string>>;
  } = $props();

  const blocksConfig = getBlocksConfig();
  const variantProps = $derived({ stateOn });
  const styles = $derived(ladderFoldVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'LadderFoldProbe', undefined, variantProps, slotClassesProp)
  );
</script>

<div class={unstyled ? (slotClasses?.base ?? '') : styles.base({ class: slotClasses?.base })}>
  {#each ['first', 'second'] as const as which (which)}
    <div
      data-row={which}
      class={unstyled
        ? [slotClasses?.row, which === stateOn ? slotClasses?.rowState : undefined]
            .filter(Boolean)
            .join(' ')
        : styles.row({
            class: [
              slotClasses?.row,
              which === stateOn ? styles.rowState({ class: slotClasses?.rowState }) : undefined
            ]
          })}
    >
      {which}
    </div>
  {/each}
</div>
