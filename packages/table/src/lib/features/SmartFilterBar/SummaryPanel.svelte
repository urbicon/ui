<script lang="ts">
  import { tick } from 'svelte';
  import { getTableContext, useTableI18n } from '$lib';
  import { isSummaryType, SUMMARY_TYPES } from '$lib/utils/summary-types';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import ToolEmptyNote from './ToolEmptyNote.svelte';
  import { buildSummaryEntries, toolColumnScope, toolEmptyKey } from './tool-columns';

  /**
   * One aggregation choice per summable column.
   *
   * This is the store's actual shape, not a redesign: `addSummaryConfig`
   * replaces by column (`findIndex(c => c.column === config.column)`), so a
   * column carries at most one aggregation. Every column is a radio row,
   * which can only mean what it does — and turning one off is a choice
   * ("none") rather than a hunt for the chip. The wide bar's SummaryMenu
   * phrases the same six states as `menuitemradio` groups per column; this
   * panel was the first surface to show the store honestly, and the menu
   * followed.
   */
  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, addSummaryConfig, removeSummaryConfig } = tableContext;

  // Capability follows configuration, never the column's name — see
  // utils/column-capabilities.ts for what that replaced and why. Columns
  // already carrying a configuration stay listed even once hidden (#253),
  // which is what keeps an aggregation editable after its column leaves the
  // grid.
  //
  // `state.summaryConfigs`, not the effective list: a radio's value is what the
  // column is CONFIGURED to aggregate, and that survives `toggleSummary()`
  // hiding the row — the sheet's own summary badge, which counts what is
  // acting, is the surface that goes quiet there (#252, see HeaderMenu for the
  // full decision).
  const entries = $derived(
    buildSummaryEntries(
      toolColumnScope(tableState),
      tableState.summaryConfigs.map((config) => config.column)
    )
  );

  // This panel had the empty sentence first, on its own `rows.length === 0`.
  // The condition and the key now come from the axis's one policy, which is
  // what puts the same sentence on the wide bar's disabled trigger (#254).
  const emptyKey = $derived(toolEmptyKey('summary', entries));

  const rows = $derived(
    entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      current: tableState.summaryConfigs.find((config) => config.column === entry.id)?.type ?? ''
    }))
  );

  /**
   * The panel body, as a focus target.
   *
   * A fallback row (a hidden column that still carries an aggregation) is the
   * one row here that can disappear *under the control that removed it*:
   * picking its "None" drops the whole `RadioGroup`, the focused radio with
   * it, and focus falls to `<body>` — inside the sheet's modal `<dialog>`,
   * where the next Tab restarts at the top. The other panels never hit this,
   * because their "off" choice is a row of the same group ("No sorting", "No
   * grouping") and survives the change; only summary gives each column a group
   * of its own.
   *
   * Which is why the wrapper below sits OUTSIDE the empty/filled branch:
   * measured, the worst case is the fallback row being the *only* row — every
   * summable column hidden — and there the branch flips as well, so a wrapper
   * inside it unmounted itself along with the group and left nothing to catch
   * focus.
   */
  let panelElement = $state<HTMLDivElement>();

  // The guard instead of a cast: the radio values come from the vocabulary
  // module, but the store must not have to trust that — anything outside the
  // union (including the '' of the "none" row) reads as "no aggregation".
  function handleChange(columnId: string, type: string) {
    if (!isSummaryType(type)) {
      removeSummaryConfig(columnId);
      // Asked of the freshly recomputed list rather than of a flag: a row
      // survives its aggregation being removed exactly when it is part of the
      // offer, which is the same question `buildSummaryEntries` just answered.
      //
      // After `tick`, not before it: the group is still in the DOM at this
      // point, and focusing ahead of the removal only gets reset by it.
      if (!rows.some((row) => row.id === columnId)) {
        void tick().then(() => panelElement?.focus());
      }
      return;
    }
    addSummaryConfig({ column: columnId, type });
  }
</script>

<!-- `tabindex="-1"`: not a tab stop, but a place focus can be PUT when the row
     that had it is gone — see panelElement, including why this element wraps
     the empty state too instead of sitting inside the `{:else}`. -->
<div bind:this={panelElement} tabindex="-1" class="space-y-4">
  {#if emptyKey}
    <ToolEmptyNote reason={emptyKey} />
  {:else}
    {#each rows as row (row.id)}
      <RadioGroup
        value={row.current}
        onValueChange={(type: string) => handleChange(row.id, type)}
        label={row.label}
        orientation="horizontal"
        size="sm"
      >
        <RadioItem value="" label={tt('summary.none')} />
        {#each SUMMARY_TYPES as type (type.value)}
          <RadioItem value={type.value} label={tt(type.labelKey)} />
        {/each}
      </RadioGroup>
    {/each}
  {/if}
</div>
