<script lang="ts" generics="T = TableItem">
  import type { TableProps } from './index';
  import type { TableItem, Column } from '$lib/types/tableTypes';
  import type { TableSource } from '$lib/view/source';
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
    variant = 'flush' as 'flush' | 'surface' | 'framed',

    source = undefined,
    view = undefined,
    viewDefaults = undefined,
    prefs = undefined,
    expandedRowContent = undefined,
    multiExpand = false,
    mobileCardDetails = 'collapsed',
    onRowClick = undefined,
    virtualized = false,
    virtualHeight = '600px',
    groupOrder = [],
    initialSelectedIds = undefined,

    enableSmartFilter = true,
    enableColumnVisibility = true,
    searchPlaceholder = tt('search.placeholder'),
    searchDebounceMs = 300,

    loadingText = tt('data.loading'),
    errorText = tt('error.loadingError'),
    noDataText = tt('data.empty'),

    cell = undefined,
    header = undefined,
    body = undefined,
    pagination = undefined,
    emptyState = undefined,
    loadingState = undefined,
    errorState = undefined,
    groupHeaderContent,
    toolbar = undefined,
    unstyled = false,
    slotClasses = {},
    enableColumnReorder = false,
    enableLiveUpdates = false,
    autoApplyOnNavigation = true,
    selectionMode = 'none',
    rowClickSelects = undefined,
    activeRowId = null,
    onReady = undefined,
    selectedIds = undefined,
    onSelectionChange = undefined,
    sticky = false,
    stickyOffset = 0,
    fit = 'content'
  }: TableProps<T> = $props();

  // One-shot DEV migration warning for the v1.5 slot rename.
  // svelte-ignore state_referenced_locally
  if (import.meta.env?.DEV && 'wrapper' in slotClasses) {
    console.warn('[Table] slotClasses.wrapper was renamed to slotClasses.scrollArea in v1.5.');
  }

  // Internally we erase the generic to TableItem because the data store and
  // downstream cell pipelines work against the dynamic-record shape. The
  // generic is preserved at the public surface (props + callbacks), so
  // consumers writing `<Table<Apartment> ... />` get full type-safety.
  const itemsErased = $derived(items as unknown as TableItem[]);
  const columnsErased = $derived(columns as unknown as Column[]);
  const sourceErased = $derived(source as unknown as TableSource | undefined);
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
    get variant() {
      return variant;
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

  // Row-click selection defaults on for single-select (one click is the expected
  // gesture there) but never steals a row click that already means something:
  // both an `onRowClick` handler and expandable rows (where the click toggles
  // the detail row) opt out, unless the consumer opts in explicitly.
  const rowClickSelectsResolved = $derived(
    rowClickSelects ?? (selectionMode === 'single' && !onRowClick && !expandedRowContent)
  );

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
  source={sourceErased}
  {view}
  {viewDefaults}
  {prefs}
  {groupOrder}
  {initialSelectedIds}
  {multiExpand}
  {virtualized}
  {enableLiveUpdates}
  {autoApplyOnNavigation}
  {selectionMode}
  rowClickSelects={rowClickSelectsResolved}
  {activeRowId}
  {onReady}
  {selectedIds}
  onSelectionChange={onSelectionChangeErased}
  {enableColumnVisibility}
>
  {@render provider_content()}
</TableProvider>

{#snippet provider_content()}
  {@const tableContext = getTableContext()}
  {@const { state: tableState } = tableContext}

  {@const tableStyles = tableContainerVariants({
    variant,
    size,
    responsive: true,
    stickyToolbar: stickyMode.toolbar,
    contained
  })}

  <div
    class={resolveSlotClass(tableStyles.container, slotClasses.container, unstyled, className)}
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
        class={resolveSlotClass(tableStyles.toolbar, slotClasses.toolbar, unstyled)}
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
      {emptyState}
      {loadingState}
      {errorState}
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

    <!-- Mobile renders its own loading/error/empty text (all three desktop states
         are row markup), so it stays mounted; only pagination is gated on data. -->
    <TableMobile
      {size}
      {expandable}
      details={mobileCardDetails}
      expandedRowContent={expandedRowContentErased}
      cell={cellErased}
      {noDataText}
      {loadingText}
      {errorText}
      onRowClick={onRowClickErased}
    />

    {#if !tableState.loading && !tableState.error}
      {#if tableContext.filteredItems.length > 0 && !tableState.groupByKey && !virtualized}
        {#if pagination}
          {@render pagination()}
        {:else}
          <!-- On a single page the arrows are two permanently disabled buttons,
               and removing them used to mean passing an empty `pagination`
               snippet — a workaround that reads like a mistake. Only the
               NAVIGATION is gated, never the footer: `layout="table"` renders
               `rangeInfo` ("1–7 of 7"), which is the table's only visible row
               count anywhere in its chrome (`aria-rowcount` serves assistive
               tech, not the eye). Hiding the whole footer would delete that
               count exactly when a filter narrows the table and a reader most
               wants it. -->
          <Pagination
            currentPage={tableContext.effectivePage}
            totalPages={tableContext.totalPages}
            onPageChange={tableContext.goToPage}
            layout="table"
            size="md"
            variant="ghost"
            intent="neutral"
            tier="modify"
            showInfo={true}
            showPreviousNext={tableContext.totalPages > 1}
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
