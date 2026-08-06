<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import type { FilterOperator } from '$lib/types/tableTypes';
  import { resolveColumnId, resolveColumnLabel, resolveValueById } from '$lib/utils';
  import { filterPanelVariants } from '$lib/variants';
  import {
    Button,
    Select,
    Input,
    useBlocksI18n,
    resolveIcon,
    CheckIcon as CheckIconDefault,
    CloseIcon as CloseIconDefault
  } from '@urbicon-ui/blocks';

  /**
   * The filter form: one section per filterable column, plus the actions that
   * belong to the form itself (apply everything typed, clear everything active).
   *
   * Hull-free on purpose. It is the body of the filter popover on a wide bar and
   * a section of the tools sheet on a narrow one, and neither geometry is
   * described here — see `filterPanelVariants` for how it sizes itself.
   */
  let {
    surface = 'popover',
    onApplied = undefined
  }: {
    /**
     * Which hull this instance sits in. It decides one thing: whether the
     * operator `Select` may claim the browser top layer.
     *
     * - `popover` — the hull is the filter popover, itself a non-modal top-layer
     *   panel. A second top-layer panel nested inside it is the focus/z-index
     *   case Popover's own contract steers around, so the Select renders in
     *   place (`usePortal={false}`).
     * - `sheet` — the hull is a modal `<dialog>` (Drawer). `useFloatingPanel`
     *   detects that on its own and renders the Select `position: fixed` inside
     *   the dialog's subtree — which is what lets it escape the sheet body's
     *   `overflow-y: auto` instead of being clipped by it. Forcing
     *   `usePortal={false}` here would put it back inside the scroll box.
     *
     * Explicit rather than sniffed from the DOM: the hull knows what it is, and
     * a wrong guess is a silently clipped dropdown.
     */
    surface?: 'popover' | 'sheet';
    /**
     * Called after "Apply" has committed every non-empty input. The popover uses
     * it to close itself; the sheet passes nothing, because the reader may well
     * want to sort next and closing the whole sheet would take that away.
     */
    onApplied?: () => void;
  } = $props();

  const tt = useTableI18n();
  const bt = useBlocksI18n();

  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  const tableContext = getTableContext();
  const {
    state: tableState,
    view: tableView,
    addFilter,
    removeFiltersByColumn,
    clearAllFilters,
    hasFilterForColumn
  } = tableContext;

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

  const activeFilters = $derived(tableView.filters);
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
          // Seed with the column's own first operator, not a hardcoded
          // `contains`: number and date columns do not offer `contains` at all
          // (see OPERATORS_BY_TYPE), so the bound value sat outside its own
          // option list — pick a date, press Enter without touching the select,
          // and the filter ran as a substring match.
          selectedOperator: option.operators[0]?.value ?? 'contains',
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

  function getActiveFiltersForColumn(columnKey: string) {
    return activeFilters.filter((filter) => filter.column === columnKey);
  }

  function handleApplyFilter(optionKey: string, value?: string) {
    const state = filterStates[optionKey];
    if (!state) return;

    const filterValue = value || state.inputValue;

    if (filterValue.trim()) {
      addFilter({
        column: optionKey,
        operator: state.selectedOperator,
        value: filterValue.trim()
      });

      state.inputValue = '';
    }
  }

  function handleApplyAllFilters() {
    filterOptions.forEach((option) => {
      const state = filterStates[option.key];
      if (state?.inputValue.trim()) {
        handleApplyFilter(option.key);
      }
    });
    onApplied?.();
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

  const styles = filterPanelVariants();
</script>

<div class={styles.root()}>
  {#each filterOptions as option (option.key)}
    {@const state = filterStates[option.key]}
    {@const uniqueValues = getUniqueValues(option.key)}

    <div class={styles.section()}>
      <div class="flex items-center justify-between">
        <h4 class={styles.sectionTitle()}>
          {option.label}
        </h4>
      </div>

      {#if state}
        {@const columnFilters = getActiveFiltersForColumn(option.key)}

        <div class="space-y-2">
          <!-- Filters already running on this column -->
          {#if columnFilters.length > 0}
            <div class="space-y-1">
              {#each columnFilters as filter, i (`${filter.operator}:${filter.value}:${i}`)}
                <div class={styles.activeFilter()}>
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

          <div class={styles.filterRow()}>
            <div class={styles.operatorSelect()}>
              <Select
                options={option.operators}
                bind:value={state.selectedOperator}
                usePortal={surface === 'sheet'}
                size="sm"
                variant="outlined"
                class="w-full"
                aria-label={tt('filter.aria.operatorFor', { column: option.label })}
              />
            </div>

            <div class={styles.valueInput()}>
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
                aria-label={tt('filter.aria.valueFor', { column: option.label })}
              />
            </div>
          </div>

          {#if option.dataType === 'text' && uniqueValues.length > 0}
            <div class="space-y-2">
              <Button
                variant="ghost"
                size="xs"
                onclick={() => (state.showQuickValues = !state.showQuickValues)}
                aria-expanded={state.showQuickValues}
              >
                {tt('filter.quickValues.title')} ({uniqueValues.length})
              </Button>

              {#if state.showQuickValues}
                <div class={styles.quickValues()}>
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

  <!--
    The form's own actions. They live with the form and not with the hull
    because both hulls need them and neither can reach `filterStates` — the
    popover used to own an Apply button in its footer while the state it applied
    sat in the same component; splitting that would have meant handing an
    imperative apply() out through a binding.
  -->
  <div class={styles.footer()}>
    {#if activeFilters.length > 0}
      <Button variant="ghost" size="sm" intent="danger" onclick={() => clearAllFilters()}>
        {tt('filter.button.clearAll')}
      </Button>
    {/if}
    <Button variant="filled" size="sm" intent="primary" onclick={handleApplyAllFilters}>
      {bt('button.apply')}
    </Button>
  </div>
</div>
