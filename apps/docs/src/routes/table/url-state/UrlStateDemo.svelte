<script lang="ts">
  import { building } from '$app/environment';
  import { page } from '$app/state';
  import { createTableQueryUrlSync } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { Table } from '@urbicon-ui/table';
  import { basicColumns, employees } from '../_data';

  /**
   * A real sync, running against this page's own address bar.
   *
   * `prefix` is what makes that safe: every key this demo writes is namespaced
   * (`?demo_q=…`), so it cannot collide with a param the docs site itself uses,
   * and `syncQuery` preserves everything it does not own — including the `#`
   * anchor the table of contents navigates by.
   *
   * `defaults` matches the props below, so the elision baseline is the state
   * the table actually starts in: page 1 at 5 rows writes nothing, and clearing
   * search and sort again empties the URL rather than leaving `?demo_q=` behind.
   */
  const sync = createTableQueryUrlSync({ prefix: 'demo_', defaults: { itemsPerPage: 5 } });

  // Same rule as the sync itself: SvelteKit forbids reading `url.searchParams`
  // while prerendering, because the emitted HTML must not depend on a query
  // string that does not exist at build time. "Nothing yet" is the honest
  // render for that pass; the client re-reads the real URL on hydration.
  const demoParams = $derived(
    building ? [] : [...page.url.searchParams].filter(([key]) => key.startsWith('demo_'))
  );
</script>

<div class="space-y-4">
  <Table
    items={employees}
    columns={basicColumns}
    query={sync.viewState}
    onQueryChange={sync.syncQuery}
    enableSmartFilter
    itemsPerPage={5}
    searchPlaceholder="Search employees…"
  />

  <div class="border-border-subtle bg-surface-elevated rounded-xl border p-4">
    <p class="text-text-secondary text-xs">
      Sort a column, search, or page — then look at the address bar. These are the params this table
      owns right now:
    </p>
    <ul class="mt-2 flex flex-wrap gap-2">
      {#each demoParams as [key, value] (`${key}=${value}`)}
        <li>
          <code
            class="border-border-subtle bg-surface-base text-text-primary rounded border px-2 py-1 text-xs"
            >{key}={value}</code
          >
        </li>
      {:else}
        <li class="text-text-tertiary text-xs">
          none — the table is in its default state, so the URL stays clean
        </li>
      {/each}
    </ul>
  </div>
</div>
