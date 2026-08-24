<script lang="ts">
  import { useTableI18n } from '$lib';
  import { getInternalTableContext } from '$lib/stores/TableStore.svelte';
  import { isColumnSummable } from '$lib/utils/column-capabilities';
  import { SUMMARY_TYPES } from '$lib/utils/summary-types';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Badge,
    Menu,
    resolveIcon,
    SquareSigmaIcon as SquareSigmaIconDefault,
    type MenuItemType
  } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';

  const tt = useTableI18n();

  const SquareSigmaIcon = resolveIcon('squareSigma', SquareSigmaIconDefault);

  const tableContext = getInternalTableContext();
  const { state: tableState, addSummaryConfig, removeSummaryConfig } = tableContext;

  // Two questions, two sources — see useSummary. The trigger and its counter
  // claim summaries are ACTING on the grid, so they read the aggregations in
  // force; they used to read the raw list and stayed lit with a badge reading
  // "2" while `toggleSummary()` had the summary row hidden and this same bar's
  // tool count said 0 (#252).
  const effectiveSummaries = $derived(tableContext.effectiveSummaryConfigs);
  // The radio rows are this control's own value: what each column is
  // CONFIGURED to aggregate, which survives the row being hidden.
  const configuredSummaries = $derived(tableState.summaryConfigs);
  const isActive = $derived(effectiveSummaries.length > 0);
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'summary' }) : undefined
  );

  // Capability follows configuration, never the column's name — see
  // utils/column-capabilities.ts for what that replaced and why.
  const summableColumns = $derived.by(() => tableState.columns.filter(isColumnSummable));

  // One `role="group"` per summable column (the section header names it),
  // six `menuitemradio` rows inside: None + the five vocabulary types. The
  // store keeps at most one aggregation per column, so a checked radio is
  // the shape of the state itself, and `onSelect` carries column and type
  // as values — no string compound to parse back apart (#251).
  const menuItems = $derived.by<MenuItemType[]>(() =>
    summableColumns.flatMap((column) => {
      const columnId = resolveColumnId(column);
      const current = configuredSummaries.find((config) => config.column === columnId)?.type;
      // Explicit `id`s: Menu's resolveId otherwise falls back to the flat
      // render index (the index-as-key anti-pattern). `-` as the joiner:
      // the id is an opaque key, never parsed back apart.
      return [
        { type: 'section' as const, label: resolveColumnLabel(column) },
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

<Menu items={menuItems} syncWidth={false} itemSize="sm" disabled={summableColumns.length === 0}>
  {#snippet customTrigger(toggle, open)}
    <MenuTrigger
      label={tt('summary.button.title')}
      active={isActive}
      {triggerClass}
      expanded={open}
      haspopup="menu"
      disabled={summableColumns.length === 0}
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
