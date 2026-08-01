<script lang="ts">
  import { untrack } from 'svelte';
  import { getTableContext, useTableI18n } from '$lib';
  import {
    Badge,
    Button,
    Input,
    Popover,
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

  // ── Narrow bar → one tool button instead of a five-icon capsule ──────────
  //
  // Stacked, the capsule sat under the search field as a shrink-wrapped block
  // with nothing to align to — it read as a stray object rather than a part of
  // the bar, and it cost a whole row on the screen with the least of them. Below
  // the threshold the five triggers therefore move INTO a popover on a single
  // button beside the search field.
  //
  // Measured, not guessed at from the viewport: the bar is the thing that runs
  // out of room (it can sit in a card, a drawer, a split pane), which is the
  // same reason `layout` has a `responsive` mode driven by `@container`. Only
  // that mode switches — `horizontal` and `vertical` are explicit instructions.
  //
  // The five menus keep their own triggers and their own panels; nesting works
  // because Popover is native top-layer and NOT portalled, so an inner panel is
  // a DOM descendant of the outer one and the light-dismiss chain treats them as
  // one unit (the operator `Select` inside FilterMenu already relies on this).
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

  // The popover only exists in the compact branch, and unmounting it does not
  // write `open` back — so a bar that grows past the threshold with the panel
  // open would re-open it, unprompted, the moment it narrows again (rotate a
  // phone twice). Closing on the way out also keeps focus from being stranded
  // on a removed panel.
  $effect(() => {
    if (!compact) toolsOpen = false;
  });

  // What the closed tool button has to say for itself: with the panel shut, the
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

{#snippet toolsTrigger()}
  <Button
    variant="ghost"
    intent="neutral"
    size="sm"
    active={activeToolCount > 0}
    class={filterBarStyles.toolsTrigger()}
    aria-label={activeToolCount > 0
      ? tt('aria.toolsActive', { count: String(activeToolCount) })
      : tt('aria.tools')}
    aria-expanded={toolsOpen}
  >
    <SettingsIcon class="h-4 w-4" />
    {#if activeToolCount > 0}
      <!-- The lit triggers are behind a closed door; the count is what is left
           to say that the grid is not showing everything there is. -->
      <Badge variant="soft" size="xs" counter class="bg-surface-base text-primary-emphasis">
        {activeToolCount}
      </Badge>
    {/if}
  </Button>
{/snippet}

{#snippet tools()}
  <FilterMenu stacked={compact} />
  <SortMenu stacked={compact} />
  <!-- Grouping is unavailable while virtualized (see TableState.virtualized) -->
  {#if !tableState.virtualized}
    <GroupingMenu stacked={compact} />
  {/if}
  <SummaryMenu stacked={compact} />
  {#if tableState.enableColumnVisibility}
    <!--
      The rule splits the two jobs in the capsule: everything left of it
      changes WHICH rows/values the grid shows, the eye changes only what is
      on screen. Explicit height because Separator's own `h-full` resolves
      against an auto-height flex row — i.e. to nothing.
    -->
    <Separator orientation={compact ? 'horizontal' : 'vertical'} class={filterBarStyles.rule()} />
    <ColumnVisibilityMenu stacked={compact} />
  {/if}
{/snippet}

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
        No `onclick` on the trigger: Popover owns the open/close of the element
        it is handed (same as FilterMenu's) — a second toggle here would fire
        alongside it and the panel would open and shut in the same tick.
      -->
      <Popover
        bind:open={toolsOpen}
        placement="bottom-end"
        offsetDistance={8}
        onClickOutside={() => (toolsOpen = false)}
        trigger={toolsTrigger}
        role="dialog"
      >
        <!--
          The same five components, stacked. They keep their own triggers and
          panels — this popover only gives them a place to stand.
        -->
        <div class={filterBarStyles.toolsPanel()}>
          {@render tools()}
        </div>
      </Popover>
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
        {@render tools()}
      </Toolbar>
    {/if}
  </div>

  <div class={filterBarStyles.chipsSection()}>
    <ChipsField />
  </div>
</div>
