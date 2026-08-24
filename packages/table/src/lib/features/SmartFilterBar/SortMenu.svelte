<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Select,
    resolveIcon,
    ArrowUpDownIcon as ArrowUpDownIconDefault
  } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';
  import { buildSortEntries, toolColumnScope, toolEmptyKey } from './tool-columns';

  /**
   * The wide bar's sort tool. Sorting is otherwise only reachable by clicking a
   * column header; the narrow bar reaches it through SortPanel instead, which
   * splits the same choice into column and direction (see there for why).
   */
  const tt = useTableI18n();

  const ArrowUpDownIcon = resolveIcon('arrowUpDown', ArrowUpDownIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, view: tableView, setSort } = tableContext;

  // The active column is passed in so it keeps a row after being hidden — see
  // buildSortEntries; without it this Select held a value it could not display.
  const entries = $derived(buildSortEntries(toolColumnScope(tableState), tableView.sort?.column));

  // Asked, not re-derived: the trigger used to go `disabled` on an inline
  // `entries.length === 0` and say nothing about it, while SortPanel one
  // breakpoint away rendered its controls regardless (#254).
  const emptyKey = $derived(toolEmptyKey('sort', entries));

  const isActive = $derived(tableView.sort !== null);

  // No counter beside the icon: the store holds ONE sort column, so any number
  // rendered here would forever read "1". The lit ground is the whole signal —
  // `primary`, the tint the sorted column header carries in the grid itself.
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'primary' }) : undefined
  );

  // Encode the active sort as `${columnId}:${direction}` so the column and the
  // direction can travel through the single-value Select; '' means unsorted.
  const currentValue = $derived(
    tableView.sort ? `${tableView.sort.column}:${tableView.sort.direction}` : ''
  );

  const sortOptions = $derived.by(() => {
    const options: { label: string; value: string }[] = [{ label: tt('sort.none'), value: '' }];
    for (const entry of entries) {
      options.push({ label: `${entry.label} · ${tt('sort.ascending')}`, value: `${entry.id}:asc` });
      options.push({
        label: `${entry.label} · ${tt('sort.descending')}`,
        value: `${entry.id}:desc`
      });
    }
    return options;
  });

  let menuOpen = $state(false);

  // Split on the LAST `:`, because only the direction half is ours: the
  // column id is the consumer's and may itself contain `:` (GraphQL aliases,
  // namespaced fields). A `split(':')` here severed such an id, the severed
  // direction failed the union check below, and every sort pick on that
  // column was a silent no-op (#251). The direction stays checked against
  // the closed 'asc' | 'desc' — that half is the part this menu encoded.
  function handleValueChange(value: string) {
    if (!value) {
      setSort(null);
      return;
    }
    const splitAt = value.lastIndexOf(':');
    if (splitAt <= 0) return;
    const columnId = value.slice(0, splitAt);
    const direction = value.slice(splitAt + 1);
    if (direction === 'asc' || direction === 'desc') {
      setSort({ column: columnId, direction });
    }
  }
</script>

{#snippet triggerIcon()}
  <ArrowUpDownIcon class="h-4 w-4" />
{/snippet}

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <MenuTrigger
    label={tt('sort.button')}
    active={isActive}
    {triggerClass}
    expanded={menuOpen}
    unavailable={emptyKey ? tt(emptyKey) : undefined}
    icon={triggerIcon}
    onclick={() => (menuOpen = !menuOpen)}
  />
{/snippet}

<!--
  `w-auto` on the Select wrapper: its default `w-full` makes the wrapper a
  stretching flex item in the toolbar row, which padded every menu trigger with
  dead space and left the icons unevenly spaced.

  `disabled` is the ARROW-KEY half of the empty-tool refusal, not a spare belt:
  `Select.handleTriggerKeydown` sits on the wrapper around the custom trigger and
  opens the listbox on ArrowDown/ArrowUp, where this flag is the only thing it
  early-returns on. MenuTrigger swallows the click and Enter/Space and stops
  there on purpose; without this, an empty tool still opened from the keyboard.
-->
<Select
  options={sortOptions}
  value={currentValue}
  bind:open={menuOpen}
  onValueChange={(v: string | null) => handleValueChange(v ?? '')}
  disabled={emptyKey !== null}
  size="sm"
  syncWidth={false}
  class="w-auto"
  {customTrigger}
/>
