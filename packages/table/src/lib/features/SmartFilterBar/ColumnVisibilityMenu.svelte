<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import { Badge, Select, resolveIcon, EyeIcon as EyeIconDefault } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';

  /** Full-width labelled row instead of a tooltipped icon — see MenuTrigger. */
  let { stacked = false }: { stacked?: boolean } = $props();

  const tt = useTableI18n();

  const EyeIcon = resolveIcon('eye', EyeIconDefault);

  const tableContext = getTableContext();
  const { toggleColumnVisibility } = tableContext;

  let menuOpen = $state(false);

  const hiddenCount = $derived(tableContext.hiddenColumnKeys.size);

  // Hiding columns leaves no artefact in the grid to borrow a hue from, so this
  // one keeps `primary` — the colour its own counter already spoke in.
  const triggerClass = $derived(
    hiddenCount > 0 ? smartFilterBarTriggerVariants({ intent: 'primary' }) : undefined
  );

  // Columns pinned with `hideable: false` are excluded from the toggle list so
  // they can never be hidden — and so they are not silently hidden the first
  // time the selection changes (they would otherwise count as "deselected").
  const hideableColumns = $derived(tableContext.allColumns.filter((col) => col.hideable !== false));

  const columnItems = $derived.by(() =>
    hideableColumns.map((col) => ({
      label: resolveColumnLabel(col),
      value: resolveColumnId(col)
    }))
  );

  const visibleValues = $derived.by(() =>
    hideableColumns
      .filter((col) => !tableContext.hiddenColumnKeys.has(resolveColumnId(col)))
      .map((col) => resolveColumnId(col))
  );

  function handleValueChange(values: string | string[] | null) {
    if (!Array.isArray(values)) return;
    const newVisible = new Set(values);
    for (const col of hideableColumns) {
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

{#snippet triggerIcon()}
  <EyeIcon class="h-4 w-4" />
{/snippet}

{#snippet triggerCounter()}
  {#if hiddenCount > 0}
    <!-- Same shape as the filter and summary counters: a `soft` chip on the
         neutral surface, its number in the trigger's own hue. `filled` would
         have been the only solid swatch in the bar, and it sat on the lit
         ground with `text-on-primary` — the pairing measured under AA. -->
    <Badge variant="soft" size="xs" counter class="bg-surface-base text-primary-emphasis ml-1">
      {hiddenCount}
    </Badge>
  {/if}
{/snippet}

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <MenuTrigger
    label={tt('columns.visibility')}
    {stacked}
    active={hiddenCount > 0}
    {triggerClass}
    expanded={menuOpen}
    icon={triggerIcon}
    counter={triggerCounter}
    onclick={() => (menuOpen = !menuOpen)}
  />
{/snippet}

<!-- `w-auto`: see SortMenu — the Select wrapper defaults to `w-full`. -->
<!--
  `usePortal={!stacked}`: stacked means this Select lives inside the tool
  popover, and Popover's own contract (see Popover.svelte) puts a nested panel on
  `position: absolute` instead of promoting a second top layer — that is where
  the focus and z-index quirks live. FilterMenu's operator Select already does it.
-->
<Select
  options={columnItems}
  multiple
  value={visibleValues}
  bind:open={menuOpen}
  onValueChange={handleValueChange}
  size="sm"
  syncWidth={false}
  usePortal={!stacked}
  selectionIndicator="checkmark"
  class="w-auto"
  {customTrigger}
/>
