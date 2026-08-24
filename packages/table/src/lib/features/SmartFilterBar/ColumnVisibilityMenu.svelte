<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import { Badge, Select, resolveIcon, EyeIcon as EyeIconDefault } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';
  import { buildColumnVisibilityEntries, toolEmptyKey } from './tool-columns';

  /**
   * The wide bar's column-visibility tool. The narrow bar uses
   * ColumnVisibilityPanel, which toggles each column directly instead of
   * diffing a selection array.
   */
  const tt = useTableI18n();

  const EyeIcon = resolveIcon('eye', EyeIconDefault);

  const tableContext = getInternalTableContext();
  const { toggleColumnVisibility } = tableContext;

  let menuOpen = $state(false);

  const hiddenCount = $derived(tableContext.hiddenColumnKeys.size);

  // Hiding columns leaves no artefact in the grid to borrow a hue from, so this
  // one keeps `primary` — the colour its own counter already spoke in.
  const triggerClass = $derived(
    hiddenCount > 0 ? smartFilterBarTriggerVariants({ intent: 'primary' }) : undefined
  );

  // Columns pinned with `hideable: false` never reach this list — see
  // tool-columns.ts for why that matters to a multi-select in particular.
  const entries = $derived(buildColumnVisibilityEntries(tableContext.state.allColumns));

  // A table whose every column is pinned is a legal declaration, and this
  // trigger used to answer it by opening a listbox with zero options — the
  // panel next door had carried the sentence for exactly that case since it was
  // written. Now both ask the same function (#254).
  const emptyKey = $derived(toolEmptyKey('columns', entries));

  const columnItems = $derived(entries.map((entry) => ({ label: entry.label, value: entry.id })));

  const visibleValues = $derived(
    entries.filter((entry) => !tableContext.hiddenColumnKeys.has(entry.id)).map((entry) => entry.id)
  );

  function handleValueChange(values: string | string[] | null) {
    if (!Array.isArray(values)) return;
    const newVisible = new Set(values);
    for (const entry of entries) {
      const isCurrentlyHidden = tableContext.hiddenColumnKeys.has(entry.id);
      const shouldBeVisible = newVisible.has(entry.id);
      if (isCurrentlyHidden && shouldBeVisible) {
        toggleColumnVisibility(entry.id);
      } else if (!isCurrentlyHidden && !shouldBeVisible) {
        toggleColumnVisibility(entry.id);
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
    active={hiddenCount > 0}
    {triggerClass}
    expanded={menuOpen}
    unavailable={emptyKey ? tt(emptyKey) : undefined}
    icon={triggerIcon}
    counter={triggerCounter}
    onclick={() => (menuOpen = !menuOpen)}
  />
{/snippet}

<!-- `w-auto`: see SortMenu — the Select wrapper defaults to `w-full`. -->
<Select
  options={columnItems}
  multiple
  value={visibleValues}
  bind:open={menuOpen}
  onValueChange={handleValueChange}
  disabled={emptyKey !== null}
  size="sm"
  syncWidth={false}
  selectionIndicator="checkmark"
  class="w-auto"
  {customTrigger}
/>
