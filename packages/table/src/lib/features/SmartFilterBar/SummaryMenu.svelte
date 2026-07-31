<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { isColumnSummable } from '$lib/utils/summable';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Badge,
    Button,
    Select,
    Tooltip,
    resolveIcon,
    SquareSigmaIcon as SquareSigmaIconDefault
  } from '@urbicon-ui/blocks';

  const tt = useTableI18n();

  const SquareSigmaIcon = resolveIcon('squareSigma', SquareSigmaIconDefault);

  interface SummaryConfig {
    column: string;
    type: 'sum' | 'avg' | 'count' | 'min' | 'max';
    formatter?: (value: unknown) => string;
  }

  const tableContext = getTableContext();
  const { state: tableState, addSummaryConfig } = tableContext;

  const summaryConfigs = $derived(tableState.summaryConfigs);
  const isActive = $derived(summaryConfigs.length > 0);
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'summary' }) : undefined
  );

  // Select models "no selection" as `null` — an empty string is an ordinary
  // value that matches no option and trips Select's DEV orphan warning on every
  // render. This menu uses the Select as a command surface (pick → add summary
  // → reset), so its resting state must be null, never ''.
  let selectedValue = $state<string | null>(null);
  let menuOpen = $state(false);

  // Capability follows configuration, never the column's name — see
  // utils/summable.ts for what that replaced and why.
  const summableColumns = $derived.by(() => tableState.columns.filter(isColumnSummable));

  const summaryTypes = [
    { value: 'sum', label: tt('summary.types.sum'), icon: '∑' },
    { value: 'avg', label: tt('summary.types.average'), icon: '⌀' },
    { value: 'count', label: tt('summary.types.count'), icon: '#' },
    { value: 'min', label: tt('summary.types.minimum'), icon: '↓' },
    { value: 'max', label: tt('summary.types.maximum'), icon: '↑' }
  ] as const;

  const menuGroups = $derived.by(() => {
    if (summableColumns.length === 0) return [];

    return summableColumns.map((column) => {
      const columnId = resolveColumnId(column);
      return {
        label: resolveColumnLabel(column),
        options: summaryTypes.map((type) => ({
          label: `${type.icon} ${type.label}`,
          value: `${columnId}:${type.value}`,
          disabled: summaryConfigs.some(
            (config) => config.column === columnId && config.type === type.value
          )
        }))
      };
    });
  });

  function handleValueChange(value: string | null) {
    if (!value) return;

    const [columnKey, type] = value.split(':');
    if (columnKey && type) {
      const summaryConfig = {
        column: columnKey,
        type: type as SummaryConfig['type']
      };
      addSummaryConfig(summaryConfig);
      selectedValue = null;
    }
  }
</script>

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <Tooltip label={tt('summary.button.title')}>
    <Button
      variant="ghost"
      intent="neutral"
      size="sm"
      active={isActive}
      class={triggerClass}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      disabled={summableColumns.length === 0}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <SquareSigmaIcon class="h-4 w-4" />
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
    </Button>
  </Tooltip>
{/snippet}

<!-- `w-auto`: see SortMenu — the Select wrapper defaults to `w-full`. -->
<Select
  groups={menuGroups}
  bind:value={selectedValue}
  bind:open={menuOpen}
  onValueChange={handleValueChange}
  disabled={summableColumns.length === 0}
  size="sm"
  syncWidth={false}
  class="w-auto"
  {customTrigger}
/>
