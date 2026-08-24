<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { SUMMARY_TYPES } from '$lib/utils/summary-types';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Badge,
    Menu,
    resolveIcon,
    SquareSigmaIcon as SquareSigmaIconDefault,
    type MenuItemType
  } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';
  import { buildSummaryEntries, toolColumnScope, toolEmptyKey } from './tool-columns';

  const tt = useTableI18n();

  const SquareSigmaIcon = resolveIcon('squareSigma', SquareSigmaIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, addSummaryConfig, removeSummaryConfig } = tableContext;

  // Two questions, two sources — the split is documented on useSummary, and
  // this is the component where the line is easiest to misread, because both
  // sides of it live here.
  //
  // The trigger is not this menu's value; it is the BAR's activity indicator
  // for the summary tool — the same role the narrow bar's tool count plays one
  // breakpoint away, and it counts what is acting on the grid. It used to read
  // the raw list and stayed lit with a badge reading "2" while
  // `toggleSummary()` had the summary row hidden and that very tool count said
  // 0 (#252). Going quiet misstates nothing: the lit ground and the counter are
  // omissions, and `active` on a Button renders no `aria-pressed` that could be
  // left behind saying "off".
  const effectiveSummaries = $derived(tableState.effectiveSummaryConfigs);
  // The radio rows below are the CONTROL: what each column is configured to
  // aggregate, which outlives the row being hidden. Same reading as the column
  // menu's submenu (HeaderMenu carries the full decision) and as the tools
  // sheet's panel; the sheet's section badge is a count, so it goes with the
  // trigger instead.
  const configuredSummaries = $derived(tableState.summaryConfigs);
  const isActive = $derived(effectiveSummaries.length > 0);
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'summary' }) : undefined
  );

  // Capability follows configuration, never the column's name — see
  // utils/column-capabilities.ts for what that replaced and why. A column
  // already carrying a configuration keeps its group after being hidden
  // (#253), which is the same list the sheet's SummaryPanel builds.
  const summableEntries = $derived(
    buildSummaryEntries(
      toolColumnScope(tableState),
      configuredSummaries.map((config) => config.column)
    )
  );

  // The axis's own empty-state answer (#254) — the same one SummaryPanel shows
  // as a sentence. This trigger disabled itself on an inline length check and
  // left the reader with a dead glyph and no reason for it.
  const emptyKey = $derived(toolEmptyKey('summary', summableEntries));

  // One `role="group"` per summable column (the section header names it),
  // six `menuitemradio` rows inside: None + the five vocabulary types. The
  // store keeps at most one aggregation per column, so a checked radio is
  // the shape of the state itself, and `onSelect` carries column and type
  // as values — no string compound to parse back apart (#251).
  const menuItems = $derived.by<MenuItemType[]>(() =>
    summableEntries.flatMap((entry) => {
      const columnId = entry.id;
      const current = configuredSummaries.find((config) => config.column === columnId)?.type;
      // Explicit `id`s: Menu's resolveId otherwise falls back to the flat
      // render index (the index-as-key anti-pattern). `-` as the joiner:
      // the id is an opaque key, never parsed back apart.
      return [
        { type: 'section' as const, label: entry.label },
        {
          id: `${columnId}-none`,
          label: tt('summary.none'),
          checked: current === undefined,
          onSelect: () => removeSummaryConfig(columnId)
        },
        ...SUMMARY_TYPES.map((type) => ({
          id: `${columnId}-${type.value}`,
          label: `${type.glyph} ${tt(type.labelKey)}`,
          checked: current === type.value,
          onSelect: () => addSummaryConfig({ column: columnId, type: type.value })
        }))
      ];
    })
  );
</script>

{#snippet triggerIcon()}
  <SquareSigmaIcon class="h-4 w-4" />
{/snippet}

{#snippet triggerCounter()}
  {#if isActive}
    <!-- `soft`, not `filled` + a class override: the override only replaced
         `bg-*`/`text-*`, so the filled/primary compound's `border-primary`
         survived the fold and drew a stray light ring — visible on every
         route that rescopes `--color-primary`. `soft` also drops the
         `text-on-primary` coupling, which measured 3.7:1 on the solid green.
         The ground is the neutral surface because the lit trigger behind it
         now carries `summary-subtle` itself. -->
    <Badge variant="soft" size="xs" counter class="bg-surface-base text-summary-emphasis ml-1">
      {effectiveSummaries.length}
    </Badge>
  {/if}
{/snippet}

<!-- `disabled` also refuses the ArrowDown below — this trigger's `onkeydown`
     opens the menu, and MenuTrigger stops calling it while the tool is empty,
     so `Menu.toggle`'s own guard is what covers a stray call. The Selects next
     door lean on the same flag for arrow keys they never see (see SortMenu). -->
<Menu items={menuItems} syncWidth={false} itemSize="sm" disabled={emptyKey !== null}>
  {#snippet customTrigger(toggle, open)}
    <MenuTrigger
      label={tt('summary.button.title')}
      active={isActive}
      {triggerClass}
      expanded={open}
      haspopup="menu"
      unavailable={emptyKey ? tt(emptyKey) : undefined}
      icon={triggerIcon}
      counter={triggerCounter}
      onclick={toggle}
      onkeydown={(e: KeyboardEvent) => {
        // APG menu button: ArrowDown on the closed trigger opens the menu —
        // a customTrigger has to repeat what Menu's default trigger does.
        // The stop keeps an opening key out of whatever hosts the bar.
        if (e.key === 'ArrowDown' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }
      }}
    />
  {/snippet}
</Menu>
