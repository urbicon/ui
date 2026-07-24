<script lang="ts">
  import { Table, SmartFilterBar, type Column, type TableContext } from '@urbicon-ui/table';
  import { Button, Toggle } from '@urbicon-ui/blocks';

  type Order = {
    id: number;
    reference: string;
    customer: string;
    status: 'pending' | 'paid' | 'shipped' | 'delivered';
    total: number;
    placedAt: string;
  };

  const customers = [
    'Aurora Labs',
    'Baltic Trade',
    'Cobalt Works',
    'Delta Foods',
    'Ember Studio',
    'Fjord Analytics',
    'Granite & Co',
    'Helix Health'
  ];

  const initialOrders: Order[] = [
    {
      id: 1001,
      reference: 'ORD-1001',
      customer: 'Aurora Labs',
      status: 'delivered',
      total: 1240,
      placedAt: '2026-07-08'
    },
    {
      id: 1002,
      reference: 'ORD-1002',
      customer: 'Baltic Trade',
      status: 'shipped',
      total: 380,
      placedAt: '2026-07-09'
    },
    {
      id: 1003,
      reference: 'ORD-1003',
      customer: 'Cobalt Works',
      status: 'paid',
      total: 2150,
      placedAt: '2026-07-10'
    },
    {
      id: 1004,
      reference: 'ORD-1004',
      customer: 'Delta Foods',
      status: 'pending',
      total: 95,
      placedAt: '2026-07-11'
    },
    {
      id: 1005,
      reference: 'ORD-1005',
      customer: 'Ember Studio',
      status: 'paid',
      total: 640,
      placedAt: '2026-07-11'
    },
    {
      id: 1006,
      reference: 'ORD-1006',
      customer: 'Fjord Analytics',
      status: 'shipped',
      total: 1780,
      placedAt: '2026-07-12'
    },
    {
      id: 1007,
      reference: 'ORD-1007',
      customer: 'Granite & Co',
      status: 'pending',
      total: 420,
      placedAt: '2026-07-12'
    },
    {
      id: 1008,
      reference: 'ORD-1008',
      customer: 'Helix Health',
      status: 'pending',
      total: 310,
      placedAt: '2026-07-13'
    }
  ];

  const columns: Column<Order>[] = [
    { accessor: 'reference', title: 'Order', sortable: true, searchable: true },
    { accessor: 'customer', title: 'Customer', sortable: true, searchable: true },
    { accessor: 'status', title: 'Status', sortable: true },
    { accessor: 'total', title: 'Total', sortable: true, dataType: 'number', align: 'right' },
    { accessor: 'placedAt', title: 'Placed', sortable: true }
  ];

  // The table context, handed over by the table's `onReady` callback.
  let table = $state<TableContext | null>(null);
  let feedRunning = $state(false);

  // Continues after the seeded rows; only read inside handlers, so no rune needed.
  let nextId = 1008;

  function randomOf<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
  }

  function currentRows(): Order[] {
    return (table?.state.items ?? []) as Order[];
  }

  function simulateInsert() {
    if (!table) return;
    nextId += 1;
    table.pushInsert({
      id: nextId,
      reference: `ORD-${nextId}`,
      customer: randomOf(customers),
      status: 'pending',
      total: 40 + Math.floor(Math.random() * 400) * 5,
      placedAt: new Date().toISOString().slice(0, 10)
    });
  }

  const nextStatus: Record<Order['status'], Order['status']> = {
    pending: 'paid',
    paid: 'shipped',
    shipped: 'delivered',
    delivered: 'delivered'
  };

  function simulateUpdate() {
    if (!table) return;
    const candidates = currentRows().filter((order) => order.status !== 'delivered');
    if (candidates.length === 0) return;
    const row = randomOf(candidates);
    table.pushUpdate(row.id, { status: nextStatus[row.status] });
  }

  function simulateDelete() {
    if (!table) return;
    const rows = currentRows();
    // Keep the demo populated.
    if (rows.length <= 4) return;
    table.pushDelete(randomOf(rows).id);
  }

  $effect(() => {
    if (!feedRunning) return;
    const timer = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.5) simulateInsert();
      else if (roll < 0.85) simulateUpdate();
      else simulateDelete();
    }, 1400);
    return () => clearInterval(timer);
  });
</script>

<div class="space-y-4">
  <div class="border-border-default bg-surface-base rounded-contain border p-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-text-primary text-sm font-medium">Simulated server feed</p>
        <p class="text-text-secondary text-xs">
          Stand-in for a WebSocket/SSE handler — each button calls the corresponding push method.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outlined" onclick={simulateInsert} disabled={!table}>
          Insert row
        </Button>
        <Button size="sm" variant="outlined" onclick={simulateUpdate} disabled={!table}>
          Update row
        </Button>
        <Button size="sm" variant="outlined" onclick={simulateDelete} disabled={!table}>
          Delete row
        </Button>
        <Toggle bind:checked={feedRunning} label="Auto feed" disabled={!table} />
      </div>
    </div>
  </div>

  <Table
    items={initialOrders}
    {columns}
    enableLiveUpdates
    autoApplyOnNavigation={false}
    itemsPerPage={8}
    onReady={(context) => (table = context)}
  >
    {#snippet toolbar()}
      <SmartFilterBar placeholder="Search orders..." />
    {/snippet}
  </Table>
</div>
