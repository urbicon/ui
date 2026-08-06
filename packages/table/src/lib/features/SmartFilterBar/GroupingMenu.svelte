<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import { Select, resolveIcon, LayersIcon as LayersIconDefault } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';
  import { buildGroupingEntries } from './tool-columns';

  /**
   * The wide bar's grouping tool. Which columns it may offer — including the
   * declared and active keys that are not columns at all — is decided in
   * `tool-columns.ts`, because GroupingPanel has to offer exactly the same set.
   */
  const tt = useTableI18n();

  const LayersIcon = resolveIcon('layers', LayersIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, view: tableView, setGroupBy } = tableContext;

  const currentValue = $derived(tableState.effectiveGroupBy || '');
  const isActive = $derived(!!currentValue);

  // The check glyph that used to sit next to the icon is gone: it was a third
  // way of saying "on" in a bar that also had counters and nothing at all.
  // Grouping is single-level in the store, so there is no count to show either —
  // the group-tinted ground says it, in the same teal as the chip below the bar.
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'group' }) : undefined
  );

  const groupingOptions = $derived.by(() => [
    { label: tt('grouping.none'), value: '' },
    ...buildGroupingEntries(
      tableState.columns,
      tableState.declaredGroupByKey,
      tableState.effectiveGroupBy
    ).map((entry) => ({ label: entry.label, value: entry.id }))
  ]);

  let menuOpen = $state(false);

  function handleValueChange(value: string) {
    setGroupBy(value === '' ? null : value);
  }
</script>

{#snippet triggerIcon()}
  <LayersIcon class="h-4 w-4" />
{/snippet}

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <MenuTrigger
    label={tt('grouping.button')}
    active={isActive}
    {triggerClass}
    expanded={menuOpen}
    icon={triggerIcon}
    onclick={() => (menuOpen = !menuOpen)}
  />
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
