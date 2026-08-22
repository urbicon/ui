<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
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

  const tableContext = getTableContext();
  const { state: tableState, addSummaryConfig, removeSummaryConfig } = tableContext;

  const summaryConfigs = $derived(tableState.summaryConfigs);
  const isActive = $derived(summaryConfigs.length > 0);
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'summary' }) : undefined
  );

  // Capability follows configuration, never the column's name — see
  // utils/column-capabilities.ts for what that replaced and why.
  const summableColumns = $derived.by(() => tableState.columns.filter(isColumnSummable));

  // One `role="group"` per summable column (the section header names it), six
  // `menuitemradio` rows inside: None + the five types from the vocabulary
  // module. The store keeps at most one aggregation per column, and a checked
  // radio row can only mean what it does — the previous Select dressed the
  // same replace-by-column store call as an additive "pick to add" list and
  // marked the active combination `disabled` instead of checked. `onSelect`
  // carries column and type directly, so the `columnId:type` compound (and
  // its last-`:` parse, #251) is gone from this menu; a menu also holds no
  // value, so the pick→reset dance the Select needed is gone with it.
  const menuItems = $derived.by<MenuItemType[]>(() =>
    summableColumns.flatMap((column) => {
      const columnId = resolveColumnId(column);
      const current = summaryConfigs.find((config) => config.column === columnId)?.type;
      return [
        { type: 'section' as const, label: resolveColumnLabel(column) },
        {
          label: tt('summary.none'),
          checked: current === undefined,
          onSelect: () => removeSummaryConfig(columnId)
        },
        ...SUMMARY_TYPES.map((type) => ({
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
      {summaryConfigs.length}
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
    />
  {/snippet}
</Menu>
