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
    SlidersHorizontalIcon as SlidersHorizontalIconDefault
  } from '@urbicon-ui/blocks';

  const SearchIcon = resolveIcon('search', SearchIconDefault);
  // Sliders, not the gear it used to be: the button opens filtering, sorting,
  // grouping, summaries and column visibility — how this view is tuned. A gear
  // is the glyph for configuring the application, which is a different promise
  // and the one every other product reserves it for.
  const ToolsIcon = resolveIcon('slidersHorizontal', SlidersHorizontalIconDefault);
  import {
    smartFilterBarTriggerVariants,
    smartFilterBarVariants,
    type SmartFilterBarVariantProps
  } from '$lib/variants';
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
  const { state: tableState, view: tableView, setSearch } = tableContext;
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
  let localSearch = $state(tableView.search);
  let debounceTimer = $state<number | null>(null);

  // Sync store → local (e.g. when the store is changed programmatically)
  $effect(() => {
    const storeValue = tableView.search;
    if (storeValue !== untrack(() => localSearch)) {
      localSearch = storeValue;
    }
  });

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    localSearch = target.value;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      setSearch(localSearch);
    }, debounceMs) as unknown as number;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && localSearch) {
      localSearch = '';
      if (debounceTimer) clearTimeout(debounceTimer);
      setSearch('');
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
  let controlsElement = $state<HTMLDivElement>();
  let compact = $state(false);
  let toolsOpen = $state(false);

  // The threshold is NOT here. It is the `@md` step on the bar's own container,
  // declared once beside the row/stack switch it has to agree with
  // (`smartFilterBarVariants.controls`); this only reads which side of it the
  // bar is on, off the custom property that rule sets. Comparing a measured px
  // width against a hardcoded `28 * 16` was the same threshold a second time, in
  // a second unit, and the two parted company at any root font size but 16px
  // (#133).
  //
  // The ResizeObserver stays, but as a *when to look*, not a *what to compare*:
  // a container query re-evaluates without telling anyone, so something has to
  // notice the box changed. Its callback runs after layout and before paint, so
  // the computed value it reads is the current one.
  $effect(() => {
    const probe = controlsElement;
    if (!probe || layout !== 'responsive') {
      compact = false;
      return;
    }
    const read = () => {
      compact = getComputedStyle(probe).getPropertyValue('--blocks-table-tools').trim() === 'sheet';
    };
    const ro = new ResizeObserver(read);
    // The container is the bar, so that is the box whose size decides.
    if (barElement) ro.observe(barElement);
    read();
    return () => ro.disconnect();
  });

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
    (tableView.filters.length > 0 ? 1 : 0) +
      (tableView.sort ? 1 : 0) +
      (tableState.effectiveGroupBy ? 1 : 0) +
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
      compact,
      toolsActive: activeToolCount > 0
    })
  );

  // The lit look of the five capsule triggers, applied to the sixth — the same
  // construction `SummaryMenu` and friends use for their own `triggerClass`.
  //
  // Without it the button keeps Button's `active` + `ghost` compound, which adds
  // `ring-1 ring-inset` on top of the subtle ground. That ring is right where it
  // was written for — a ghost button lit on `surface-base`, where the subtle
  // tone alone is too faint to read (BGR-2) — and wrong here: inside the
  // toolbar's own `surface-quiet` capsule it is the redundant chrome
  // `smartFilterBarTriggerVariants` exists to strip, which is why the other five
  // do not have it. Moving this button into the capsule without also giving it
  // the capsule's lit treatment left it as the only trigger in the bar still
  // drawing an outline.
  //
  // `primary` is the hue for a tool with no feature ramp of its own (sort and
  // column visibility take it too); this button speaks for all five.
  const toolsTriggerClass = $derived(
    [
      filterBarStyles.toolsTrigger(),
      activeToolCount > 0 ? smartFilterBarTriggerVariants({ intent: 'primary' }) : ''
    ]
      .filter(Boolean)
      .join(' ')
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
  <div bind:this={controlsElement} class={filterBarStyles.controls()}>
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
        The same `Toolbar` the wide bar uses, holding one button instead of five
        — but `variant="ghost"`, which is the only difference between the two
        modes and the whole point of using it here.

        What the toolbar is for at this width is the two things `ghost` keeps:
        `tier="modify"` through TierContext (outside it, the Button default
        `tier="commit"` made a 44px pill beside a 40px search field and its own
        32px siblings), and the `actionsSection` touch floor. What `ghost` drops
        is the `surface-quiet` ground, because grouping is the one job a toolbar
        around a SINGLE control does not have — and an unearned ground is not
        neutral: it read as a pale frame around the button, invisible while the
        button was transparent and a second rounded rect the moment it lit up.
        The ground moved onto the button itself (`toolsActive` in the variants),
        so there is exactly one at every state.

        A plain Button owning its own state, not a Popover trigger: the sheet is
        a modal `<dialog>` and opens by being told to, so there is no light
        dismiss to coordinate with and no reason to route the click through an
        overlay primitive. No `Tooltip` either, unlike the five — they need one
        because they are five undifferentiated glyphs; one glyph with an
        `aria-label` is not.
      -->
      <Toolbar
        aria-label={tt('aria.filterBar')}
        variant="ghost"
        gap="xs"
        padding="xs"
        class={filterBarStyles.actionsSection()}
      >
        <Button
          variant="ghost"
          intent="neutral"
          size="sm"
          active={activeToolCount > 0}
          class={toolsTriggerClass}
          aria-label={activeToolCount > 0
            ? tt('aria.toolsActive', { count: String(activeToolCount) })
            : tt('aria.tools')}
          aria-haspopup="dialog"
          aria-expanded={toolsOpen}
          onclick={() => (toolsOpen = true)}
          data-testid="tools-trigger"
        >
          <ToolsIcon class="h-4 w-4" />
          {#if activeToolCount > 0}
            <!-- The lit triggers are behind a closed door; the count is what is
                 left to say that the grid is not showing everything there is.
                 Ground and hue exactly as the five siblings phrase it (see
                 SummaryMenu for why `soft` + a neutral ground rather than
                 `filled`); `primary` because this button speaks for all five. -->
            <Badge variant="soft" size="xs" counter class="bg-surface-base text-primary-emphasis">
              {activeToolCount}
            </Badge>
          {/if}
        </Button>
      </Toolbar>

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
