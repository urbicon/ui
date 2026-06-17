<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import {
    Badge,
    Button,
    Select,
    Tooltip,
    resolveIcon,
    EyeIcon as EyeIconDefault
  } from '@urbicon-ui/blocks';

  const tt = useTableI18n();

  const EyeIcon = resolveIcon('eye', EyeIconDefault);

  const tableContext = getTableContext();
  const { toggleColumnVisibility } = tableContext;

  let menuOpen = $state(false);

  const hiddenCount = $derived(tableContext.hiddenColumnKeys.size);

  const columnItems = $derived.by(() =>
    tableContext.allColumns.map((col) => ({
      label: resolveColumnLabel(col),
      value: resolveColumnId(col)
    }))
  );

  const visibleValues = $derived.by(() =>
    tableContext.allColumns
      .filter((col) => !tableContext.hiddenColumnKeys.has(resolveColumnId(col)))
      .map((col) => resolveColumnId(col))
  );

  function handleValueChange(values: string | string[] | null) {
    if (!Array.isArray(values)) return;
    const newVisible = new Set(values);
    for (const col of tableContext.allColumns) {
      const id = resolveColumnId(col);
      const isCurrentlyHidden = tableContext.hiddenColumnKeys.has(id);
      const shouldBeVisible = newVisible.has(id);
      if (isCurrentlyHidden && shouldBeVisible) {
        toggleColumnVisibility(id);
      } else if (!isCurrentlyHidden && !shouldBeVisible) {
        toggleColumnVisibility(id);
      }
    }
  }
</script>

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <Tooltip label={tt('columns.visibility')}>
    <Button
      variant="ghost"
      intent="neutral"
      size="sm"
      active={hiddenCount > 0}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <EyeIcon class="h-4 w-4" />
      {#if hiddenCount > 0}
        <Badge variant="filled" intent="primary" size="xs" counter class="ml-1">
          {hiddenCount}
        </Badge>
      {/if}
    </Button>
  </Tooltip>
{/snippet}

<Select
  options={columnItems}
  multiple
  value={visibleValues}
  bind:open={menuOpen}
  onValueChange={handleValueChange}
  size="sm"
  syncWidth={false}
  selectionIndicator="checkmark"
  {customTrigger}
/>
