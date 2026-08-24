<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { Checkbox } from '@urbicon-ui/blocks';
  import { buildColumnVisibilityEntries } from './tool-columns';

  /**
   * One checkbox per hideable column — checked means visible.
   *
   * A multi-select would have to model "which columns are visible" as a value
   * array and diff it on every change, which is exactly where the pinned
   * (`hideable: false`) columns went missing before: absent from the array reads
   * as deselected. A per-row toggle has no array to fall out of.
   */
  const tt = useTableI18n();

  const tableContext = getInternalTableContext();
  const { toggleColumnVisibility } = tableContext;

  const entries = $derived(buildColumnVisibilityEntries(tableContext.state.allColumns));
</script>

{#if entries.length === 0}
  <p class="text-text-secondary text-sm">{tt('columns.empty')}</p>
{:else}
  <!--
    No `fieldset`/`legend`. The accordion trigger already names this group
    (Collapsible marks its content `role="region"` + `aria-labelledby` the
    trigger), so a legend repeated the section heading one line below itself —
    visible in the sheet and doubled for a screen reader.
  -->
  <div class="flex flex-col gap-2">
    {#each entries as entry (entry.id)}
      <Checkbox
        checked={!tableContext.hiddenColumnKeys.has(entry.id)}
        onCheckedChange={() => toggleColumnVisibility(entry.id)}
        label={entry.label}
      />
    {/each}
  </div>
{/if}
