<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import type { FilterOperator } from '$lib/types/tableTypes';
  import { resolveColumnId, resolveColumnLabel, resolveValueById } from '$lib/utils';
  import { filterMenuVariants } from '$lib/variants';
  import {
    Badge,
    Button,
    Select,
    Input,
    Popover,
    Tooltip,
    useBlocksI18n,
    resolveIcon,
    CheckIcon as CheckIconDefault,
    FunnelIcon as FunnelIconDefault,
    CloseIcon as CloseIconDefault
  } from '@urbicon-ui/blocks';

  const tt = useTableI18n();
  const bt = useBlocksI18n();

  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const FunnelIcon = resolveIcon('funnel', FunnelIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  // Get table context
  const tableContext = getTableContext();
  const {
    state: tableState,
    addFilter,
    removeFiltersByColumn,
    clearAllFilters,
    hasFilterForColumn
  } = tableContext;

  // Internal state
  let isOpen = $state(false);
  let triggerButtonRef = $state<HTMLButtonElement | undefined>();

  // Reactive data
  const OPERATORS_BY_TYPE = {
    number: [
      { value: 'equals' as const, label: () => tt('filter.operators.equals') },
      { value: 'greaterThan' as const, label: () => tt('filter.operators.greaterThan') },
      { value: 'lessThan' as const, label: () => tt('filter.operators.lessThan') }
    ],
    date: [
      { value: 'equals' as const, label: () => tt('filter.operators.onDate') },
      { value: 'greaterThan' as const, label: () => tt('filter.operators.after') },
      { value: 'lessThan' as const, label: () => tt('filter.operators.before') }
    ],
    text: [
      { value: 'contains' as const, label: () => tt('filter.operators.contains') },
      { value: 'equals' as const, label: () => tt('filter.operators.equals') },
      { value: 'startsWith' as const, label: () => tt('filter.operators.startsWith') },
      { value: 'endsWith' as const, label: () => tt('filter.operators.endsWith') }
    ]
  } as const;

  const getOperatorsForType = (dataType: string) => {
    const operators =
      OPERATORS_BY_TYPE[dataType as keyof typeof OPERATORS_BY_TYPE] || OPERATORS_BY_TYPE.text;
    return operators.map((op) => ({ value: op.value, label: op.label() }));
  };

  const activeFilters = $derived(tableState.activeFilters);
  const filterOptions = $derived.by(() => {
    return tableState.columns
      .filter((col) => col.accessor !== undefined && col.searchable !== false)
      .map((col) => {
        const dataType = 'dataType' in col ? col.dataType || 'text' : 'text';
        return {
          key: resolveColumnId(col),
          label: resolveColumnLabel(col),
          dataType,
          operators: getOperatorsForType(dataType)
        };
      });
  });

  let filterStates = $state<
    Record<
      string,
      {
        selectedOperator: FilterOperator;
        inputValue: string;
        quickValueSearch: string;
        showQuickValues: boolean;
      }
    >
  >({});

  $effect.pre(() => {
    filterOptions.forEach((option) => {
      if (!filterStates[option.key]) {
        filterStates[option.key] = {
          selectedOperator: 'contains',
          inputValue: '',
          quickValueSearch: '',
          showQuickValues: false
        };
      }
    });
  });

  function getUniqueValues(columnKey: string): string[] {
    // Local dedup accumulator — not reactive state.
    const values = new Set<string>();
    for (const item of tableState.items) {
      const value = resolveValueById(tableState.columns, item, columnKey);
      if (value !== undefined && value !== null && value !== '') {
        values.add(String(value));
      }
    }
    return Array.from(values).sort();
  }

  // Simple function to get active filters for a column
  function getActiveFiltersForColumn(columnKey: string) {
    return activeFilters.filter((filter) => filter.column === columnKey);
  }

  // Event handlers
  function handleApplyFilter(optionKey: string, value?: string, shouldClose = false) {
    const state = filterStates[optionKey];
    if (!state) return;

    const filterValue = value || state.inputValue;

    // Add new filter if value is not empty
    if (filterValue.trim()) {
      addFilter({
        column: optionKey,
        operator: state.selectedOperator,
        value: filterValue.trim()
      });

      // Clear input after applying
      state.inputValue = '';
    }

    if (shouldClose) {
      isOpen = false;
    }
  }

  function handleApplyAllFilters() {
    // Apply all non-empty manual filter inputs
    filterOptions.forEach((option) => {
      const state = filterStates[option.key];
      if (state?.inputValue.trim()) {
        handleApplyFilter(option.key);
      }
    });
    isOpen = false;
  }

  function handleCancel() {
    isOpen = false;
  }

  function toggleQuickFilter(optionKey: string, value: string) {
    const isActive = hasFilterForColumn(optionKey, 'contains', value);
    if (isActive) {
      removeFiltersByColumn(optionKey, 'contains', value);
    } else {
      handleApplyFilter(optionKey, value);
    }
  }

  const handleRemoveSpecificFilter = (column: string, operator: FilterOperator, value: string) => {
    removeFiltersByColumn(column, operator, value);
  };

  const menuStyles = $derived(
    filterMenuVariants({
      size: 'md'
    })
  );
</script>

{#snippet triggerContent()}
  <Tooltip label={tt('filter.button.add')}>
    <Button
      variant="ghost"
      intent="neutral"
      size="sm"
      active={activeFilters.length > 0}
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      <FunnelIcon class="h-4 w-4" />
      {#if activeFilters.length > 0}
        <Badge variant="filled" size="xs" counter class="bg-filter text-text-on-primary ml-1">
          {activeFilters.length}
        </Badge>
      {/if}
    </Button>
  </Tooltip>
{/snippet}

<Popover
  bind:open={isOpen}
  bind:triggerElement={triggerButtonRef}
  placement="bottom-start"
  offsetDistance={8}
  onClickOutside={() => (isOpen = false)}
  trigger={triggerContent}
  role="dialog"
  class={menuStyles.base()}
  style="max-height: calc(100vh - 100px); overflow-y: auto;"
>
  <!-- Header with tailwind-variants - ALLE Styles bleiben! -->
  <div class={menuStyles.header()}>
    <h3 class={menuStyles.title()}>
      {tt('filter.menu.addFilter')}
    </h3>
    <div class="flex items-center gap-2">
      {#if activeFilters.length > 0}
        <Button
          variant="ghost"
          size="xs"
          intent="danger"
          onclick={() => {
            clearAllFilters();
            isOpen = false;
          }}
        >
          {tt('filter.button.clearAll')}
        </Button>
      {/if}
      <Button
        variant="ghost"
        size="xs"
        onclick={() => (isOpen = false)}
        aria-label={tt('button.close')}
      >
        <CloseIcon class="h-4 w-4" />
      </Button>
    </div>
  </div>

  <div class="space-y-4">
    {#each filterOptions as option (option.key)}
      {@const state = filterStates[option.key]}
      {@const uniqueValues = getUniqueValues(option.key)}

      <div class={menuStyles.section()}>
        <!-- Section Header -->
        <div class="flex items-center justify-between">
          <h4 class={menuStyles.sectionTitle()}>
            {option.label}
          </h4>
        </div>

        {#if state}
          {@const columnFilters = getActiveFiltersForColumn(option.key)}

          <div class="space-y-2">
            <!-- Show existing filters for this column -->
            {#if columnFilters.length > 0}
              <div class="space-y-1">
                {#each columnFilters as filter, i (`${filter.operator}:${filter.value}:${i}`)}
                  <div class={menuStyles.activeFilter()}>
                    <span class="text-text-primary flex-1 truncate text-sm">
                      {tt(`filter.operators.${filter.operator}`)}: {filter.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="xs"
                      intent="danger"
                      onclick={() =>
                        handleRemoveSpecificFilter(filter.column, filter.operator, filter.value)}
                      class="ml-2 flex-shrink-0"
                      aria-label={tt('filter.button.remove')}
                    >
                      <CloseIcon class="h-3 w-3" />
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Operator Select and Input in one row -->
            <div class={menuStyles.filterRow()}>
              <div class={menuStyles.operatorSelect()}>
                <Select
                  options={option.operators}
                  bind:value={state.selectedOperator}
                  usePortal={false}
                  size="sm"
                  variant="outlined"
                  class="w-full"
                />
              </div>

              <div class={menuStyles.valueInput()}>
                <Input
                  type={option.dataType === 'date' ? 'date' : 'text'}
                  placeholder={tt('filter.input.enterValue')}
                  bind:value={state.inputValue}
                  size="sm"
                  variant="outlined"
                  class="w-full"
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyFilter(option.key);
                    }
                  }}
                  clearable={true}
                  onClear={() => (state.inputValue = '')}
                />
              </div>
            </div>

            <!-- Quick Values with TV styling -->
            {#if option.dataType === 'text' && uniqueValues.length > 0}
              <div class="space-y-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onclick={() => (state.showQuickValues = !state.showQuickValues)}
                >
                  {tt('filter.quickValues.title')} ({uniqueValues.length})
                </Button>

                {#if state.showQuickValues}
                  <div class={menuStyles.quickValues()}>
                    {#each uniqueValues.slice(0, 20) as value (value)}
                      {@const isActive = hasFilterForColumn(option.key, 'contains', value)}
                      <Button
                        variant={isActive ? 'filled' : 'outlined'}
                        size="xs"
                        intent={isActive ? 'primary' : 'neutral'}
                        onclick={() => toggleQuickFilter(option.key, value)}
                        class="min-w-0 justify-start truncate text-left"
                        title={value}
                      >
                        {#if isActive}
                          <CheckIcon class="mr-1 h-3 w-3 flex-shrink-0" />
                        {/if}
                        <span class="truncate">{value}</span>
                      </Button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Footer with TV styling -->
  <div class={menuStyles.footer()}>
    <Button variant="outlined" size="sm" intent="neutral" onclick={handleCancel}>
      {bt('button.cancel')}
    </Button>
    <Button variant="filled" size="sm" intent="primary" onclick={handleApplyAllFilters}>
      {bt('button.apply')}
    </Button>
  </div>
</Popover>
