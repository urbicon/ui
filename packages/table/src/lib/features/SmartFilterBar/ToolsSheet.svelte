<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { findColumnById, resolveColumnLabel } from '$lib/utils';
  import { Accordion, AccordionItem, Badge, Button, Drawer } from '@urbicon-ui/blocks';
  import { SvelteSet } from 'svelte/reactivity';
  import { toolsSheetVariants } from '$lib/variants';
  import ColumnVisibilityPanel from './ColumnVisibilityPanel.svelte';
  import FilterPanel from './FilterPanel.svelte';
  import GroupingPanel from './GroupingPanel.svelte';
  import SortPanel from './SortPanel.svelte';
  import SummaryPanel from './SummaryPanel.svelte';

  /**
   * Every filter-bar tool as a section of one bottom sheet — the narrow bar's
   * answer to five tools that have nowhere to stand.
   *
   * ## Why a sheet and not a popover
   *
   * The bar used to fold its five triggers into a popover, and each of those
   * triggers opened a panel of its own: a `Select` listbox or the filter
   * popover, i.e. a second overlay inside the first. That construction has three
   * failure modes that are not implementation bugs and do not go away by fixing
   * one of them:
   *
   * 1. **The inner panel is clipped by the outer one.** A nested panel renders
   *    `position: absolute` (Popover's own contract for a panel inside a panel),
   *    and the outer popover is a `max-h` + `overflow-y-auto` box. Floating UI
   *    flips and shifts against the viewport, not against that scroll box, so
   *    the options land outside it.
   * 2. **The inner panel flips onto the outer one.** The trigger sits partway
   *    down a panel that already reaches the viewport edge, so there is no room
   *    below it, and the panel opens upward — over the thing it came from.
   * 3. **Two nested height caps and a keyboard.** Both panels cap themselves
   *    against the visual viewport. With the iOS keyboard open, that is a form
   *    inside a ~200px window inside a ~300px window.
   *
   * A sheet removes the nesting rather than tuning it. It is one modal surface
   * at full bar width, the tools are sections instead of triggers, and none of
   * the five opens an overlay: sort and grouping are radio lists, summary is one
   * radio row per column, visibility is checkboxes. The filter form keeps a
   * `Select` for the operator, and that one is fine — inside a modal `<dialog>`
   * `useFloatingPanel` renders it `position: fixed` in the dialog's own subtree
   * (the Codeberg #23 path), which escapes the body's scroll box instead of
   * being trapped by it.
   *
   * ## Why a Drawer and not a bare div
   *
   * Scroll lock, focus trap, Escape, backdrop and the `<dialog>` top layer are
   * all things a tools surface needs and all things `Drawer` already has. The
   * modal dialog is also what makes the operator `Select` above take the
   * in-place path — a hand-rolled sheet would not.
   */
  let {
    open = $bindable(false)
  }: {
    /** Whether the sheet is up. The bar owns this; the sheet only closes itself. */
    open?: boolean;
  } = $props();

  const tt = useTableI18n();

  const tableContext = getInternalTableContext();
  const { state: tableState, view: tableView } = tableContext;

  /**
   * Which section is unfolded. Local, and deliberately not reset on close: a
   * reader who opens the sheet twice in a row is almost always going back to the
   * same tool, and re-collapsing it every time turns that into two taps.
   */
  let openSection = $state('');

  /**
   * Sections that have been opened at least once, and therefore stay mounted.
   *
   * Collapsible keeps its children mounted while folded (it animates
   * `grid-template-rows` and marks the subtree `inert`), so without a guard
   * every section would compute from the moment the sheet opens — and
   * FilterPanel's quick-value lists walk every row of every column, which a
   * reader who only wants to sort should not pay for.
   *
   * Mounting on first open and keeping it means nothing is computed until it is
   * asked for, while a section that has been used survives being folded away —
   * so a half-typed filter is still there after a detour into sorting.
   *
   * It does NOT survive closing the sheet: Drawer drops its whole subtree when
   * it shuts, so `filterStates` goes with it. Persisting across that is a
   * separate decision (and would need the state to live above this component),
   * not something this guard quietly provides.
   */
  const mountedSections = new SvelteSet<string>();

  /** Touch contract for every row inside the sheet — see toolsSheetVariants. */
  const sheetStyles = toolsSheetVariants();

  function handleSectionChange(value: string | string[]) {
    const next = typeof value === 'string' ? value : (value[0] ?? '');
    openSection = next;
    if (next) mountedSections.add(next);
  }

  const filterCount = $derived(tableView.filters.length);
  // The aggregations in force, not the configured ones: `toggleSummary` is
  // public on the context, so a consumer can leave configs in place while the
  // summary row is off — and a badge counting aggregations that render nowhere
  // contradicts the button that opened this sheet. The condition itself is the
  // store's (#252); this used to be one of three hand-written copies, while
  // five other surfaces carried none.
  const summaryCount = $derived(tableContext.effectiveSummaryConfigs.length);
  const hiddenCount = $derived(tableContext.hiddenColumnKeys.size);

  // Sort and grouping are single-valued, so a count would forever read "1". The
  // section head carries the column NAME instead — which is the thing actually
  // lost when the section folds away.
  const sortLabel = $derived.by(() => {
    const sort = tableView.sort;
    if (!sort) return '';
    const column = findColumnById(tableState.columns, sort.column);
    const name = column ? resolveColumnLabel(column) : sort.column;
    const direction = sort.direction === 'desc' ? tt('sort.descending') : tt('sort.ascending');
    return `${name} · ${direction}`;
  });

  const groupLabel = $derived.by(() => {
    if (!tableState.effectiveGroupBy) return '';
    const column = findColumnById(tableState.columns, tableState.effectiveGroupBy);
    return column ? resolveColumnLabel(column) : tableState.effectiveGroupBy;
  });
