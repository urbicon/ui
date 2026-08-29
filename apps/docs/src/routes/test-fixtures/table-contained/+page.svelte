<script lang="ts">
  // E2E fixture for the contained scroll model (e2e/table-contained.spec.ts):
  // whether the box really caps, which layout renders at a given container ×
  // viewport pair, and where the pinned layers land.
  //
  // The knobs are URL parameters because the questions ARE pairs: the viewport
  // half is Playwright's, and the container half has to be settable
  // independently of it. That is the whole point — the layout switch reads the
  // BOX (`@container`) while the height cap reads the WINDOW (`100dvh`), and
  // only a page that can disagree with itself shows the two apart.
  //
  //   ?fit=content — the page-relative model, the control for every "the box
  //                  caps" reading
  //   ?box=narrow  — a 22rem column, below the table's own 32rem card step,
  //                  inside whatever viewport the test set
  //   ?summary=on  — a total summary instead of the grouping. The two are
  //                  exclusive here because a grouped table has group summaries
  //                  and no total, and the total is what pins to the bottom
  //                  edge of the box; a second table beside this one would
  //                  break the one-table rule below. It also lifts the page
  //                  size to the whole list, because the grouped rig gets its
  //                  scroll length from grouping bypassing pagination and one
  //                  default page of rows is shorter than the capped box.
  //
  // A contained table has to be the main content of its page: the cap is
  // `100dvh` minus how much viewport sits above the box, and that offset is not
  // re-measured on page scroll — so a fixture that stacked several of them
  // would measure boxes sized for a scroll position none of them is at. Hence
  // one table and one app-shell bar, which is what `--blocks-table-avail-top`
  // reads.
  import { page } from '$app/state';
  import { Table, type Column } from '@urbicon-ui/table';

  type Row = {
    id: number;
    name: string;
    role: string;
    dept: string;
    city: string;
    email: string;
    joined: string;
    manager: string;
    score: number;
  };

  const DEPTS = ['Platform', 'Design', 'Data'];
  const CITIES = ['Berlin', 'Hamburg', 'Munich'];
  const ROLES = [
    'Senior Reliability Engineer',
    'Principal Product Designer',
    'Staff Data Engineer',
    'Engineering Manager, Platform'
  ];

  // Deterministic: index-derived, no Math.random. 60 rows over three groups, so
  // the box always has more content than height and a group header is always in
  // reach of the pin line.
  const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    name: `Person ${String(i).padStart(4, '0')}`,
    role: ROLES[i % ROLES.length],
    dept: DEPTS[i % DEPTS.length],
    city: CITIES[i % CITIES.length],
    email: `person.${String(i).padStart(4, '0')}@example.com`,
    joined: `20${20 + (i % 5)}-0${(i % 9) + 1}-1${i % 9}`,
    manager: `Manager ${String(i % 11).padStart(2, '0')}`,
    score: (i * 37) % 101
  }));

  // Eight columns with a `minWidth` FLOOR, not just a `width`: the table lays
  // out `auto`, so a bare width is a hint the browser shrinks away to fit the
  // box (measured — five 280px columns rendered 1246px wide in a 1246px box and
  // scrolled nowhere). `minWidth` reaches the cells' `min-width` and cannot be
  // shrunk, so the eight columns are 1760px of table in a 1246px box at a
  // 1280px window: the contained model has to scroll sideways INSIDE the box,
  // which is the half of it a page-relative sticky table cannot do.
  const COLUMN_W = '220px';
  const columns: Column<Row>[] = [
    { accessor: 'name', title: 'Name', sortable: true, width: COLUMN_W, minWidth: COLUMN_W },
    { accessor: 'role', title: 'Role', width: COLUMN_W, minWidth: COLUMN_W },
    {
      accessor: 'dept',
      title: 'Department',
      groupable: true,
      width: COLUMN_W,
      minWidth: COLUMN_W
    },
    { accessor: 'city', title: 'City', width: COLUMN_W, minWidth: COLUMN_W },
    { accessor: 'email', title: 'Email address', width: COLUMN_W, minWidth: COLUMN_W },
    { accessor: 'joined', title: 'Joined', width: COLUMN_W, minWidth: COLUMN_W },
    { accessor: 'manager', title: 'Reporting to', width: COLUMN_W, minWidth: COLUMN_W },
    {
      accessor: 'score',
      title: 'Score',
      dataType: 'number',
      width: COLUMN_W,
      minWidth: COLUMN_W
    }
  ];

  const fit = $derived(page.url.searchParams.get('fit') === 'content' ? 'content' : 'viewport');
  const narrow = $derived(page.url.searchParams.get('box') === 'narrow');
  const summary = $derived(page.url.searchParams.get('summary') === 'on');
</script>

<svelte:head>
  <style>
    /* No motion: the seam reading compares a pixel column of the pinned foot at
       two scroll positions, and a mid-transition frame is not a layout state. */
    * {
      transition: none !important;
      animation: none !important;
    }
  </style>
</svelte:head>

<header class="border-border-default bg-surface-elevated flex h-12 items-center border-b px-4">
  <span class="text-text-primary text-sm font-semibold">Contained scroll fixture</span>
</header>

<main class="px-4 pt-4">
  <div class={narrow ? 'w-88' : ''}>
    <Table
      {fit}
      items={rows}
      {columns}
      cardsBelow="32rem"
      variant="framed"
      ariaLabel="Contained fixture"
      viewDefaults={summary ? { pageSize: rows.length } : { groupBy: 'dept' }}
      prefs={summary ? { defaults: { summaries: [{ column: 'score', type: 'sum' }] } } : undefined}
    />
  </div>
</main>
