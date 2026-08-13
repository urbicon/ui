<script lang="ts">
  import { building } from '$app/environment';
  import { page } from '$app/state';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { createTableView, Table } from '@urbicon-ui/table';
  import { basicColumns, employees } from '../_data';

  /**
   * A real binding, running against this page's own address bar.
   *
   * `prefix` is what makes that safe: every key this binding manages is
   * namespaced (`?demo_q=…`), so it cannot claim a param the docs site itself
   * uses, and the shared URL writer replaces only its own keys — every other
   * param survives, and each navigation carries the current `#` anchor along,
   * the one the table of contents scrolls by. Two bindings that would manage
   * the same key are refused at registration rather than overwriting each
   * other silently.
   *
   * `defaults` is written once and does two jobs: it is the state the table
   * starts in *and* the baseline the URL elides against. Page 1 at 5 rows
   * therefore writes nothing, and clearing search and sort again empties the
   * URL rather than leaving `?demo_q=` behind.
   */
  const view = createTableView({ defaults: { pageSize: 5 } });
  bindViewToUrl(view, { prefix: 'demo_' });

  /**
   * The binding itself is prerender-safe: its init phase skips reading
   * `url.searchParams` while `building` (SvelteKit forbids it — the emitted
   * HTML must not depend on a query string that does not exist at build time),
   * so the build pass renders the defaults and the client applies the real URL
   * at init, synchronously. This list reads the params directly, so it needs
   * the same guard: "nothing yet" is the honest render for that pass.
   */
  const demoParams = $derived(
    building ? [] : [...page.url.searchParams].filter(([key]) => key.startsWith('demo_'))
  );

  // Two steps because `$props.id()` is only legal as a top-level initializer.
  const propsId = $props.id();
  const paramsLabelId = `url-state-demo-params-${propsId}`;
</script>

<div class="space-y-4">
  <Table
    cardsBelow="32rem"
    items={employees}
    columns={basicColumns}
    {view}
    enableSmartFilter
    searchPlaceholder="Search employees…"
  />

  <div class="border-border-subtle bg-surface-elevated rounded-xl border p-4">
    <p id={paramsLabelId} class="text-text-secondary text-xs">
      Sort from the toolbar, search, or turn the page, then look at the address bar. These are the
      params this table owns right now:
    </p>
    <!-- Live region because the address bar is not one: the sentence above tells
         a sighted reader where to look, and this list is the only place the same
         change is announced. -->
    <ul
      class="mt-2 flex flex-wrap gap-2"
      aria-labelledby={paramsLabelId}
      aria-live="polite"
      aria-atomic="true"
    >
      <!-- Keyed by index as well as content: `filter` is the one repeatable key
           (one param per active filter), and applying the same filter twice
           produces two identical entries. A content-only key throws
           `each_key_duplicate` — in production too — which would take the table
           and this list down together. -->
      {#each demoParams as [key, value], i (`${i}:${key}=${value}`)}
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