</script>

{#snippet sectionHead(label: string, marker: string)}
  <span class="flex min-w-0 items-center gap-2">
    <span class="shrink-0">{label}</span>
    {#if marker}
      <!-- `soft` on the neutral surface, like every other counter in this bar:
           `filled` pairs `text-on-primary` with the solid feature colour, which
           measures under AA. `truncate` because the sort/group markers carry a
           column name, which has no length budget. -->
      <Badge variant="soft" size="xs" class="bg-surface-base text-primary-emphasis min-w-0">
        <span class="truncate">{marker}</span>
      </Badge>
    {/if}
  </span>
{/snippet}

{#snippet filterHead()}
  {@render sectionHead(tt('filter.button.add'), filterCount > 0 ? String(filterCount) : '')}
{/snippet}

{#snippet sortHead()}
  {@render sectionHead(tt('sort.button'), sortLabel)}
{/snippet}

{#snippet groupHead()}
  {@render sectionHead(tt('grouping.button'), groupLabel)}
{/snippet}

{#snippet summaryHead()}
  {@render sectionHead(tt('summary.button.title'), summaryCount > 0 ? String(summaryCount) : '')}
{/snippet}

{#snippet columnsHead()}
  {@render sectionHead(tt('columns.visibility'), hiddenCount > 0 ? String(hiddenCount) : '')}
{/snippet}

{#snippet footer()}
  <Button variant="filled" intent="primary" size="sm" onclick={() => (open = false)}>
    {tt('tools.done')}
  </Button>
{/snippet}

<!--
  `h-auto!` + `max-h-[85dvh]` instead of a fixed `size`: the sheet is as tall as
  the sections it is showing, so a fully collapsed accordion is five rows and not
  a half-empty slab. The `!` is required — slot classes merge after the variant
  but do not outrank it (the `size` compound sets `h-72` for `bottom`).

  `dvh`, not `vh`: on iOS `100vh` is the LARGE viewport height, i.e. taller than
  what is on screen while the URL bar is out.
-->
<Drawer
  bind:open
  placement="bottom"
  title={tt('tools.title')}
  {footer}
  slotClasses={{ panel: 'h-auto! max-h-[85dvh]' }}
>
  <Accordion type="single" collapsible value={openSection} onValueChange={handleSectionChange}>
    <AccordionItem value="filter" trigger={filterHead}>
      {#if mountedSections.has('filter')}
        <div class={sheetStyles.section()}>
          <FilterPanel surface="sheet" />
        </div>
      {/if}
    </AccordionItem>

    <AccordionItem value="sort" trigger={sortHead}>
      {#if mountedSections.has('sort')}
        <div class={sheetStyles.section()}>
          <SortPanel />
        </div>
      {/if}
    </AccordionItem>

    <!-- Grouping is unavailable while virtualized (see TableState.virtualized) -->
    {#if !tableState.virtualized}
      <AccordionItem value="group" trigger={groupHead}>
        {#if mountedSections.has('group')}
          <div class={sheetStyles.section()}>
            <GroupingPanel />
          </div>
        {/if}
      </AccordionItem>
    {/if}

    <AccordionItem value="summary" trigger={summaryHead}>
      {#if mountedSections.has('summary')}
        <div class={sheetStyles.section()}>
          <SummaryPanel />
        </div>
      {/if}
    </AccordionItem>

    {#if tableState.enableColumnVisibility}
      <AccordionItem value="columns" trigger={columnsHead}>
        {#if mountedSections.has('columns')}
          <div class={sheetStyles.section()}>
            <ColumnVisibilityPanel />
          </div>
        {/if}
      </AccordionItem>
    {/if}
  </Accordion>
</Drawer>
