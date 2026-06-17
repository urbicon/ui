<script lang="ts">
  import { untrack } from 'svelte';
  import { getTableContext, useTableI18n } from '$lib';
  import { Input, Toolbar, resolveIcon, SearchIcon as SearchIconDefault } from '@urbicon-ui/blocks';

  const SearchIcon = resolveIcon('search', SearchIconDefault);
  import { smartFilterBarVariants, type SmartFilterBarVariantProps } from '$lib/variants';
  import ChipsField from './ChipsField.svelte';
  import ColumnVisibilityMenu from './ColumnVisibilityMenu.svelte';
  import FilterMenu from './FilterMenu.svelte';
  import GroupingMenu from './GroupingMenu.svelte';
  import SummaryMenu from './SummaryMenu.svelte';
  import { getTableStyleConfig, resolveSlotClass } from '$lib/core/table-style-context';

  const tt = useTableI18n();

  // Store-Kontext abrufen
  const tableContext = getTableContext();
  const { state: tableState, setSearchTerm } = tableContext;
  const styleConfig = getTableStyleConfig();

  // Props
  let {
    placeholder = tt('search.placeholder'),
    debounceMs = 300,
    size = 'md' as SmartFilterBarVariantProps['size'],
    layout = 'responsive' as SmartFilterBarVariantProps['layout'],
    responsive = false,
    class: className = ''
  } = $props();

  // Local state — decouples UI input from the store so debouncing is not bypassed
  let localSearch = $state(tableState.searchTerm);
  let debounceTimer = $state<number | null>(null);

  // Sync store → local (e.g. when the store is changed programmatically)
  $effect(() => {
    const storeValue = tableState.searchTerm;
    if (storeValue !== untrack(() => localSearch)) {
      localSearch = storeValue;
    }
  });

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    localSearch = target.value;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setSearchTerm(localSearch);
    }, debounceMs) as unknown as number;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && localSearch) {
      localSearch = '';
      if (debounceTimer) clearTimeout(debounceTimer);
      setSearchTerm('');
    }
  }

  // Tailwind-Variants Styling
  const filterBarStyles = $derived(
    smartFilterBarVariants({
      size,
      layout,
      elevated: responsive,
      appearance: styleConfig.appearance
    })
  );
</script>

<div
  class={resolveSlotClass(
    filterBarStyles.container(),
    styleConfig.slotClasses.filterBar,
    styleConfig.unstyled,
    className
  )}
>
  <Toolbar aria-label={tt('aria.filterBar')} variant="ghost" gap="xs" padding="xs" class="w-full">
    <div class={filterBarStyles.searchSection()}>
      {#snippet searchIcon()}
        <SearchIcon class="h-4 w-4" />
      {/snippet}
      <Input
        type="search"
        {placeholder}
        value={localSearch}
        oninput={handleSearchInput}
        onkeydown={handleKeydown}
        leftIcon={searchIcon}
        class="w-full"
        aria-label={tt('aria.searchData')}
      />
    </div>

    <div class="{filterBarStyles.actionsSection()} ml-auto gap-1">
      <FilterMenu />
      <GroupingMenu />
      <SummaryMenu />
      <ColumnVisibilityMenu />
    </div>
  </Toolbar>

  <div class={filterBarStyles.chipsSection()}>
    <ChipsField />
  </div>
</div>
