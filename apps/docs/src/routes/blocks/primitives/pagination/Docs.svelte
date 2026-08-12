<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, Pagination } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  const orders = Array.from({ length: 96 }, (_, i) => ({
    id: i + 1,
    name: `Order #${1042 - i}`
  }));
  const perPage = 6;
  let listPage = $state(1);
  const visibleOrders = $derived(orders.slice((listPage - 1) * perPage, listPage * perPage));
  const listTotalPages = Math.ceil(orders.length / perPage);

  let tablePage = $state(1);
  let customPage = $state(3);
</script>

<!-- ─── Layouts ─── -->

<Section marker id="layouts" title="Layouts">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    <code class="text-text-primary">layout</code> decides what the bar is made of. Pick the one that fits
    the surface. The Playground above lets you flip between them live.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold"><code class="text-text-primary">layout</code></th>
          <th class="py-2 pr-4 font-semibold">What it renders</th>
          <th class="py-2 font-semibold">When to reach for it</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <code class="text-text-primary">default</code>
            <span class="text-text-tertiary">(default)</span>
          </td>
          <td class="py-3 pr-4 align-top">
            A number window with ellipses, prev / next, and ellipsis-gated first / last.
          </td>
          <td class="py-3 align-top">List and search-result pages.</td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">navigation</code></td>
          <td class="py-3 pr-4 align-top">Previous / Next buttons only, with no page numbers.</td>
          <td class="py-3 align-top"
            >Article or record flows where the page number does not matter.</td
          >
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">table</code></td>
          <td class="py-3 pr-4 align-top">
            A row-count summary (e.g. "1&ndash;25 of 500") beside prev / next.
          </td>
          <td class="py-3 align-top">
            The footer of a data table. Pair it with <code class="text-text-primary"
              >itemsPerPage</code
            >
            /
            <code class="text-text-primary">totalItems</code>.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">minimal</code></td>
          <td class="py-3 pr-4 align-top">A single "Page 3 of 20" indicator, no buttons.</td>
          <td class="py-3 align-top">Tight toolbars and mobile bars.</td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-8 text-sm leading-relaxed">
    Pagination is controlled: you hold the 1-based <code class="text-text-primary">currentPage</code
    >
    in your own state and update it from <code class="text-text-primary">onPageChange</code>. The
    bar reports the page the user picked and never changes it on its own.
  </p>
  <div class="space-y-8">
    <CodeExample
      title="Browsing a long list"
      description="Slice your data by the current page. Here `currentPage` indexes a `$derived` slice of the orders, so picking a page swaps the visible rows. The bar stays presentational: it reports the page and leaves the data to you."
      previewClass="w-full"
      code={`<script lang="ts">
  import { Pagination } from '@urbicon-ui/blocks';

  const perPage = 6;
  let page = $state(1);

  // currentPage indexes the slice; onPageChange moves it.
  const visible = $derived(orders.slice((page - 1) * perPage, page * perPage));
  const totalPages = Math.ceil(orders.length / perPage);
<\/script>

<ul>
  {#each visible as order (order.id)}
    <li>{order.name}</li>
  {/each}
</ul>

<Pagination currentPage={page} {totalPages} visiblePages={5} onPageChange={(p) => (page = p)} />`}
    >
      <div class="w-full">
        <ul
          class="border-border-subtle divide-border-subtle text-text-secondary mb-4 divide-y rounded-lg border text-sm"
        >
          {#each visibleOrders as order (order.id)}
            <li class="px-4 py-2.5 tabular-nums">{order.name}</li>
          {/each}
        </ul>
        <Pagination
          currentPage={listPage}
          totalPages={listTotalPages}
          visiblePages={5}
          onPageChange={(p: number) => (listPage = p)}
        />
      </div>
    </CodeExample>

    <CodeExample
      title="Data-table footer"
      description="`layout=table` swaps the number window for a row-count summary and pins prev / next to the right. `totalPages` still drives the buttons, while `itemsPerPage` and `totalItems` only build the summary. On the first page Previous is disabled in place."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle w-full overflow-hidden rounded-lg border">
        <table class="w-full text-left text-sm">
          <thead class="text-text-secondary border-border-subtle bg-surface-quiet border-b">
            <tr>
              <th class="px-4 py-2 font-medium">Invoice</th>
              <th class="px-4 py-2 font-medium">Customer</th>
              <th class="px-4 py-2 pr-4 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary divide-border-subtle divide-y">
            <tr>
              <td class="px-4 py-2.5">INV-1042</td>
              <td class="px-4 py-2.5">Northwind Traders</td>
              <td class="px-4 py-2.5 text-right tabular-nums">$2,400.00</td>
            </tr>
            <tr>
              <td class="px-4 py-2.5">INV-1041</td>
              <td class="px-4 py-2.5">Aperture Labs</td>
              <td class="px-4 py-2.5 text-right tabular-nums">$980.00</td>
            </tr>
            <tr>
              <td class="px-4 py-2.5">INV-1040</td>
              <td class="px-4 py-2.5">Soylent Corp</td>
              <td class="px-4 py-2.5 text-right tabular-nums">$12,150.00</td>
            </tr>
          </tbody>
        </table>
        <div class="border-border-subtle border-t px-4 py-3">
          <Pagination
            currentPage={tablePage}
            totalPages={48}
            layout="table"
            variant="ghost"
            intent="neutral"
            size="sm"
            itemsPerPage={3}
            totalItems={142}
            onPageChange={(p: number) => (tablePage = p)}
          />
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Segmented bar"
      description="Group the whole pager into one tinted segment: `slotClasses` gives the `base` slot a `surface-quiet` fill, a subtle border and a container radius. The buttons keep their own radius tier and behaviour."
      isolate
      previewClass="flex justify-center"
    >
      <Pagination
        currentPage={customPage}
        totalPages={12}
        visiblePages={5}
        showFirstLast={false}
        slotClasses={{
          base: 'border-border-subtle bg-surface-quiet w-fit rounded-lg border px-1.5 py-1'
        }}
        onPageChange={(p: number) => (customPage = p)}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The root element is a <code class="text-text-primary">&lt;nav&gt;</code> landmark carrying
        an
        <code class="text-text-primary">aria-label</code>, so assistive tech lists it as a named
        navigation region. Pass your own <code class="text-text-primary">aria-label</code> to name
        each pager when a page carries more than one. The active page button sets
        <code class="text-text-primary">aria-current="page"</code>. A disabled boundary button
        (Previous on the first page, Next on the last) is inert and marked
        <code class="text-text-primary">aria-disabled</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" />
        moves through the controls in DOM order.
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />
        activates the focused one. Every enabled control (first / last, prev / next, and the numbered
        buttons) is reachable this way, and a disabled boundary button is skipped.
      </p>
    </Note>
  </NoteList>
</Section>
