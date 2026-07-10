<script lang="ts">
  import PaginationItem from './PaginationItem.svelte';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { paginationVariants } from '$lib/primitives';
  import type { PaginationVariants } from './pagination.variants';
  import { MediaQuery } from 'svelte/reactivity';
  import { computeEllipsisState, computeVisiblePageNumbers } from './pagination.engine';
  import type { PaginationProps } from '.';

  const bt = useBlocksI18n();

  let {
    currentPage,
    totalPages,
    onPageChange,
    layout = 'default',
    size = 'md',
    variant = 'outlined',
    intent = 'primary',
    tier,
    visiblePages = 7,
    showFirstLast = true,
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

  // Computed state helpers
  const isFirstPage = $derived(currentPage === 1);
  const isLastPage = $derived(currentPage === totalPages);
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
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
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
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasPreviousPage}
          onPageClick={goToPrevious}
          {mint}
        >
          {#if previousIcon}
            {@render previousIcon()}
          {:else}
            {previousLabel}
          {/if}
        </PaginationItem>

        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading || !hasNextPage}
          onPageClick={goToNext}
          {mint}
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
    <!-- Navigation Layout: Only Previous/Next -->
    <div
      class={unstyled
        ? (slotClasses?.controls ?? '')
        : styles.controls({ class: slotClasses?.controls })}
    >
      {#if showPreviousNext && hasPreviousPage}
        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToPrevious}
          {mint}
        >
          {#if previousIcon}
            {@render previousIcon()}
          {:else}
            {previousLabel}
          {/if}
        </PaginationItem>
      {/if}

      {#if showPreviousNext && hasNextPage}
        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToNext}
          {mint}
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
      {#if showFirstLast && !isFirstPage && showStartEllipsis}
        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToFirst}
          {mint}
        >
          {#if firstIcon}
            {@render firstIcon()}
          {:else}
            {firstLabel}
          {/if}
        </PaginationItem>
      {/if}

      {#if showPreviousNext && hasPreviousPage}
        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToPrevious}
          {mint}
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

      {#if showPreviousNext && hasNextPage}
        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToNext}
          {mint}
        >
          {#if nextIcon}
            {@render nextIcon()}
          {:else}
            {nextLabel}
          {/if}
        </PaginationItem>
      {/if}

      {#if showFirstLast && !isLastPage && showEndEllipsis}
        <PaginationItem
          {size}
          {variant}
          {intent}
          {tier}
          disabled={disabled || loading}
          onPageClick={goToLast}
          {mint}
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
