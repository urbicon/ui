<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Avatar, Badge, Card, Drawer } from '@urbicon-ui/blocks';
  import { Table, TableColumns, type Column } from '@urbicon-ui/table';
  import { useI18n } from '@urbicon-ui/i18n';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  type OrderStatus = 'paid' | 'packing' | 'shipped' | 'refunded';

  interface OrderLine {
    name: string;
    qty: number;
    price: number;
  }

  interface Order {
    id: string;
    customer: string;
    email: string;
    city: string;
    status: OrderStatus;
    total: number;
    placedAt: string;
    lines: OrderLine[];
  }

  const orders: Order[] = [
    {
      id: 'ORD-2418',
      customer: 'Nadia Osei',
      email: 'nadia.osei@atelier.nl',
      city: 'Rotterdam',
      status: 'shipped',
      total: 80.5,
      placedAt: '2026-07-28',
      lines: [
        { name: 'Linen apron', qty: 2, price: 34 },
        { name: 'Oak spoon', qty: 1, price: 12.5 }
      ]
    },
    {
      id: 'ORD-2419',
      customer: 'Tomás Ferreira',
      email: 'tomas@ferreira.pt',
      city: 'Porto',
      status: 'paid',
      total: 79,
      placedAt: '2026-07-29',
      lines: [{ name: 'Cast-iron pan', qty: 1, price: 79 }]
    },
    {
      id: 'ORD-2420',
      customer: 'Hanna Virtanen',
      email: 'hanna.v@kotimail.fi',
      city: 'Helsinki',
      status: 'packing',
      total: 145,
      placedAt: '2026-07-29',
      lines: [
        { name: 'Wool throw', qty: 1, price: 118 },
        { name: 'Beeswax candle', qty: 3, price: 9 }
      ]
    },
    {
      id: 'ORD-2421',
      customer: 'Marek Zieliński',
      email: 'marek.z@pocztowy.pl',
      city: 'Kraków',
      status: 'refunded',
      total: 210,
      placedAt: '2026-07-30',
      lines: [{ name: 'Espresso grinder', qty: 1, price: 210 }]
    },
    {
      id: 'ORD-2422',
      customer: 'Aline Dubois',
      email: 'aline@maisondubois.fr',
      city: 'Lyon',
      status: 'shipped',
      total: 85.5,
      placedAt: '2026-07-30',
      lines: [
        { name: 'Ceramic mug', qty: 4, price: 16 },
        { name: 'Tea tin', qty: 1, price: 21.5 }
      ]
    },
    {
      id: 'ORD-2423',
      customer: 'Yusuf Demir',
      email: 'yusuf.demir@posta.tr',
      city: 'Izmir',
      status: 'paid',
      total: 124,
      placedAt: '2026-07-31',
      lines: [
        { name: 'Copper kettle', qty: 1, price: 96 },
        { name: 'Trivet', qty: 2, price: 14 }
      ]
    },
    {
      id: 'ORD-2424',
      customer: 'Greta Lindqvist',
      email: 'greta@lindqvist.se',
      city: 'Malmö',
      status: 'packing',
      total: 245,
      placedAt: '2026-08-01',
      lines: [{ name: 'Sheepskin rug', qty: 1, price: 245 }]
    },
    {
      id: 'ORD-2425',
      customer: 'Paolo Ricci',
      email: 'paolo.ricci@bottega.it',
      city: 'Bologna',
      status: 'paid',
      total: 102,
      placedAt: '2026-08-02',
      lines: [
        { name: 'Olive board', qty: 2, price: 42 },
        { name: 'Salt cellar', qty: 1, price: 18 }
      ]
    },
    {
      id: 'ORD-2426',
      customer: 'Ingrid Bauer',
      email: 'ingrid.bauer@hofmail.at',
      city: 'Graz',
      status: 'shipped',
      total: 83.5,
      placedAt: '2026-08-03',
      lines: [
        { name: 'Enamel pot', qty: 1, price: 68 },
        { name: 'Ladle', qty: 1, price: 15.5 }
      ]
    },
    {
      id: 'ORD-2427',
      customer: 'Sofia Mendes',
      email: 'sofia@mendes.pt',
      city: 'Lisbon',
      status: 'refunded',
      total: 87,
      placedAt: '2026-08-04',
      lines: [{ name: 'Rattan basket', qty: 3, price: 29 }]
    },
    {
      id: 'ORD-2428',
      customer: 'Jonas Berg',
      email: 'jonas.berg@fjordpost.no',
      city: 'Bergen',
      status: 'packing',
      total: 237,
      placedAt: '2026-08-05',
      lines: [
        { name: 'Down duvet', qty: 1, price: 189 },
        { name: 'Pillowcase', qty: 2, price: 24 }
      ]
    },
    {
      id: 'ORD-2429',
      customer: 'Leila Haddad',
      email: 'leila.haddad@souk.ma',
      city: 'Casablanca',
      status: 'paid',
      total: 119,
      placedAt: '2026-08-06',
      lines: [
        { name: 'Tagine', qty: 1, price: 74 },
        { name: 'Mint glasses', qty: 6, price: 7.5 }
      ]
    }
  ];

  // StatusBadge knows eleven statuses (active, pending, processing, …). An
  // order's four are not among them, so each one is named here.
  const ORDER_STATUS = {
    paid: { intent: 'success' as const, text: 'Paid', icon: true },
    packing: { intent: 'warning' as const, text: 'Packing', icon: true },
    shipped: { intent: 'primary' as const, text: 'Shipped', icon: true },
    refunded: { intent: 'neutral' as const, text: 'Refunded', icon: false }
  };

  // Four columns, because the panel carries the rest: date, contact details and
  // line items are what you read once, not what you scan by. The annotation is
  // what checks the accessors. With Column<Order>[], a first argument that is
  // not a primitive-valued key of the row is a type error.
  //
  // `priority: 2` makes customer the second line of a mobile card. Below
  // `cardsBelow` — measured on the table's own container, not the window — the
  // grid is replaced by one card per row, and those cards fire onRowClick and
  // carry the active rail exactly like the rows do.
  const columns: Column<Order>[] = [
    TableColumns.text('id', 'Order', { width: '110px', groupable: false, hideable: false }),
    TableColumns.text('customer', 'Customer', { priority: 2 }),
    TableColumns.status('status', 'Status', { statusMap: ORDER_STATUS }),
    TableColumns.number('total', 'Total', { format: 'currency', currency: 'EUR', groupable: false })
  ];

  /** The record the panel shows. */
  let shown = $state<Order | null>(null);
  /** Whether the drawer is up. It holds no record of its own — `shown` is the only one. */
  let sheetOpen = $state(false);

  // 1023px is Tailwind's `lg` step minus one, the same pairing Sidebar
  // mode="responsive" uses: the `lg:` classes below own the layout, and this
  // only decides whether the detail additionally gets a drawer. An open drawer
  // locks page scroll and traps focus, so it has to be closed rather than
  // hidden — a CSS class cannot do that.
  const narrow = new MediaQuery('(max-width: 1023px)');

  function openOrder(order: Order) {
    shown = order;
    // Only the drawer needs opening; the panel is already showing `shown`.
    // Setting this unconditionally would arm a drawer that springs open the
    // moment a wide window is narrowed.
    sheetOpen = narrow.current;
  }

  // Total and the line prices are formatted in the locale of the surrounding
  // <I18nProvider>, which is where the table's own number cells read it from.
  const i18n = useI18n();
  const money = $derived(
    new Intl.NumberFormat(i18n.locale, { style: 'currency', currency: 'EUR' })
  );
  const day = $derived(
    new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeZone: 'UTC' })
  );

  const recipeCode = `<\script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { Avatar, Badge, Card, Drawer } from '@urbicon-ui/blocks';
  import { Table, TableColumns, type Column } from '@urbicon-ui/table';
  import { useI18n } from '@urbicon-ui/i18n';

  type OrderStatus = 'paid' | 'packing' | 'shipped' | 'refunded';

  interface OrderLine { name: string; qty: number; price: number }

  interface Order {
    id: string; customer: string; email: string; city: string;
    status: OrderStatus; total: number; placedAt: string; lines: OrderLine[];
  }

  const orders: Order[] = [/* … your rows … */];

  // StatusBadge knows eleven statuses (active, pending, processing, …). An
  // order's four are not among them, so each one is named here.
  const ORDER_STATUS = {
    paid: { intent: 'success' as const, text: 'Paid', icon: true },
    packing: { intent: 'warning' as const, text: 'Packing', icon: true },
    shipped: { intent: 'primary' as const, text: 'Shipped', icon: true },
    refunded: { intent: 'neutral' as const, text: 'Refunded', icon: false }
  };

  // Four columns, because the panel carries the rest: date, contact details and
  // line items are what you read once, not what you scan by. The annotation is
  // what checks the accessors. With Column<Order>[], a first argument that is
  // not a primitive-valued key of the row is a type error.
  //
  // priority: 2 makes customer the second line of a mobile card. Below
  // cardsBelow — measured on the table's own container, not the window — the
  // grid is replaced by one card per row, and those cards fire onRowClick and
  // carry the active rail exactly like the rows do.
  const columns: Column<Order>[] = [
    TableColumns.text('id', 'Order', { width: '110px', groupable: false, hideable: false }),
    TableColumns.text('customer', 'Customer', { priority: 2 }),
    TableColumns.status('status', 'Status', { statusMap: ORDER_STATUS }),
    TableColumns.number('total', 'Total', { format: 'currency', currency: 'EUR', groupable: false })
  ];

  /** The record the panel shows. */
  let shown = $state<Order | null>(null);
  /** Whether the drawer is up. It holds no record of its own — shown is the only one. */
  let sheetOpen = $state(false);

  // 1023px is Tailwind's lg step minus one: the lg: classes below own the
  // layout, and this only decides whether the detail additionally gets a
  // drawer. An open drawer locks page scroll and traps focus, so it has to be
  // closed rather than hidden — a CSS class cannot do that.
  const narrow = new MediaQuery('(max-width: 1023px)');

  function openOrder(order: Order) {
    shown = order;
    // Only the drawer needs opening; the panel is already showing shown.
    // Setting this unconditionally would arm a drawer that springs open the
    // moment a wide window is narrowed.
    sheetOpen = narrow.current;
  }

  // Locale comes from the <I18nProvider> at your app root, which is where the
  // table's own number and date cells read it from. Without one it silently
  // falls back to English.
  const i18n = useI18n();
  const money = $derived(new Intl.NumberFormat(i18n.locale, { style: 'currency', currency: 'EUR' }));
  const day = $derived(new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeZone: 'UTC' }));
<\/script>

<!-- One detail, two hosts: the panel below and the drawer at the bottom both
     render this. -->
{#snippet detail(order: Order)}
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <Badge intent={ORDER_STATUS[order.status].intent}>{ORDER_STATUS[order.status].text}</Badge>
      <span class="text-text-tertiary text-sm">{day.format(new Date(order.placedAt))}</span>
    </div>

    <div class="flex items-center gap-3">
      <Avatar name={order.customer} size="md" />
      <div class="min-w-0">
        <p class="text-text-primary truncate font-medium">{order.customer}</p>
        <p class="text-text-tertiary truncate text-sm">{order.email}</p>
        <p class="text-text-tertiary text-sm">{order.city}</p>
      </div>
    </div>

    <ul class="divide-border-hairline divide-y">
      {#each order.lines as line (line.name)}
        <li class="flex items-baseline justify-between gap-4 py-2">
          <span class="text-text-primary text-sm">{line.qty} × {line.name}</span>
          <span class="text-text-secondary text-sm tabular-nums">
            {money.format(line.qty * line.price)}
          </span>
        </li>
      {/each}
    </ul>

    <div class="border-border-default flex items-baseline justify-between border-t pt-3">
      <span class="text-text-primary font-semibold">Total</span>
      <span class="text-text-primary font-semibold tabular-nums">{money.format(order.total)}</span>
    </div>
  </div>
{/snippet}

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
  <!-- The toolbar above the grid — search, filters, sort, grouping, summaries,
       column visibility — is enableSmartFilter, on by default. Pass false for a
       bare grid; the column headers keep sorting either way.

       activeRowId is matched against item.id. Rows without one fall back to
       their position in the items array, so the mark follows a different record
       the next time you replace it. -->
  <Table
    items={orders}
    {columns}
    ariaLabel="Orders"
    cardsBelow="28rem"
    viewDefaults={{ pageSize: 6 }}
    onRowClick={openOrder}
    activeRowId={shown?.id ?? null}
  />

  <!-- The panel is an elevated Card: the shadow lifts it off the page, no
       border needed. Hidden below lg, where the Drawer takes over. -->
  <aside class="hidden lg:block">
    <Card variant="elevated">
      <h2 class="text-text-primary mb-4 text-base font-semibold">
        {shown ? 'Order ' + shown.id : 'Order detail'}
      </h2>
      {#if shown}
        {@render detail(shown)}
      {:else}
        <p class="text-text-tertiary text-sm">Pick a row to read the order here.</p>
      {/if}
    </Card>
  </aside>
</div>

<Drawer
  open={narrow.current && sheetOpen}
  onClose={() => (sheetOpen = false)}
  title={shown ? 'Order ' + shown.id : ''}
  placement="right"
  size="lg"
>
  {#if shown}{@render detail(shown)}{/if}
</Drawer>`;
</script>

