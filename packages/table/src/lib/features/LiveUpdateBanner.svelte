<script lang="ts">
  import { Button } from '@urbicon-ui/blocks';
  import { getTableContext } from '$lib/stores/TableStore.svelte';
  import { useTableI18n } from '$lib/i18n';

  const tt = useTableI18n();

  let { class: className = '' }: { class?: string } = $props();

  const tableContext = getTableContext();
  const counts = $derived(tableContext.liveUpdateCounts);
  const hasPending = $derived(tableContext.hasPendingUpdates);

  // The three counts as data, so the separator is a join rather than markup.
  // Written as `{#if}` blocks with a comma between them, the banner rendered
  // "2 new , 1 updated": Svelte keeps the whitespace that the source needs to
  // stay readable, and it lands in front of the comma.
  // `kind` is the `{#each}` key, not `label`: a key has to be unique, and a
  // label is whatever a locale says it is. Two identical translations — or a
  // partial locale falling back to the key path or an empty string for more
  // than one of the three — would throw `each_key_duplicate` at render time,
  // and this banner only renders while updates are pending, so the crash would
  // land mid-session on a live table rather than at mount.
  const segments = $derived(
    [
      { kind: 'inserts', count: counts.inserts, label: tt('liveUpdates.newItems') },
      { kind: 'updates', count: counts.updates, label: tt('liveUpdates.updatedItems') },
      { kind: 'deletes', count: counts.deletes, label: tt('liveUpdates.deletedItems') }
    ].filter((segment) => segment.count > 0)
  );
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
        <!-- prettier-ignore -->
        {#each segments as segment, i (segment.kind)}{#if i > 0}, {/if}<strong>{segment.count}</strong> {segment.label}{/each}
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
