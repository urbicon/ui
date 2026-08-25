<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';
  import EmptyState from './EmptyState.svelte';
  import ErrorState from './ErrorState.svelte';
  import GroupedRow from './GroupedRow.svelte';
  import LoadingState from './LoadingState.svelte';
  import TableHead from './TableHead.svelte';
  import TableRow from './TableRow.svelte';
  import SummaryRow from '../features/SummaryRow.svelte';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';
  import { computeVirtualItems, ROW_HEIGHTS } from '$lib/utils/virtualizer';
  import { resolveColumnId, resolveRowItemId } from '$lib/utils';
  import { getStickyContext } from './sticky-context.svelte';
  import type { Column, TableItem } from '$lib/types/tableTypes';
  import type { Snippet } from 'svelte';

  const tt = useTableI18n();

  const styleConfig = getTableStyleConfig();
  const stickyContext = getStickyContext();
  // When header pinning is enabled (thead + group header), the visible frame
  // must NOT create its own scroll-ancestor (overflow:auto/hidden hijacks
  // `position: sticky`). We trade the in-table horizontal scroll for page-level
  // overflow in that case.
  const scrollAreaOverflow = $derived(stickyContext.mode.header ? '' : 'overflow-x-auto');

  let {
    tableStyles,
    tableDomWidth = '100%',
    size = 'md' as 'sm' | 'md' | 'lg',
    expandable = false,
    expandedRowContent = undefined as Snippet<[item: TableItem]> | undefined,
    cell = undefined as Snippet<[item: TableItem, value: unknown, column: Column]> | undefined,
    header = undefined as Snippet | undefined,
    body = undefined as Snippet | undefined,
    emptyState = undefined as Snippet | undefined,
    loadingState = undefined as Snippet | undefined,
    errorState = undefined as Snippet | undefined,
    loadingText = '',
    errorText = '',
    noDataText = '',
    onRowClick = undefined as ((item: TableItem) => void) | undefined,
    virtualized = false,
    groupHeaderContent = undefined as
      Snippet<[groupName: string, items: TableItem[], isExpanded: boolean]> | undefined,
    ariaLabel = undefined as string | undefined,
    virtualHeight = '600px',
    enableColumnReorder = false
  } = $props();

  const tableContext = getInternalTableContext();
  const { state: tableState, view: tableView } = tableContext;
  const filteredItems = $derived(tableContext.filteredItems);
  const paginatedItems = $derived(tableContext.paginatedItems);
  /** Rendered rows in visual order — what the keyboard navigates. Equals
   *  `paginatedItems` ungrouped; grouped it spans all groups minus collapsed ones. */
  const navigableItems = $derived(tableContext.navigableItems);
  const grouped = $derived(tableContext.grouped);
  const groupedSummaryData = $derived(tableContext.groupedSummaryData);
  /** Whether a summary row is in force at all — the store's one answer, not a
   *  third hand-written copy of `showSummary && configs.length` (#252; the
   *  derivation lives on useSummary). */
  const hasSummary = $derived(tableState.effectiveSummaryConfigs.length > 0);

  /**
   * Where each rendered group's item rows start within `navigableItems`. A
   * collapsed group renders no item rows, so it contributes 0 and the next group
   * continues at the same offset — which keeps `data-row-index` contiguous over
   * exactly the rows that exist in the DOM.
   */
  const groupRowOffsets = $derived.by(() => {
    const offsets: number[] = [];
    let running = 0;
    for (const [groupName, groupItems] of Object.entries(grouped)) {
      offsets.push(running);
      if (!tableState.collapsedGroups.has(groupName)) running += groupItems.length;
    }
    return offsets;
  });

  let selectable = $derived(tableState.selectionMode !== 'none');
  let interactive = $derived(selectable || expandable || !!onRowClick);

  /** Total columns including expand + group + selection columns */
  const totalColSpan = $derived.by(() => {
    let count = tableState.columns.length;
    if (expandable) count += 1;
    if (tableState.effectiveGroupBy) count += 1;
    if (selectable) count += 1;
    return count;
  });

  let tableElement = $state<HTMLTableElement | null>(null);
  let scrollContainerEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewportHeight = $state(0);

  // Virtualized = true bypasses pagination, uses all sorted items.
  // Loading/error fall back to the standard branch: those states render a
  // single row instead of a body, which the virtual list has no place for —
  // without this the virtualized table would answer "loading" with the empty
  // state ("No data found.") while mobile says "Loading…".
  const virtualizedActive = $derived(
    virtualized && !tableState.effectiveGroupBy && !tableState.loading && !tableState.error
  );
  // The SAME derivation the keyboard counts and targets (`navigableItems` is
  // virtualization-aware in the store). Reading `sortedItems` here while the
  // keydown handler counted `navigableItems` let the two index spaces drift —
  // the render window held every row while the keyboard capped at `pageSize`.
  const virtualItems = $derived(navigableItems);

  // What a row is worth in pixels, measured rather than assumed. The
  // virtualizer strides in this number twice over — it sizes the scroll spacer
  // (`count * rowHeight`) and it offsets the rendered window — so any gap
  // between it and the height a row actually renders at accumulates over the
  // whole list. `ROW_HEIGHTS` is only the first frame's guess: it is derived
  // from the row's Tailwind class, which is a `rem` value, and it knows nothing
  // about a consumer's own `slotClasses.row`. See `measureRowHeight` below.
  let measuredRowHeight = $state<number | null>(null);
  const rowHeight = $derived(measuredRowHeight ?? ROW_HEIGHTS[size] ?? ROW_HEIGHTS.md);

  const virtualResult = $derived(
    virtualizedActive
      ? computeVirtualItems(scrollTop, viewportHeight, {
          count: virtualItems.length,
          rowHeight,
          overscan: 5
        })
      : null
  );

  async function handleVirtualScroll() {
    if (!scrollContainerEl) return;
    scrollTop = scrollContainerEl.scrollTop;
    // Roving tabindex over a window: exactly one RENDERED row must carry
    // `tabindex="0"` at all times. When the focused row scrolls out of the
    // render window it unmounts, and with it the table's only Tab stop — so
    // the focus index follows the window to the first fully visible row.
    //
    // The check runs AFTER the flush, not at event time: when this very
    // scroll unmounts the focused row, the row still holds the real focus at
    // event time — a pre-flush guard read "focus is live", skipped, and the
    // table ended with focus on body and zero rendered tab stops. After the
    // tick the unmounted row has surrendered the focus, so the guard sees
    // the truth; and `focusVirtualRow`'s own trailing scroll event finds its
    // target row rendered and focused by then, which keeps it a no-op.
    if (!virtualizedActive) return;
    const first = Math.ceil(scrollTop / rowHeight);
    const last = Math.floor((scrollTop + viewportHeight) / rowHeight) - 1;
    await tick();
    if (!scrollContainerEl) return;
    const focusedIndex = tableContext.focusedRowIndex;
    const focusIsLive =
      document.activeElement && scrollContainerEl.contains(document.activeElement);
    if ((focusedIndex < first || focusedIndex > last) && !focusIsLive) {
      tableContext.setFocusedRow(Math.max(0, Math.min(first, navigableItems.length - 1)));
    }
  }

  // Observe container height for virtualizer
  $effect(() => {
    if (scrollContainerEl && virtualizedActive) {
      viewportHeight = scrollContainerEl.clientHeight;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          viewportHeight = entry.contentRect.height;
        }
      });
      observer.observe(scrollContainerEl);
      return () => observer.disconnect();
    }
  });

  // Take the row height from a data row.
  //
  // `tr[data-row-index]`, not `tbody tr`: the empty state is a `<tr>` too, and
  // several times as tall. A plain `tbody tr` latched onto it whenever a
  // virtualized table started empty — remote data, or a filter that matched
  // nothing and was then cleared — and nothing here would have looked again,
  // because the container's height is pinned by `virtualHeight` so the observer
  // never fires. The list then strode five rows for every row it drew.
  //
  // What the stride has to cover, and why none of the three obvious readings
  // does it alone.
  //
  // The spacer is `count × stride`, so a stride below the distance from one row
  // to the next puts the end of the list below the bottom of the scroller,
  // where no scroll position can reach it. That distance is not the first row's
  // height. Under `border-collapse: collapse` neighbours share their 1px
  // `border-b`, so an interior row's border box is 0.5px taller than the first
  // one: the interactive fixture measures `[52.5, 53 × 11, 52.5]` — identical
  // at device pixel ratio 1, 2 and 3, so this is the collapsed border and not
  // any kind of pixel snapping. `rows[0]` is structurally the one row that
  // never shows the interior pitch, which is why the probe takes `rows[1]`.
  //
  // On top of that the value is rounded **up**, because `offsetHeight` rounds to
  // nearest and half of a fractional pitch therefore rounds down into exactly
  // the shortfall above. Measured over root font sizes 13–18px (2026-08-25),
  // the previous `rows[0].offsetHeight` left the last row unreachable at five
  // of six — worst case 14.75px below the scroller — while it happened to be
  // correct at the default 16px. With the interior row and the ceiling every
  // one of them is non-negative.
  //
  // Both readings, and the larger one. The rect supplies the fraction that
  // `offsetHeight` rounds away; `offsetHeight` supplies the layout box for the
  // two cases where the rect measures something else — a transform on the row,
  // which a consumer can put there through `slotClasses.row`, and an
  // environment that lays nothing out, where the rect is 0 and the assumed
  // height has to survive.
  //
  // Not, as this comment claimed before it was measured, to survive a row
  // pressed under `active:scale-[0.995]`. That class cannot reach a row:
  // `tableRowVariants` is called with `state` and `size` only
  // (`TableRow.svelte:126`), so the `interactive` variant carrying it never
  // resolves and a pressed row measures `scale: none`. Under a transform the
  // floor is not sufficient anyway — at a 17px root the sm pitch is 37.125
  // against an `offsetHeight` of 37 — and a transformed row is outside what
  // this virtualizer claims to handle.
  //
  // `rows[1]` is the *interior* row, not the correct row in general. Index 1 is
  // as arbitrary as index 0 the moment rows differ in height: a second row that
  // wraps to two lines inflates the stride for all of them (measured: one 69px
  // row among 40px ones over 500 rows leaves a 290px band at the end). That
  // direction is the survivable one — slack, not an unreachable end — and
  // `computeVirtualItems` documents fixed-height rows as its premise. What
  // index 1 buys is the collapsed-border half-pixel, which is structural and
  // affects every table; a row that is genuinely taller than its neighbours is
  // outside what this virtualizer claims to handle.
  //
  // The geometry spec in `e2e/table-core.spec.ts` runs over a fractional fixture
  // as well as the integer one; before it did, none of this was visible.
  $effect(() => {
    // The inputs the observer below cannot see. `size` and a consumer's own row
    // class change the height without changing the container's.
    void size;
    void styleConfig.slotClasses.row;
    // Whether there are rows at all — NOT how many. What this effect needs to
    // hear is the empty → non-empty transition, when the rows it measures come
    // into existence. Depending on the count itself would rebuild the observer
    // on every keystroke of a search and every live-update push, which is the
    // churn the `untrack` below exists to avoid.
    void (virtualItems.length === 0);

    if (!scrollContainerEl || !virtualizedActive) {
      measuredRowHeight = null;
      return;
    }

    const measure = () => {
      const rows = scrollContainerEl?.querySelectorAll<HTMLElement>('tbody tr[data-row-index]');
      // The second rendered row, per the note above; the first is the fallback
      // for a window that holds only one.
      const row = rows?.[1] ?? rows?.[0];
      // A row with no height is a row that has not been laid out yet (or a test
      // environment that lays nothing out) — keeping the previous value leaves
      // the derived starting height in place rather than dividing by zero.
      if (!row || row.offsetHeight === 0) return;
      const stride = Math.max(row.offsetHeight, Math.ceil(row.getBoundingClientRect().height));
      // `untrack`: this reads the state it writes, purely to avoid a redundant
      // assignment. Tracked, it would make the effect its own dependency, so
      // every height change would tear the observer down and build a new one.
      if (stride !== untrack(() => measuredRowHeight)) {
        measuredRowHeight = stride;
      }
    };

    measure();

    // Observing the container rather than the row: the rendered rows are
    // replaced on every scroll tick, so an observer bound to one of them would
    // outlive its target within a frame.
    const observer = new ResizeObserver(measure);
    observer.observe(scrollContainerEl);
    return () => observer.disconnect();
  });

  // Reset focus when page/sort/filter changes
  $effect(() => {
    // Track dependencies so we reset on any data change.
    // `effectivePage`, not `view.page` — what matters is whether the
    // rendered rows changed, and the raw value misses that in both directions:
    // 5 → 6 against three pages renders the same rows (reset was firing for
    // nothing), while a new page size re-slices them without moving it at all.
    void tableContext.effectivePage;
    void tableView.sort;
    void tableView.search;
    void tableView.filters;
    // Grouping reshapes the index space just as much as paging does: switching
    // the group key reorders every row, and collapsing a group removes a run of
    // them, so a held index would land on a different item.
    void tableState.effectiveGroupBy;
    void tableState.collapsedGroups.size;
    tableContext.resetFocus();
  });

  function focusRow(index: number) {
    if (virtualizedActive) {
      void focusVirtualRow(index);
      return;
    }
    if (!tableElement) return;
    // Address the row by its index attribute rather than by position in the
    // NodeList: grouped rendering interleaves group headers and summary rows, so
    // "the Nth matching element" and "the row at index N" are not the same thing.
    const targetRow = tableElement.querySelector<HTMLElement>(
      `tbody tr[data-row-index="${index}"]`
    );
    if (targetRow) {
      targetRow.focus({ preventScroll: false });
    }
  }

  // Focusing a virtualized row means moving the window first: the target may
  // not be rendered at all. The sequence is deterministic because the window
  // position hangs on the `scrollTop` state alone — set the container's scroll
  // position, mirror it into the state synchronously (the scroll event arrives
  // a task later, far too late for the focus call), wait one tick for the
  // window to re-derive, then focus the now-rendered row. The rows live under
  // the scroll container, not under `tableElement` — that one is the header
  // table, whose only children are colgroup and thead, so searching it found
  // null forever and the focus never moved.
  async function focusVirtualRow(index: number) {
    if (!scrollContainerEl) return;
    const top = index * rowHeight;
    const viewTop = scrollContainerEl.scrollTop;
    const viewH = scrollContainerEl.clientHeight;
    if (top < viewTop) scrollContainerEl.scrollTop = top;
    else if (top + rowHeight > viewTop + viewH) {
      scrollContainerEl.scrollTop = top + rowHeight - viewH;
    }
    scrollTop = scrollContainerEl.scrollTop;
    await tick();
    // `preventScroll`: the position was just set; the browser's own
    // scroll-into-view would fight the transform offsets of the window.
    scrollContainerEl
      .querySelector<HTMLElement>(`tbody tr[data-row-index="${index}"]`)
      ?.focus({ preventScroll: true });
  }

  function getItemIdAtIndex(index: number): string | number | undefined {
    const item = navigableItems[index];
    if (!item) return undefined;
    // Same rule as every renderer, but this caller's sentinel is `undefined`,
    // not -1 — keyboard actions must no-op on an unidentifiable row.
    const id = resolveRowItemId(item);
    return id === -1 ? undefined : id;
  }

  function handleTableKeyDown(e: KeyboardEvent) {
    if (!interactive) return;

    // Only handle keys when focus is on or inside a row
    const target = e.target as HTMLElement;

    // An open in-cell overlay owns its keys: the header ⋮ menu (and any
    // future in-cell overlay) renders inside the `<th>`/`<td>` DOM —
    // `usePortal` promotes to the top layer without reparenting — so its
    // keydowns bubble through here, including keys a menu leaves unhandled
    // on purpose. Both keydown hosts route through this one handler.
    if (target.closest('[role="menu"]')) return;
    const isInsideInteractive = target.closest(
      'button, input, select, textarea, a[href], [contenteditable]'
    );

    // If the user is interacting with a form element inside a cell, don't capture keys
    // Exception: we still handle arrow keys to navigate out
    if (
      isInsideInteractive &&
      !['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)
    ) {
      return;
    }

    const itemCount = navigableItems.length;
    if (itemCount === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        tableContext.moveFocus('down');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        tableContext.moveFocus('up');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case 'Home': {
        e.preventDefault();
        tableContext.moveFocus('first');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case 'End': {
        e.preventDefault();
        tableContext.moveFocus('last');
        focusRow(tableContext.focusedRowIndex);
        break;
      }
      case ' ': {
        // Space = toggle selection
        if (selectable) {
          e.preventDefault();
          const id = getItemIdAtIndex(tableContext.focusedRowIndex);
          if (id !== undefined) {
            tableContext.toggleItem(id);
          }
        }
        break;
      }
      case 'Enter': {
        // Enter = expand row or trigger onRowClick
        const id = getItemIdAtIndex(tableContext.focusedRowIndex);
        if (id !== undefined) {
          if (expandable) {
            e.preventDefault();
            tableContext.toggleExpand(id);
          } else if (onRowClick) {
            e.preventDefault();
            const item = navigableItems[tableContext.focusedRowIndex];
            if (item) onRowClick(item);
          }
        }
        break;
      }
      case 'Escape': {
        // Escape = deselect all or collapse expanded rows
        if (selectable && tableContext.selectedItems.length > 0) {
          e.preventDefault();
          tableContext.deselectAll();
        }
        break;
      }
      // Both keys step from `effectivePage`, not `view.page`: the raw
      // value can sit past the last page after the page size or the row count
      // changed, and stepping from there lands outside the range `goToPage`
      // accepts — which killed paging in BOTH directions rather than one.
      // Gated on the pager being rendered at all: client-virtualized renders
      // the whole list in the scroll container, so stepping a page nobody
      // renders would silently re-slice nothing — while server-virtualized
      // keeps its pager and the keys keep working.
      case 'PageDown': {
        // Next page
        if (
          tableContext.pageInfo.showPager &&
          tableContext.totalPages > 1 &&
          tableContext.effectivePage < tableContext.totalPages
        ) {
          e.preventDefault();
          tableContext.goToPage(tableContext.effectivePage + 1);
        }
        break;
      }
      case 'PageUp': {
        // Previous page
        if (
          tableContext.pageInfo.showPager &&
          tableContext.totalPages > 1 &&
          tableContext.effectivePage > 1
        ) {
          e.preventDefault();
          tableContext.goToPage(tableContext.effectivePage - 1);
        }
        break;
      }
    }
  }

  /**
   * The column tracks, as data — one entry per rendered `<col>`, in render order.
   *
   * The virtualized layout renders the header, the body and the summary row as
   * three independent `<table>` elements, so each computes its own tracks. That
   * only stayed invisible while every track was implicit: `table-fixed` takes
   * its widths from the **first row**, which for the header table is the `<th>`
   * row and for the body table is a `<td>` row — and `TableHead` writes
   * `width`/`min-width` inline on `<th>` while `TableRow` writes nothing on
   * `<td>`. So a column with an explicit `width` sized the header and not the
   * body, and everything after it slid (measured on the landing specimen: the
   * STATUS header ~130px right of its badges).
   *
   * `<colgroup>` is the mechanism tables have for exactly this — it sizes tracks
   * independently of any row — so the same list goes into all three and they can
   * no longer disagree. It mirrors `TableHead`'s leading control columns; the
   * group-toggle column is absent on purpose, because `virtualizedActive`
   * already excludes grouping.
   */
  const columnTracks = $derived.by(() => {
    const tracks: Array<{ key: string; width?: string }> = [];
    // The header's control cells carry `w-12` / `w-10`; these are the same two
    // widths, as something a `<col>` can express.
    if (selectable) tracks.push({ key: '__selection', width: '3rem' });
    if (expandable) tracks.push({ key: '__expand', width: '2.5rem' });
    // `orderedColumns` unconditionally, NOT `enableColumnReorder ? … :
    // state.columns`. `TableRow` and `SummaryRow` iterate `orderedColumns`
    // whatever that flag says, and `applyPersistedState` restores a stored
    // order whether or not reordering is currently enabled — so the conditional
    // would have sized the header's declaration order onto the body's persisted
    // one, which is the defect this snippet exists to remove. It falls back to
    // `state.columns` when no order is set, so it is never the narrower choice.
    for (const column of tableContext.orderedColumns) {
      tracks.push({ key: resolveColumnId(column), width: column.width });
    }
    return tracks;
  });
</script>

{#snippet columnTrackGroup()}
  <!-- `width` only: per CSS Tables a column box honours `border`, `background`,
       `width` and `visibility` and nothing else, so a `min-width` here would be
       inert — and one that reads as if it applied is worse than none. A column
       with only a `minWidth` gets no track, exactly as before. -->
  <colgroup>
    {#each columnTracks as track (track.key)}
      <col style={track.width ? `width: ${track.width}` : ''} />
    {/each}
  </colgroup>
{/snippet}

{#if virtualizedActive}
  <!-- Virtualized mode: scroll container with fixed height -->
  <div
    class={resolveSlotClass(
      tableStyles.scrollArea,
      styleConfig.slotClasses.scrollArea,
      styleConfig.unstyled,
      `relative ${tableStyles.desktopOnly()}`
    )}
    data-table-layout="desktop"
    role="region"
    aria-label={tt('aria.tableData')}
    style="width: {tableDomWidth};"
  >
    <!-- One grid over three tables. The header, the scrolling body and the
         summary render as separate <table> elements (their layout contract —
         see columnTracks), which left the rows outside the element that
         claimed role="grid": exactly one grid existed, containing zero data
         rows, while every cell claimed grid membership with no grid ancestor.
         This wrapper is the single ARIA surface — role, label, row/col counts,
         keydown — and the tables under it become presentational with explicit
         roles on their structural rows and cells. A #14 layout rework would
         collapse the three tables into one and delete this div with them. -->
    <!-- tabindex -1: the wrapper is script-focusable, never a Tab stop — the
         rows carry the roving tabindex, exactly like the standard branch's
         table element (which as a <table> needs no attribute to say so). -->
    <div
      role={interactive ? 'grid' : 'table'}
      tabindex="-1"
      aria-label={ariaLabel}
      aria-rowcount={tableContext.pageInfo.totalItems}
      aria-colcount={totalColSpan}
      onkeydown={handleTableKeyDown}
      data-testid="virtual-grid"
    >
      <!-- Sticky header table -->
      <table
        bind:this={tableElement}
        class={resolveSlotClass(
          tableStyles.table,
          styleConfig.slotClasses.table,
          styleConfig.unstyled,
          'table-fixed'
        )}
        role="presentation"
        data-testid="table-element"
      >
        {@render columnTrackGroup()}
        {#if header}
          {@render header()}
        {:else}
          <TableHead {expandable} {enableColumnReorder} {size} explicitRoles={true} />
        {/if}
      </table>

      <!-- Scrollable body -->
      <div
        bind:this={scrollContainerEl}
        onscroll={handleVirtualScroll}
        class="overflow-x-hidden overflow-y-auto"
        style="height: {virtualHeight};"
        role="presentation"
        data-testid="virtual-scroll-container"
      >
        {#if filteredItems.length === 0}
          <table
            class={resolveSlotClass(
              tableStyles.table,
              styleConfig.slotClasses.table,
              styleConfig.unstyled,
              'table-fixed'
            )}
            role="presentation"
          >
            {@render columnTrackGroup()}
            <tbody
              class={resolveSlotClass(
                tableStyles.body,
                styleConfig.slotClasses.tbody,
                styleConfig.unstyled
              )}
            >
              {#if emptyState}
                {@render emptyState()}
              {:else}
                <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
              {/if}
            </tbody>
          </table>
        {:else if virtualResult}
          <!-- Inner container with total height for scrollbar -->
          <div style="height: {virtualResult.totalHeight}px; position: relative;">
            <!-- The rendered window is offset once, here, rather than per row:
               `startIndex` is the first row the virtualizer kept, so the table
               starts exactly where that row belongs. Offsetting each `<tr>`
               instead (which is what this did until 2026-08-13) forced
               `position: absolute` onto it, and an absolutely positioned
               element is never a `table-row` — its cells then sized themselves
               from their content instead of from the shared column tracks. -->
            <table
              class="{resolveSlotClass(
                tableStyles.table,
                styleConfig.slotClasses.table,
                styleConfig.unstyled,
                'table-fixed'
              )} absolute top-0 left-0 w-full"
              style="transform: translateY({virtualResult.startIndex * rowHeight}px);"
              role="presentation"
            >
              {@render columnTrackGroup()}
              <tbody
                class={resolveSlotClass(
                  tableStyles.body,
                  styleConfig.slotClasses.tbody,
                  styleConfig.unstyled
                )}
              >
                {#each virtualResult.virtualItems as vItem (vItem.index)}
                  {@const item = virtualItems[vItem.index]}
                  {#if item}
                    <TableRow
                      {item}
                      {expandable}
                      {expandedRowContent}
                      {cell}
                      {size}
                      {onRowClick}
                      rowIndex={vItem.index}
                      ariaRowStart={tableContext.pageInfo.rangeStart}
                      explicitRoles={true}
                    />
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>

          {#if hasSummary}
            <!-- `table-fixed` + the shared tracks, like its two siblings: without
               them this third table sized its columns from the summary values,
               so the totals sat under the wrong headers.

               Presentational WITHOUT explicit row roles, unlike the body: the
               summary row is not a navigable data row, so it stays out of the
               grid's row sequence. The standard branch has it implicitly
               inside the grid — a documented divergence until the #14 layout
               rework merges the three tables. -->
            <table
              class={resolveSlotClass(
                tableStyles.table,
                styleConfig.slotClasses.table,
                styleConfig.unstyled,
                'table-fixed'
              )}
              role="presentation"
            >
              {@render columnTrackGroup()}
              <tbody>
                <SummaryRow {expandable} {size} />
              </tbody>
            </table>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{:else}
  <!-- Standard mode: normal table rendering -->
  <div
    class={resolveSlotClass(
      tableStyles.scrollArea,
      styleConfig.slotClasses.scrollArea,
      styleConfig.unstyled,
      // The layout switch itself is declared once, next to its mobile half, in
      // `tableContainerVariants` — see the note there for why both literals live
      // in one place.
      [`relative ${tableStyles.desktopOnly()}`, scrollAreaOverflow].filter(Boolean).join(' ')
    )}
    data-table-layout="desktop"
    role="region"
    aria-label={tt('aria.tableData')}
    style="width: {tableDomWidth};"
  >
    <table
      bind:this={tableElement}
      class={resolveSlotClass(
        tableStyles.table,
        styleConfig.slotClasses.table,
        styleConfig.unstyled
      )}
      role={interactive ? 'grid' : undefined}
      aria-label={ariaLabel}
      aria-rowcount={tableContext.pageInfo.totalItems}
      onkeydown={handleTableKeyDown}
      data-testid="table-element"
    >
      {#if header}
        {@render header()}
      {:else}
        <TableHead {expandable} {enableColumnReorder} {size} />
      {/if}

      <tbody
        class={resolveSlotClass(
          tableStyles.body,
          styleConfig.slotClasses.tbody,
          styleConfig.unstyled
        )}
      >
        {#if tableState.loading}
          {#if loadingState}
            {@render loadingState()}
          {:else}
            <LoadingState text={loadingText} {size} colSpan={totalColSpan} />
          {/if}
        {:else if tableState.error}
          {#if errorState}
            {@render errorState()}
          {:else}
            <ErrorState
              title={errorText}
              message={tableState.error}
              {size}
              colSpan={totalColSpan}
            />
          {/if}
        {:else if tableState.effectiveGroupBy}
          {#if filteredItems.length === 0}
            {#if emptyState}
              {@render emptyState()}
            {:else}
              <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
            {/if}
          {:else}
            {#each Object.entries(grouped) as [groupName, groupItems], groupIndex (groupName)}
              <GroupedRow
                {groupName}
                items={groupItems}
                {expandable}
                {expandedRowContent}
                {cell}
                {size}
                {groupHeaderContent}
                {onRowClick}
                rowIndexOffset={groupRowOffsets[groupIndex]}
              />

              {#if hasSummary}
                <SummaryRow
                  {expandable}
                  {size}
                  {groupName}
                  groupSummaryData={groupedSummaryData[groupName]}
                />
              {/if}
            {/each}
          {/if}
        {:else if filteredItems.length === 0}
          {#if emptyState}
            {@render emptyState()}
          {:else}
            <EmptyState message={noDataText} {size} colSpan={totalColSpan} />
          {/if}
        {:else}
          {#if body}
            {@render body()}
          {:else}
            {#each paginatedItems as item, i (resolveRowItemId(item))}
              <TableRow
                {item}
                {expandable}
                {expandedRowContent}
                {cell}
                {size}
                {onRowClick}
                rowIndex={i}
                ariaRowStart={tableContext.pageInfo.rangeStart}
              />
            {/each}
          {/if}

          {#if hasSummary}
            <SummaryRow {expandable} {size} />
          {/if}
        {/if}
      </tbody>
    </table>
  </div>
{/if}
