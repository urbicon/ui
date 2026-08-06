<script lang="ts">
  import { untrack } from 'svelte';
  import { useTableI18n } from '$lib';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import {
    Badge,
    Button,
    Input,
    Separator,
    Toolbar,
    resolveIcon,
    SearchIcon as SearchIconDefault,
    SettingsIcon as SettingsIconDefault
  } from '@urbicon-ui/blocks';

  const SearchIcon = resolveIcon('search', SearchIconDefault);
  const SettingsIcon = resolveIcon('settings', SettingsIconDefault);
  import { smartFilterBarVariants, type SmartFilterBarVariantProps } from '$lib/variants';
  import ChipsField from './ChipsField.svelte';
  import ColumnVisibilityMenu from './ColumnVisibilityMenu.svelte';
  import FilterMenu from './FilterMenu.svelte';
  import GroupingMenu from './GroupingMenu.svelte';
  import SortMenu from './SortMenu.svelte';
  import SummaryMenu from './SummaryMenu.svelte';
  import ToolsSheet from './ToolsSheet.svelte';
  import { getTableStyleConfig, resolveSlotClass } from '$lib/core/table-style-context';

  const tt = useTableI18n();

  // Store-Kontext abrufen
  const tableContext = getInternalTableContext();
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

  // ── Narrow bar → the tools move into a sheet ─────────────────────────────
  //
  // Stacked, the five-icon capsule sat under the search field as a shrink-wrapped
  // block with nothing to align to, and it cost a whole row on the screen with
  // the least of them. Below the threshold the tools therefore leave the bar
  // entirely and become sections of one bottom sheet (see ToolsSheet, which
  // documents why a sheet and not the popover this used to be).
  //
  // Measured, not guessed at from the viewport: the bar is the thing that runs
  // out of room (it can sit in a card, a drawer, a split pane), which is the
  // same reason `layout` has a `responsive` mode driven by `@container`. Only
  // that mode switches — `horizontal` and `vertical` are explicit instructions.
  let barElement = $state<HTMLDivElement>();
  let compact = $state(false);
  let toolsOpen = $state(false);

  // 28rem — the same step `@md` uses for the row/stack switch in the variants,
  // so the capsule never exists in a layout narrow enough to strand it.
  const COMPACT_MAX_WIDTH = 28 * 16;

  $effect(() => {
    const el = barElement;
    if (!el || layout !== 'responsive') {
      compact = false;
      return;
    }
    // The CONTENT box, which is what `@container` queries measure — `clientWidth`
    // includes the container's own padding (`p-3` at size `md`), so measuring
    // that left a 24px band where neither this switch nor `@md:flex-row` fired
    // and the capsule sat stranded under the search field again: exactly the
    // state the compact mode exists to remove.
    const measure = (entry?: ResizeObserverEntry) => {
      const width =
        entry?.contentBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width ?? contentWidth(el);
      compact = width > 0 && width < COMPACT_MAX_WIDTH;
    };
    const ro = new ResizeObserver(([entry]) => measure(entry));
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  });

  function contentWidth(el: HTMLElement): number {
    const cs = getComputedStyle(el);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    return el.clientWidth - padX;
  }

  // The sheet only exists in the compact branch, and unmounting it does not
  // write `open` back — so a bar that grows past the threshold with the sheet
  // up would re-open it, unprompted, the moment it narrows again (rotate a
  // phone twice). Closing on the way out also keeps focus from being stranded
  // on a removed dialog.
  $effect(() => {
    if (!compact) toolsOpen = false;
  });

  // What the closed tool button has to say for itself: with the sheet shut, the
  // lit triggers inside it are invisible, so the count of what is currently
  // acting on the grid rides on the button. Column visibility counts too — a
  // hidden column changes what the reader sees.
  const activeToolCount = $derived(
    (tableState.activeFilters.length > 0 ? 1 : 0) +
      (tableState.sortColumn ? 1 : 0) +
      (tableState.groupByKey ? 1 : 0) +
      (tableState.showSummary && tableState.summaryConfigs.length > 0 ? 1 : 0) +
      (tableContext.hiddenColumnKeys.size > 0 ? 1 : 0)
  );

  // Tailwind-Variants Styling
  const filterBarStyles = $derived(
    smartFilterBarVariants({
      size,
      layout,
      elevated: responsive,
      variant: styleConfig.variant,
      compact
    })
  );
</script>

<div
  bind:this={barElement}
  class={resolveSlotClass(
    filterBarStyles.container,
    styleConfig.slotClasses.filterBar,
    styleConfig.unstyled,
    className
  )}
>
  <div class={filterBarStyles.controls()}>
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

    {#if compact}
      <!--
        A plain button owning its own state, not a Popover trigger: the sheet is
        a modal `<dialog>` and opens by being told to, so there is no light
        dismiss to coordinate with and no reason to route the click through an
        overlay primitive.
      -->
      <Button
        variant="ghost"
        intent="neutral"
        size="sm"
        active={activeToolCount > 0}
        class={filterBarStyles.toolsTrigger()}
        aria-label={activeToolCount > 0
          ? tt('aria.toolsActive', { count: String(activeToolCount) })
          : tt('aria.tools')}
        aria-haspopup="dialog"
        aria-expanded={toolsOpen}
        onclick={() => (toolsOpen = true)}
      >
        <SettingsIcon class="h-4 w-4" />
        {#if activeToolCount > 0}
          <!-- The lit triggers are behind a closed door; the count is what is
               left to say that the grid is not showing everything there is. -->
          <Badge variant="soft" size="xs" counter class="bg-surface-base text-primary-emphasis">
            {activeToolCount}
          </Badge>
        {/if}
      </Button>

      <ToolsSheet bind:open={toolsOpen} />
    {:else}
      <!--
        `quiet` (the Toolbar default), not `ghost`: the five icon triggers are one
        control surface, and without a ground of their own they read as loose
        glyphs floating beside the search field.
      -->
      <Toolbar
        aria-label={tt('aria.filterBar')}
        gap="xs"
        padding="xs"
        class={filterBarStyles.actionsSection()}
      >
        <FilterMenu />
        <SortMenu />
        <!-- Grouping is unavailable while virtualized (see TableState.virtualized) -->
        {#if !tableState.virtualized}
          <GroupingMenu />
        {/if}
        <SummaryMenu />
        {#if tableState.enableColumnVisibility}
          <!--
            The rule splits the two jobs in the capsule: everything left of it
            changes WHICH rows/values the grid shows, the eye changes only what is
            on screen. Explicit height because Separator's own `h-full` resolves
            against an auto-height flex row — i.e. to nothing.
          -->
          <Separator orientation="vertical" class={filterBarStyles.rule()} />
          <ColumnVisibilityMenu />
        {/if}
      </Toolbar>
    {/if}
  </div>

  <div class={filterBarStyles.chipsSection()}>
    <ChipsField />
  </div>
</div>
