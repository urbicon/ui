<script lang="ts" generics="T = TableItem">
  import type { TableProps } from './index';
  import type { TableItem, Column } from '$lib/types/tableTypes';
  import { getTableContext } from '$lib/stores/TableStore.svelte.js';
  import { tableContainerVariants } from '$lib/variants';
  import {
    Pagination,
    resolveIcon,
    ChevronLeftIcon as ChevronLeftIconDefault,
    ChevronRightIcon as ChevronRightIconDefault
  } from '@urbicon-ui/blocks';
  import SmartFilterBar from '../../features/SmartFilterBar/SmartFilterBar.svelte';

  const ChevronLeftIcon = resolveIcon('chevronLeft', ChevronLeftIconDefault);
  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);
  import LiveUpdateBanner from '../../features/LiveUpdateBanner.svelte';
  import { useTableI18n } from '$lib/i18n';
  import TableDesktop from '../TableDesktop.svelte';
  import TableMobile from '../TableMobile.svelte';
  import TableProvider from '../TableProvider.svelte';
  import { setTableStyleContext, resolveSlotClass } from '../table-style-context';
  import { createStickyState, resolveStickyMode, setStickyContext } from '../sticky-context.svelte';
  import {
    measureToCssVar,
    measureViewportOffsetTop,
    observeStuck
  } from '$lib/utils/sticky-measure';

  const tt = useTableI18n();

  let {
    items = [] as T[],
    columns = [],
    class: className = '',
    ariaLabel = undefined,
    size = 'md' as 'sm' | 'md' | 'lg',
    appearance = 'flush' as 'flush' | 'surface' | 'framed',

    itemsPerPage = 10,
    initialPage = 1,
    expandedRowContent = undefined,
    multiExpand = false,
    onRowClick = undefined,
    virtualized = false,
    virtualHeight = '600px',
    groupOrder = [],
    initialGroupBy = null,
    initialSummaryConfigs = [],

    enableSmartFilter = true,
    searchPlaceholder = tt('search.placeholder'),
    searchDebounceMs = 300,

    loadingText = tt('data.loading'),
    errorText = tt('error.loadingError'),
    noDataText = tt('data.empty'),

    cell = undefined,
    header = undefined,
    body = undefined,
    pagination = undefined,
    empty = undefined,
    loading = undefined,
    error = undefined,
    groupHeaderContent,
    toolbar = undefined,
    mode = 'client',
    serverTotalItems = 0,
    queryFn = undefined,
    onQueryChange = undefined,
    queryDebounceMs = 300,
    persistenceConfig,
    unstyled = false,
    slotClasses = {},
    enableColumnReorder = false,
    enableLiveUpdates = false,
    autoApplyOnNavigation = true,
    selectionMode = 'none',
    selectedIds = undefined,
    onSelectionChange = undefined,
    sticky = false,
    stickyOffset = 0,
    fit = 'content'
  }: TableProps<T> = $props();

  if (import.meta.env?.DEV && 'wrapper' in slotClasses) {
    console.warn('[Table] slotClasses.wrapper was renamed to slotClasses.scrollArea in v1.5.');
  }

  // Internally we erase the generic to TableItem because the data store and
  // downstream cell pipelines work against the dynamic-record shape. The
  // generic is preserved at the public surface (props + callbacks), so
  // consumers writing `<Table<Apartment> ... />` get full type-safety.
  const itemsErased = $derived(items as unknown as TableItem[]);
  const columnsErased = $derived(columns as unknown as Column[]);
  const expandedRowContentErased = $derived(
    expandedRowContent as unknown as TableProps['expandedRowContent']
  );
  const cellErased = $derived(cell as unknown as TableProps['cell']);
  const onRowClickErased = $derived(onRowClick as unknown as TableProps['onRowClick']);
  const groupHeaderContentErased = $derived(
    groupHeaderContent as unknown as TableProps['groupHeaderContent']
  );
  const onSelectionChangeErased = $derived(
    onSelectionChange as unknown as TableProps['onSelectionChange']
  );

  setTableStyleContext({
    get unstyled() {
      return unstyled;
    },
    get slotClasses() {
      return slotClasses;
    },
    get appearance() {
      return appearance;
    }
  });

  // `fit="viewport"` turns the table into its own scroll container (see the
  // `contained` variant). Mutually exclusive with `virtualized`, which manages
  // its own bounded scroll via `virtualHeight`.
  const contained = $derived(fit === 'viewport' && !virtualized);

  // Sticky pinning — resolve per-layer mode + provide reactive context.
  // `getMode` keeps the context live when `sticky`/`fit` change at runtime.
  //
  // In contained mode `resolveStickyMode` forces header + group pinning and
  // drops toolbar page-pinning (the toolbar is a static flex sibling outside
  // the scroll box). The thead/group `top: calc(sticky-top + toolbar-h + …)`
  // formulas then resolve to box-relative offsets because sticky-top is forced
  // to 0 below and toolbar-h is never measured (toolbar is not pinned here).
  const stickyState = createStickyState(() => resolveStickyMode(sticky, contained));
  const stickyMode = $derived(stickyState.mode);
  setStickyContext(stickyState);

  let expandable = $derived(!!expandedRowContent);

  let tableContainer = $state<HTMLElement | null>(null);
  let tableDomWidth = $state<string>('100%');

  // `--blocks-table-sticky-top` is the consumer-facing offset (e.g. fixed top bar).
  // In contained mode the box's measured top handles the offset, so the
  // page-relative sticky-top must be 0 (the thead pins to the box, not the page);
  // `stickyOffset` is ignored there.
  const containerStyle = $derived(`--blocks-table-sticky-top: ${contained ? 0 : stickyOffset}px;`);
  const stuckRootMargin = $derived(`-${stickyOffset + 1}px`);

  // Default toolbar = SmartFilterBar; consumers can override via the `toolbar` snippet
  const hasToolbar = $derived(!!toolbar || enableSmartFilter);

  $effect(() => {
    if (tableContainer) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          tableDomWidth = `${width}px`;
        }
      });

      resizeObserver.observe(tableContainer);

      return () => {
        resizeObserver.disconnect();
      };
    }
  });
