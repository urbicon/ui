<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import ToolEmptyNote from './ToolEmptyNote.svelte';
  import { buildGroupingEntries, toolColumnScope, toolEmptyKey } from './tool-columns';

  /**
   * Grouping as a radio list. The store holds a single group key, so this is a
   * one-of-many choice and says so — the wide bar's Select models the same thing
   * behind a dropdown.
   */
  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, setGroupBy } = tableContext;

  const entries = $derived(
    buildGroupingEntries(
      toolColumnScope(tableState),
      tableState.declaredGroupByKey,
      tableState.effectiveGroupBy
    )
  );
  // Same answer as the wide bar's trigger (#254). Without an entry the list
  // below is one row reading "No grouping" — a control whose whole content
  // says the tool is off, which is not an offer.
  const emptyKey = $derived(toolEmptyKey('grouping', entries));
  const currentValue = $derived(tableState.effectiveGroupBy || '');

  function handleChange(value: string) {
    setGroupBy(value === '' ? null : value);
  }
</script>

{#if emptyKey}
  <ToolEmptyNote reason={emptyKey} />
{:else}
  <!-- "Column" rather than "Grouping" — see SortPanel: the section heading names
       the tool, this names what the list picks. -->
  <RadioGroup
    value={currentValue}
    onValueChange={handleChange}
    label={tt('tools.column')}
    size="sm"
  >
    <RadioItem value="" label={tt('grouping.none')} />
    {#each entries as entry (entry.id)}
      <RadioItem value={entry.id} label={entry.label} />
    {/each}
  </RadioGroup>
{/if}
