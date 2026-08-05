<script lang="ts">
  /**
   * SPIKE SSR fixture — a component-scoped view with a URL binding, the §3
   * target shape. What the server renders for a given `search` is the
   * measurement: the init phase must resolve synchronously, without effects.
   */
  import { bindViewToUrl, FakeUrl } from '../bindings.svelte';
  import { createTableView } from '../view.svelte';

  let { search = '' }: { search?: string } = $props();

  const view = createTableView({ defaults: { pageSize: 10 } });
  // Init-time snapshot on purpose: the URL a request arrives with is fixed
  // for that request — same contract as createTableQueryUrlSync's initial
  // parse.
  // svelte-ignore state_referenced_locally
  const url = new FakeUrl(search);
  bindViewToUrl(view, url);
</script>

<p data-testid="sort">{view.sort ? `${view.sort.column}:${view.sort.direction}` : 'unsorted'}</p>
<p data-testid="search">{view.search === '' ? 'empty' : view.search}</p>
<p data-testid="page">page:{view.page}</p>
<p data-testid="pageSize">size:{view.pageSize}</p>
