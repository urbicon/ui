<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Button,
    Select,
    Tooltip,
    resolveIcon,
    LayersIcon as LayersIconDefault
  } from '@urbicon-ui/blocks';

  const tt = useTableI18n();

  const LayersIcon = resolveIcon('layers', LayersIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, setGroupByKey } = tableContext;

  const currentValue = $derived(tableState.groupByKey || '');
  const isActive = $derived(!!currentValue);

  // The check glyph that used to sit next to the icon is gone: it was a third
  // way of saying "on" in a bar that also had counters and nothing at all.
  // Grouping is single-level in the store, so there is no count to show either —
  // the group-tinted ground says it, in the same teal as the chip below the bar.
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'group' }) : undefined
  );

  const groupableColumns = $derived.by(() => {
    return tableState.columns.filter((col) => {
      // Synthetic columns have no accessor and structurally lack the
      // derivable flags — exclude before reading them.
      if (col.accessor === undefined) return false;
      if (col.groupable !== undefined) return col.groupable === true;
      const id = resolveColumnId(col);
      return col.sortable === true && id !== 'actions' && !id.includes('action');
    });
  });

  const groupingOptions = $derived.by(() => {
    const options = [{ label: tt('grouping.none'), value: '' }];

    groupableColumns.forEach((column) => {
      options.push({
        label: resolveColumnLabel(column),
        value: resolveColumnId(column)
      });
    });

    return options;
  });

  let menuOpen = $state(false);

  function handleValueChange(value: string) {
    setGroupByKey(value === '' ? null : value);
  }
</script>

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <Tooltip label={tt('grouping.button')}>
    <Button
      variant="ghost"
      intent="neutral"
      size="sm"
      active={isActive}
      class={triggerClass}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <LayersIcon class="h-4 w-4" />
    </Button>
  </Tooltip>
{/snippet}

<!-- `w-auto`: see SortMenu — the Select wrapper defaults to `w-full`. -->
<Select
  options={groupingOptions}
  value={currentValue}
  bind:open={menuOpen}
  onValueChange={(v: string | null) => handleValueChange(v ?? '')}
  size="sm"
  syncWidth={false}
  class="w-auto"
  {customTrigger}
/>
