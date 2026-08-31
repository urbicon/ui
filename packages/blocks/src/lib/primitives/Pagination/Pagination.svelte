<script lang="ts">
  import PaginationItem from './PaginationItem.svelte';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { paginationVariants } from '$lib/primitives';
  import type { PaginationVariants } from './pagination.variants';
  import { MediaQuery } from 'svelte/reactivity';
  import { resolveClassChain } from '$lib/utils/variants';
  import { computeEllipsisState, computeVisiblePageNumbers } from './pagination.engine';
  import type { PaginationProps } from '.';

  const bt = useBlocksI18n();

  let {
    currentPage,
    totalPages,
    onPageChange,
    layout = 'default',
    size = 'md',
    // `ghost`, not `outlined`: a page window is up to nine buttons in a row, and
    // nine outlined pills are noise the moment ONE of them can stand out. That
    // became possible only with the `pressed` → `active` fix in PaginationItem —
    // before it, no entry had a visible state at all, and the outlines were the
    // only thing giving the bar a shape. Table has always passed `variant="ghost"`
    // for exactly this reason; the default now matches the practice.
    variant = 'ghost',
    intent = 'primary',
    tier,
    visiblePages = 7,
    // Undefaulted so the DEV no-op warning below can tell an explicit
    // `showFirstLast` from the default; `showFirstLast` itself (derived) keeps
    // the documented `true` default for every render-path consumer.
    showFirstLast: showFirstLastProp,
    showPreviousNext = true,
    showNumbers = true,
    showInfo = false,
    previousLabel = bt('pagination.previous'),
    nextLabel = bt('pagination.next'),
    firstLabel = bt('pagination.first'),
    lastLabel = bt('pagination.last'),
    pageLabel = bt('pagination.page'),
    infoText,
    previousIcon,
    nextIcon,
    firstIcon,
    lastIcon,
    renderItem,
    itemsPerPage = 10,
    totalItems,
    startItem,
    endItem,
    disabled = false,
    loading = false,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: PaginationProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const showFirstLast = $derived(showFirstLastProp ?? true);

  // DEV fail-loud: First/Last are redundancy-gated to the number window (they
  // render only beside a start/end ellipsis), so with `showNumbers={false}` an
  // explicitly-set `showFirstLast` is a silent no-op. Surface that once per
  // instance — the coupling itself is a settled decision (see the
  // `showFirstLast` JSDoc), only its silence was the bug. Plain flag, not
  // `$state`: the warn must not feed back into the reactive graph.
  let warnedFirstLastWithoutNumbers = false;
  $effect(() => {
    if (
      import.meta.env?.DEV &&
      !warnedFirstLastWithoutNumbers &&
      showFirstLastProp === true &&
      !showNumbers
    ) {
      warnedFirstLastWithoutNumbers = true;
      console.warn(
        '[Pagination] showFirstLast has no effect while showNumbers is false — First/Last only render beside the number window’s ellipsis. Drop showFirstLast or re-enable showNumbers.'
      );
    }
  });

  const variantProps: PaginationVariants = $derived({
    layout,
    size,
    disabled,
    loading
  });

  const styles = $derived(paginationVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Pagination', preset, variantProps, slotClassesProp)
  );

  // Calculate pagination info for table layout
  const calculatedStartItem = $derived.by(() => {
    if (startItem !== undefined) return startItem;
    return (currentPage - 1) * itemsPerPage + 1;
  });

  const calculatedEndItem = $derived.by(() => {
    if (endItem !== undefined) return endItem;
    const end = currentPage * itemsPerPage;
    return totalItems ? Math.min(end, totalItems) : end;
  });

  const calculatedTotalItems = $derived.by(() => {
    if (totalItems !== undefined) return totalItems;
    return totalPages * itemsPerPage;
  });

  // On narrow viewports (< sm breakpoint) cap the page numbers to keep the bar
  // from overflowing. MediaQuery (svelte/reactivity) is instantiated per
  // component instance, unlike svelte/reactivity/window's module-global
  // singletons – which avoids a circular module-init crash when a downstream
  // app bundles this component (see Sidebar/SidebarLayout for the same pattern).
  const isCompactViewport = new MediaQuery('(max-width: 639px)');
  const effectiveVisiblePages = $derived(
    isCompactViewport.current ? Math.min(visiblePages, 3) : visiblePages
  );

  const visiblePageNumbers = $derived(
    showNumbers
      ? computeVisiblePageNumbers({
          currentPage,
          totalPages,
          visiblePages: effectiveVisiblePages
        })
      : []
  );

  const ellipsis = $derived(computeEllipsisState({ visiblePageNumbers, totalPages, showNumbers }));
  const showStartEllipsis = $derived(ellipsis.showStart);
  const showEndEllipsis = $derived(ellipsis.showEnd);

  // Mint is forwarded to individual PaginationItems (which wrap Button),
  // not applied to the container – avoids a distracting double-animation.

  // Handle page change
  function handlePageChange(page: number) {
    if (disabled || loading || page === currentPage || page < 1 || page > totalPages) {
      return;
    }

    onPageChange?.(page);
  }

  // Navigation handlers
  function goToFirst() {
    handlePageChange(1);
  }

  function goToPrevious() {
    handlePageChange(currentPage - 1);
  }

  function goToNext() {
    handlePageChange(currentPage + 1);
  }

  function goToLast() {
    handlePageChange(totalPages);
  }

  function goToPage(page: number) {
    return () => handlePageChange(page);
  }

  // Computed state helpers. Edge policy across all layouts is disabled-but-visible:
  // Previous/Next stay mounted and go `disabled` at page 1 / N (never unmounted),
  // so the arrow can't vanish from under the pointer (no layout shift, no focus
  // loss). First/Last are a separate, redundancy-driven concern — see the markup.
  const hasPreviousPage = $derived(currentPage > 1);
  const hasNextPage = $derived(currentPage < totalPages);

  // Format info text
  const formattedInfoText = $derived.by(() => {
    if (infoText) return infoText;

    if (layout === 'table') {
      return bt('pagination.rangeInfo', {
        start: calculatedStartItem,
        end: calculatedEndItem,
        total: calculatedTotalItems
      });
    }

    return bt('pagination.pageInfo', {
      label: pageLabel,
      current: currentPage,
      total: totalPages
    });
  });
</script>

<nav
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={bt('accessibility.pagination')}
  {...restProps}
>
  {#if layout === 'table'}
    <!-- Table Layout: Info + Navigation -->
    <div class={unstyled ? (slotClasses?.info ?? '') : styles.info({ class: slotClasses?.info })}>
      <span>
        {formattedInfoText}
      </span>
    </div>

    <div
      class={unstyled
        ? (slotClasses?.controls ?? '')
        : styles.controls({ class: slotClasses?.controls })}
    >
      {#if showPreviousNext}
        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasPreviousPage}
          onPageClick={goToPrevious}
          {mint}
          aria-label={previousIcon ? previousLabel : undefined}
        >
          {#if previousIcon}
            {@render previousIcon()}
          {:else}
            {previousLabel}
          {/if}
        </PaginationItem>

        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasNextPage}
          onPageClick={goToNext}
          {mint}
          aria-label={nextIcon ? nextLabel : undefined}
        >
          {#if nextIcon}
            {@render nextIcon()}
          {:else}
            {nextLabel}
          {/if}
        </PaginationItem>
      {/if}
    </div>
  {:else if layout === 'navigation'}
    <!-- Navigation Layout: Only Previous/Next. Unified edge policy (matches the
         table layout): both arrows stay mounted and go `disabled` at the boundary
         (page 1 / N) rather than unmounting. This row is laid out `justify-between`,
         so unmounting one arm would teleport the survivor across the whole bar
         (start ↔ end) and drop focus — disabled-but-visible pins Previous left and
         Next right. Prev/Next-only pagers therefore grey out the dead end here;
         they do not disappear it. -->
    <div
      class={unstyled
        ? (slotClasses?.controls ?? '')
        : styles.controls({ class: slotClasses?.controls })}
    >
      {#if showPreviousNext}
        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasPreviousPage}
          onPageClick={goToPrevious}
          {mint}
          aria-label={previousIcon ? previousLabel : undefined}
        >
          {#if previousIcon}
            {@render previousIcon()}
          {:else}
            {previousLabel}
          {/if}
        </PaginationItem>

        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasNextPage}
          onPageClick={goToNext}
          {mint}
          aria-label={nextIcon ? nextLabel : undefined}
        >
          {#if nextIcon}
            {@render nextIcon()}
          {:else}
            {nextLabel}
          {/if}
        </PaginationItem>
      {/if}
    </div>
  {:else if layout === 'minimal'}
    <!-- Minimal Layout: Just page info -->
    <div class={unstyled ? (slotClasses?.info ?? '') : styles.info({ class: slotClasses?.info })}>
      <span>
        {formattedInfoText}
      </span>
    </div>
  {:else}
    <!-- Default Layout: Full pagination -->
    <div
      class={unstyled
        ? (slotClasses?.controls ?? '')
        : styles.controls({ class: slotClasses?.controls })}
    >
      <!-- First / Last are gated by the ellipsis — by REDUNDANCY, not by the page
           edge. `showStartEllipsis` is true only when page 1 sits OUTSIDE the visible
           window; the moment it re-enters, page 1 is a directly-clickable number and
           a "First" jump button would merely duplicate it. That predicate already
           implies currentPage > 1, so (unlike Previous/Next) First/Last are never a
           dead-end control needing disabled-but-visible: hiding one drops a duplicate,
           not an edge stepper — no layout-shift/focus trap. -->
      {#if showFirstLast && showStartEllipsis}
        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToFirst}
          {mint}
          aria-label={firstIcon ? firstLabel : undefined}
        >
          {#if firstIcon}
            {@render firstIcon()}
          {:else}
            {firstLabel}
          {/if}
        </PaginationItem>
      {/if}

      {#if showPreviousNext}
        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasPreviousPage}
          onPageClick={goToPrevious}
          {mint}
          aria-label={previousIcon ? previousLabel : undefined}
        >
          {#if previousIcon}
            {@render previousIcon()}
          {:else}
            {previousLabel}
          {/if}
        </PaginationItem>
      {/if}

      {#if showStartEllipsis}
        <div
          class={unstyled
            ? (slotClasses?.ellipsis ?? '')
            : styles.ellipsis({ class: slotClasses?.ellipsis })}
        >
          ...
        </div>
      {/if}

      {#if showNumbers}
        {#each visiblePageNumbers as page (page)}
          {#if renderItem}
            {@render renderItem({
              page,
              active: page === currentPage,
              disabled: disabled || loading,
              size,
              variant,
              intent,
              tier,
              mint,
              select: goToPage(page)
            })}
          {:else}
            <PaginationItem
              {unstyled}
              {size}
              {variant}
              {intent}
              {tier}
              {page}
              active={page === currentPage}
              disabled={disabled || loading}
              onPageClick={goToPage(page)}
              {mint}
            >
              {page}
            </PaginationItem>
          {/if}
        {/each}
      {/if}

      {#if showEndEllipsis}
        <div
          class={unstyled
            ? (slotClasses?.ellipsis ?? '')
            : styles.ellipsis({ class: slotClasses?.ellipsis })}
        >
          ...
        </div>
      {/if}

      {#if showPreviousNext}
        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasNextPage}
          onPageClick={goToNext}
          {mint}
          aria-label={nextIcon ? nextLabel : undefined}
        >
          {#if nextIcon}
            {@render nextIcon()}
          {:else}
            {nextLabel}
          {/if}
        </PaginationItem>
      {/if}

      <!-- See the First-button note above: ellipsis-gated (redundancy), not edge-gated. -->
      {#if showFirstLast && showEndEllipsis}
        <PaginationItem
          {unstyled}
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToLast}
          {mint}
          aria-label={lastIcon ? lastLabel : undefined}
        >
          {#if lastIcon}
            {@render lastIcon()}
          {:else}
            {lastLabel}
          {/if}
        </PaginationItem>
      {/if}
    </div>
  {/if}

  {#if showInfo && layout !== 'table' && layout !== 'minimal'}
    <div class={unstyled ? (slotClasses?.info ?? '') : styles.info({ class: slotClasses?.info })}>
      <span>
        {formattedInfoText}
      </span>
    </div>
  {/if}
</nav>