{#snippet detail(order: Order)}
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <Badge intent={ORDER_STATUS[order.status].intent}>{ORDER_STATUS[order.status].text}</Badge>
      <span class="text-text-tertiary text-sm">{day.format(new Date(order.placedAt))}</span>
    </div>

    <div class="flex items-center gap-3">
      <Avatar name={order.customer} size="md" />
      <div class="min-w-0">
        <p class="text-text-primary truncate font-medium">{order.customer}</p>
        <p class="text-text-tertiary truncate text-sm">{order.email}</p>
        <p class="text-text-tertiary text-sm">{order.city}</p>
      </div>
    </div>

    <ul class="divide-border-hairline divide-y">
      {#each order.lines as line (line.name)}
        <li class="flex items-baseline justify-between gap-4 py-2">
          <span class="text-text-primary text-sm">{line.qty} × {line.name}</span>
          <span class="text-text-secondary text-sm tabular-nums">
            {money.format(line.qty * line.price)}
          </span>
        </li>
      {/each}
    </ul>

    <div class="border-border-default flex items-baseline justify-between border-t pt-3">
      <span class="text-text-primary font-semibold">Total</span>
      <span class="text-text-primary font-semibold tabular-nums">{money.format(order.total)}</span>
    </div>
  </div>
{/snippet}

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="OrdersPage.svelte"
      description="Click down the list and the panel follows. For the drawer, narrow the window below 1024px first, then click a row."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Table
          items={orders}
          {columns}
          ariaLabel="Orders"
          cardsBelow="28rem"
          viewDefaults={{ pageSize: 6 }}
          onRowClick={openOrder}
          activeRowId={shown?.id ?? null}
        />

        <aside class="hidden lg:block">
          <Card variant="elevated">
            <h2 class="text-text-primary mb-4 text-base font-semibold">
              {shown ? 'Order ' + shown.id : 'Order detail'}
            </h2>
            {#if shown}
              {@render detail(shown)}
            {:else}
              <p class="text-text-tertiary text-sm">Pick a row to read the order here.</p>
            {/if}
          </Card>
        </aside>
      </div>

      <Drawer
        open={narrow.current && sheetOpen}
        onClose={() => (sheetOpen = false)}
        title={shown ? 'Order ' + shown.id : ''}
        placement="right"
        size="lg"
      >
        {#if shown}{@render detail(shown)}{/if}
      </Drawer>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="The drawer only exists below 1024px">
        <p>
          There is no second column at that width, so the same
          <code class="text-text-primary">detail</code> snippet is handed to a
          <code class="text-text-primary">Drawer</code>. That one is modal: it covers the list, and
          dismissing it is the way back.
        </p>
      </Note>
      <Note title="A current row is not a selection">
        <p>
          <code class="text-text-primary">activeRowId</code> gives the open row
          <code class="text-text-primary">aria-current</code> and a rail on its left edge.
          <code class="text-text-primary">selectionMode</code> means something else: a set someone marked
          for a bulk action, and it adds a checkbox column to collect it. Use it when a toolbar button
          acts on many orders at once; here one record is on screen, and the checkbox column would go
          unused.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      Which order is open is view state, like the sort and the page number.
      <code class="text-text-primary">useUrlParam</code> from
      <code class="text-text-primary">@urbicon-ui/sveltekit-utils/url.svelte</code> puts its id in
      the address bar, so a link reopens the panel on the right record. For the table's own view
      (search, sort, page, page size, filters, grouping) use
      <code class="text-text-primary">bindViewToUrl</code>, on
      <a class="text-primary hover:underline" href={resolve('/table/url-state')}>URL State</a>.
    </p>
  </Section>
</RecipeShell>
