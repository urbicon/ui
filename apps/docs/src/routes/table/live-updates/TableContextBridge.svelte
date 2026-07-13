<script lang="ts">
  // Demo helper: `getTableContext()` resolves through Svelte's component context,
  // so the page that renders <Table> cannot call it directly. Mounted inside the
  // table's `toolbar` snippet, this component lives inside the provider tree and
  // hands the context back to the page after mount so the demo controls can call
  // pushInsert / pushUpdate / pushDelete on it.
  import { getTableContext } from '@urbicon-ui/table';

  let { onReady }: { onReady: (context: ReturnType<typeof getTableContext>) => void } = $props();

  const context = getTableContext();

  $effect(() => {
    onReady(context);
  });
</script>
