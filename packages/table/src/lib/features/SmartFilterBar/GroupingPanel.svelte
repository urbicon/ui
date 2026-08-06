<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import { buildGroupingEntries } from './tool-columns';

  /**
   * Grouping as a radio list. The store holds a single group key, so this is a
   * one-of-many choice and says so — the wide bar's Select models the same thing
   * behind a dropdown.
   */
  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, view: tableView, setGroupBy } = tableContext;

  const entries = $derived(
    buildGroupingEntries(
      tableState.columns,
      tableState.declaredGroupByKey,
      tableState.effectiveGroupBy
    )
  );
  const currentValue = $derived(tableState.effectiveGroupBy || '');

  function handleChange(value: string) {
    setGroupBy(value === '' ? null : value);
  }
</script>

<!-- "Column" rather than "Grouping" — see SortPanel: the section heading names
     the tool, this names what the list picks. -->
<RadioGroup value={currentValue} onValueChange={handleChange} label={tt('tools.column')} size="sm">
  <RadioItem value="" label={tt('grouping.none')} />
  {#each entries as entry (entry.id)}
    <RadioItem value={entry.id} label={entry.label} />
  {/each}
</RadioGroup>
