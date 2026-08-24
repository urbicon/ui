<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { RadioGroup, RadioItem, SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
  import { toolsSheetVariants } from '$lib/variants';
  import ToolEmptyNote from './ToolEmptyNote.svelte';
  import { buildSortEntries, toolColumnScope, toolEmptyKey } from './tool-columns';

  /**
   * Sorting as two plain controls instead of one option list.
   *
   * The wide bar's SortMenu folds column and direction into a single Select
   * whose options are the cartesian product — 35 columns produce 71 rows. That
   * is tolerable in a dropdown you skim with a mouse and hostile in a sheet you
   * thumb through, so here they are what they actually are: one choice of
   * column, one choice of direction. Also the reason the direction control stays
   * mounted while nothing is sorted (disabled, not hidden): a control that
   * appears and disappears under the thumb costs more than a dimmed one.
   */
  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, view: tableView, setSort } = tableContext;

  const sheetStyles = toolsSheetVariants();

  // Same list as the wide bar's Select, active column included: a radio group
  // whose value has no item shows NOTHING checked — not even "No sorting" —
  // which is what hiding the sorted column used to do here.
  const entries = $derived(buildSortEntries(toolColumnScope(tableState), tableView.sort?.column));
  // …and the same empty-state answer as the wide bar's trigger. This section
  // used to render its two controls whatever the column set said, so a table
  // nothing can sort got a radio list holding only "No sorting" and a direction
  // control disabled beside it, while the bar disabled the tool outright (#254).
  const emptyKey = $derived(toolEmptyKey('sort', entries));
  const currentColumn = $derived(tableView.sort?.column ?? '');
  const currentDirection = $derived(tableView.sort?.direction ?? 'asc');

  function handleColumnChange(columnId: string) {
    if (!columnId) {
      setSort(null);
      return;
    }
    setSort({ column: columnId, direction: currentDirection });
  }

  function handleDirectionChange(direction: string) {
    if (!currentColumn) return;
    if (direction === 'asc' || direction === 'desc') {
      setSort({ column: currentColumn, direction });
    }
  }
</script>

<div class="space-y-4">
  {#if emptyKey}
    <ToolEmptyNote reason={emptyKey} />
  {:else}
    <!--
      "Column", not "Sort": the accordion trigger above already says which tool
      this is, so repeating it here labelled the list with the section's own name.
      This panel has TWO controls, and they need names that tell them apart —
      which column, and in which direction.
    -->
    <RadioGroup
      value={currentColumn}
      onValueChange={handleColumnChange}
      label={tt('tools.column')}
      size="sm"
    >
      <RadioItem value="" label={tt('sort.none')} />
      {#each entries as entry (entry.id)}
        <RadioItem value={entry.id} label={entry.label} />
      {/each}
    </RadioGroup>

    <!--
      `fullWidth` + the built-in overflow collapse: the two labels are long enough
      in German ("Aufsteigend"/"Absteigend") to overrun a phone-width track, and
      SegmentGroup answers that by stacking them vertically with every option still
      visible — no overflow, no menu, no second layer.
    -->
    <SegmentGroup
      value={currentDirection}
      onValueChange={handleDirectionChange}
      disabled={!currentColumn}
      ariaLabel={tt('sort.direction')}
      size="sm"
      fullWidth
      class={sheetStyles.segments()}
    >
      <SegmentItem value="asc">{tt('sort.ascending')}</SegmentItem>
      <SegmentItem value="desc">{tt('sort.descending')}</SegmentItem>
    </SegmentGroup>
  {/if}
</div>
