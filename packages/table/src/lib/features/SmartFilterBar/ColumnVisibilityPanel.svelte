<script lang="ts">
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { Checkbox } from '@urbicon-ui/blocks';
  import ToolEmptyNote from './ToolEmptyNote.svelte';
  import { buildColumnVisibilityEntries, toolEmptyKey } from './tool-columns';

  /**
   * One checkbox per hideable column — checked means visible.
   *
   * A multi-select would have to model "which columns are visible" as a value
   * array and diff it on every change, which is exactly where the pinned
   * (`hideable: false`) columns went missing before: absent from the array reads
   * as deselected. A per-row toggle has no array to fall out of.
   *
   * No `useTableI18n` here: every string this panel renders is either a column
   * label or the empty-state sentence, and that one is ToolEmptyNote's to
   * translate — one place turns a policy key into words.
   */
  const tableContext = getInternalTableContext();
  const { toggleColumnVisibility } = tableContext;

  // Hidden keys second: a pinned column hidden by a programmatic
  // `hideColumn()` keeps a row here, unchecked — the way back on screen.
  const entries = $derived(
    buildColumnVisibilityEntries(tableContext.state.allColumns, tableContext.hiddenColumnKeys)
  );
  // The sentence this panel had first, now picked by the axis's one policy —
  // which is how the wide bar's eye stopped opening an option-less listbox for
  // the very case this branch was written for (#254).
  const emptyKey = $derived(toolEmptyKey('columns', entries));
</script>

{#if emptyKey}
  <ToolEmptyNote reason={emptyKey} />
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