</script>

{#snippet prevIcon()}<ChevronLeftIcon class="h-4 w-4" />{/snippet}
{#snippet nextIcon()}<ChevronRightIcon class="h-4 w-4" />{/snippet}

<TableProvider
  items={itemsErased}
  columns={columnsErased}
  {itemsPerPage}
  {initialPage}
  {groupOrder}
  {initialGroupBy}
  {initialSummaryConfigs}
  {multiExpand}
  loading={false}
  {persistenceConfig}
  {mode}
  {serverTotalItems}
  {queryFn}
  {onQueryChange}
  {queryDebounceMs}
  {enableLiveUpdates}
  {autoApplyOnNavigation}
  {selectionMode}
  {selectedIds}
  onSelectionChange={onSelectionChangeErased}
>
  {@render provider_content()}
</TableProvider>

{#snippet provider_content()}
  {@const tableContext = getTableContext()}
  {@const { state: tableState } = tableContext}

  {@const tableStyles = tableContainerVariants({
    appearance,
    size,
    responsive: true,
    stickyToolbar: stickyMode.toolbar,
    contained
  })}

  <div
    class={resolveSlotClass(tableStyles.container(), slotClasses.container, unstyled, className)}
    style={containerStyle}
    data-table-container
    data-fit={contained ? 'viewport' : 'content'}
    data-testid="table"
    bind:this={tableContainer}
    {@attach contained ? measureViewportOffsetTop('--blocks-table-avail-top') : () => {}}
  >
    {#if hasToolbar}
      {#if stickyMode.toolbar}
        <div data-sticky-sentinel aria-hidden="true" class="-mt-px h-px"></div>
      {/if}
      <div
        class={resolveSlotClass(tableStyles.toolbar(), slotClasses.toolbar, unstyled)}
        data-table-toolbar
        data-stuck={stickyMode.toolbar ? stickyState.toolbarStuck : undefined}
        {@attach stickyMode.toolbar ? measureToCssVar('--blocks-table-toolbar-h') : () => {}}
        {@attach stickyMode.toolbar
          ? observeStuck((stuck) => stickyState.setToolbarStuck(stuck), stuckRootMargin)
          : () => {}}
      >
        {#if toolbar}
          {@render toolbar()}
        {:else if enableSmartFilter}
          <SmartFilterBar placeholder={searchPlaceholder} debounceMs={searchDebounceMs} {size} />
        {/if}
      </div>
    {/if}

    {#if enableLiveUpdates}
      <LiveUpdateBanner class={['mb-3', contained && 'md:shrink-0'].filter(Boolean).join(' ')} />
    {/if}

    <TableDesktop
      {tableStyles}
      {tableDomWidth}
      {size}
      {expandable}
      expandedRowContent={expandedRowContentErased}
      cell={cellErased}
      {header}
      {body}
      {empty}
      {loading}
      {error}
      {loadingText}
      {errorText}
      {noDataText}
      onRowClick={onRowClickErased}
      {virtualized}
      {virtualHeight}
      groupHeaderContent={groupHeaderContentErased}
      {ariaLabel}
      {enableColumnReorder}
    />

    {#if !tableState.loading && !tableState.error}
      <TableMobile
        {size}
        {expandable}
        expandedRowContent={expandedRowContentErased}
        cell={cellErased}
        {empty}
        {noDataText}
        onRowClick={onRowClickErased}
      />

      {#if tableContext.filteredItems.length > 0 && !tableState.groupByKey && !virtualized}
        {#if pagination}
          {@render pagination()}
        {:else}
          <Pagination
            currentPage={tableState.currentPage}
            totalPages={tableContext.totalPages}
            onPageChange={tableContext.goToPage}
            layout="table"
            size="md"
            variant="ghost"
            intent="neutral"
            tier="modify"
            showInfo={true}
            itemsPerPage={tableState.itemsPerPage}
            totalItems={tableContext.totalItems}
            previousIcon={prevIcon}
            {nextIcon}
            pageLabel={tt('pagination.page')}
            class={['border-border-hairline border-t pt-2', contained && 'md:shrink-0']
              .filter(Boolean)
              .join(' ')}
          />
        {/if}
      {/if}
    {/if}
  </div>
{/snippet}
