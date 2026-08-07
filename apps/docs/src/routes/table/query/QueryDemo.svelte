<script lang="ts">
  // Live managed-source demo: `source={{ processing: 'server', query, debounceMs }}` runs against a
  // deterministic in-memory mock backend — search, sort, and pagination are
  // applied server-side (here: in this module) after an adjustable artificial
  // latency. A request counter and an in-flight badge make the request
  // lifecycle visible: one fetch per interaction, the first one immediate,
  // superseded ones aborted. The same demo-fetcher pattern drives the Combobox
  // async-search demo and the e2e remote fixture. Fully deterministic — no
  // network, no Math.random.
  import { Table, type Column, type TablePage, type TableViewSnapshot } from '@urbicon-ui/table';
  import { Badge, SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';

  type User = {
    id: number;
    name: string;
    role: string;
    team: string;
    joined: string;
  };

  // 56 unique, index-derived users (8 first names × 7 last names = one full
  // cycle) — deterministic data that still reads like a real directory.
  const FIRST = ['Ada', 'Ben', 'Chloe', 'David', 'Elif', 'Femi', 'Grace', 'Hugo'];
  const LAST = ['Anders', 'Baptiste', 'Costa', 'Dimitrov', 'Eriksen', 'Fontaine', 'Novak'];
  const ROLES = ['Engineer', 'Designer', 'Product Manager', 'Analyst', 'Support'];
  const TEAMS = ['Platform', 'Billing', 'Mobile', 'Data', 'Growth'];

  const users: User[] = Array.from({ length: 56 }, (_, i) => ({
    id: i + 1,
    name: `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`,
    role: ROLES[i % ROLES.length],
    team: TEAMS[(i * 3) % TEAMS.length],
    joined: `${2022 + (i % 4)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`
  }));

  const columns: Column<User>[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'role', title: 'Role', sortable: true },
    { accessor: 'team', title: 'Team', sortable: true },
    { accessor: 'joined', title: 'Joined', sortable: true }
  ];

  let latency = $state('400');
  let requestCount = $state(0);
  let inFlight = $state(0);
  let matchTotal = $state<number | null>(null);

  // Reject on abort so a superseded request never resolves — the same shape a
  // real `fetch(url, { signal })` produces. The table ignores rejections of
  // requests it aborted itself (it checks `signal.aborted`).
  function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    });
  }

  async function mockServer(
    query: TableViewSnapshot,
    { signal }: { signal: AbortSignal }
  ): Promise<TablePage> {
    requestCount += 1;
    inFlight += 1;
    try {
      await delay(Number(latency), signal);

      const term = query.search.trim().toLowerCase();
      let rows = term
        ? users.filter((u) =>
            [u.name, u.role, u.team].some((field) => field.toLowerCase().includes(term))
          )
        : [...users];

      if (query.sort) {
        const key = query.sort.column as keyof User;
        const dir = query.sort.direction === 'desc' ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          if (a[key] < b[key]) return -1 * dir;
          if (a[key] > b[key]) return 1 * dir;
          return 0;
        });
      }

      matchTotal = rows.length;

      const start = (Math.max(1, query.page) - 1) * query.pageSize;
      return { items: rows.slice(start, start + query.pageSize), total: rows.length };
    } finally {
      inFlight -= 1;
    }
  }
</script>

<div class="w-full space-y-4">
  <div class="border-border-default bg-surface-base rounded-contain border p-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-text-primary text-sm font-medium">Simulated backend</p>
        <p class="text-text-secondary text-xs">
          Requests: <span class="text-text-primary font-medium">{requestCount}</span>
          · Matching rows:
          <span class="text-text-primary font-medium">{matchTotal ?? '—'}</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Badge size="sm" variant="soft" intent={inFlight > 0 ? 'warning' : 'success'}>
          {inFlight > 0 ? 'Request in flight' : 'Idle'}
        </Badge>
        <span class="text-text-secondary text-xs" aria-hidden="true">Server latency</span>
        <SegmentGroup bind:value={latency} ariaLabel="Server latency" size="sm">
          <SegmentItem value="150">150 ms</SegmentItem>
          <SegmentItem value="400">400 ms</SegmentItem>
          <SegmentItem value="1200">1.2 s</SegmentItem>
        </SegmentGroup>
      </div>
    </div>
  </div>

  <Table
    {columns}
    source={{ processing: 'server', query: mockServer, debounceMs: 300 }}
    viewDefaults={{ pageSize: 8 }}
    searchPlaceholder="Search users…"
    ariaLabel="Server-mode users table"
  />

  <p class="text-text-tertiary text-xs">
    Sort a column, change the page, or search (try “ada”, or “zz” for the empty state). Every
    interaction issues a fresh request. Type fast at 1.2 s latency to see superseded requests being
    aborted: the counter climbs, but only the newest response renders.
  </p>
</div>
