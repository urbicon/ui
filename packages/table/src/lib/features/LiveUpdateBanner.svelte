<script lang="ts">
  import { Button } from '@urbicon-ui/blocks';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';

  const tt = useTableI18n();

  let { class: className = '' }: { class?: string } = $props();

  const tableContext = getTableContext();
  const counts = $derived(tableContext.liveUpdateCounts);
  const hasPending = $derived(tableContext.hasPendingUpdates);
</script>

{#if hasPending}
  <div
    class="border-primary/20 bg-primary-subtle text-text-primary rounded-contain flex items-center justify-between gap-3 border px-4 py-2.5 text-sm {className}"
    role="status"
    aria-live="polite"
    data-testid="live-update-banner"
  >
    <div class="flex items-center gap-2">
      <span class="relative flex h-2.5 w-2.5">
        <span
          class="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        ></span>
        <span class="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full"></span>
      </span>

      <span>
        {#if counts.inserts > 0}
          <strong>{counts.inserts}</strong> {tt('liveUpdates.newItems')}
        {/if}
        {#if counts.inserts > 0 && (counts.updates > 0 || counts.deletes > 0)},
        {/if}
        {#if counts.updates > 0}
          <strong>{counts.updates}</strong> {tt('liveUpdates.updatedItems')}
        {/if}
        {#if counts.updates > 0 && counts.deletes > 0},
        {/if}
        {#if counts.deletes > 0}
          <strong>{counts.deletes}</strong> {tt('liveUpdates.deletedItems')}
        {/if}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        onclick={() => tableContext.dismissAllUpdates()}
        data-testid="live-update-dismiss"
      >
        {tt('liveUpdates.dismiss')}
      </Button>
      <Button
        size="sm"
        intent="primary"
        onclick={() => tableContext.applyAllUpdates()}
        data-testid="live-update-apply"
      >
        {tt('liveUpdates.apply')}
      </Button>
    </div>
  </div>
{/if}
