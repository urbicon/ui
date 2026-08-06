<script lang="ts">
  /**
   * SSR fixture — a component-scoped view receiving an init-time external
   * application, the §3 target shape. `init` stands in for what the URL
   * binding (now in sveltekit-utils) does synchronously at init: the URL a
   * request arrives with is fixed for that request, so its axes are applied
   * as `external` before any effect exists. The measurement is that the
   * server HTML shows the applied state without any effect having run.
   */
  import { createTableView, type TableViewDefaults, type TableViewSnapshot } from '../view.svelte';

  let {
    init,
    defaults = { pageSize: 10 }
  }: { init?: Partial<TableViewSnapshot>; defaults?: TableViewDefaults } = $props();

  // Init-time captures on purpose — the props of a server render are fixed
  // for that request; same contract as a URL binding's synchronous init parse.
  // svelte-ignore state_referenced_locally
  const view = createTableView({ defaults });
  // svelte-ignore state_referenced_locally
  if (init) view.applyExternal(init, 'external');
</script>

<p data-testid="sort">{view.sort ? `${view.sort.column}:${view.sort.direction}` : 'unsorted'}</p>
<p data-testid="search">{view.search === '' ? 'empty' : view.search}</p>
<p data-testid="page">page:{view.page}</p>
<p data-testid="pageSize">size:{view.pageSize}</p>
