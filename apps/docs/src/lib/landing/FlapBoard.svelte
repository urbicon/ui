<!--
  Das Fallblatt-Board des Landing-Heros: der Bestand der Library als
  Abflugtafel. Die Signatur ist die DEPS-Spalte — eine Säule aus Nullen, so
  hoch wie das Set.

  Darunter läuft unsere eigene `Table`. Das ist kein Selbstzweck: Eine Seite,
  die mit dem eigenen Set wirbt und dafür die eigene Tabelle umgeht, sägt an
  ihrem eigenen Argument. Sortierung, Semantik und Tastaturbedienung kommen
  von dort; hier liegt nur das Aussehen der Zellen.

  Der Trick, der beides zusammenbringt: Die Items tragen bewusst KEINE `id`.
  `TableDesktop` keyt dann nach Index (`item.id ?? i`), die Zeilen bleiben also
  an ihrer Position stehen und nur die Werte wechseln — genau was ein Fallblatt
  braucht. Mit stabilen IDs würde die Tabelle die DOM-Knoten verschieben, die
  Zellwerte blieben unverändert, und es gäbe nichts zu blättern.

  Jede Zelle blättert selbst (`FlapCell`); der gemeinsame Takt liegt im
  Scheduler. Herleitung: prototypes/landing-board/BEFUNDE.md
-->
<script lang="ts" module>
  export interface BoardRow {
    name: string;
    family: string;
    /** min+gzip in Bytes; `null`, wenn das Paket keine Baseline führt. */
    gz: number | null;
    deps: 0;
    status: 'shipped' | 'beta' | 'in progress';
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { Table } from '@urbicon-ui/table';
  import FlapCell from './FlapCell.svelte';

  interface Props {
    rows: BoardRow[];
    /** Vorausgewählte Zeile — das Schwergewicht gehört in die erste Sekunde. */
    initialSelection?: string;
    onselect?: (row: BoardRow) => void;
  }

  let { rows, initialSelection = 'Sankey', onselect }: Props = $props();

  function formatGz(row: BoardRow): string {
    return row.gz == null ? '—' : `${(row.gz / 1024).toFixed(1)} kB`;
  }

  // Feldzahlen aus den Daten, nicht geraten: Ein abgeschnittenes
  // "ReasoningDisclosu" macht aus der Anzeige eine, die lügt.
  function widthOf(values: string[], label: string): number {
    return values.reduce((max, v) => Math.max(max, v.length), label.length);
  }

  // Die Feldzahlen stehen einmal fest und ändern sich nie wieder — sonst
  // müssten die Zellen beim Sortieren ihre Breite ändern, und genau das darf
  // ein Fallblatt nicht. `untrack` macht die Absicht explizit.
  const W = untrack(() => ({
    name: widthOf(
      rows.map((r) => r.name),
      'Component'
    ),
    family: widthOf(
      rows.map((r) => r.family),
      'Family'
    ),
    gz: widthOf(rows.map(formatGz), 'Gzip'),
    deps: 4,
    status: widthOf(
      rows.map((r) => r.status),
      'Status'
    )
  }));

  function pick(row: BoardRow) {
    onselect?.(row);
  }

  $effect(() => {
    const row = untrack(() => rows).find((r) => r.name === untrack(() => initialSelection));
    if (row) onselect?.(row);
  });
</script>

{#snippet nameCell(item: BoardRow)}
  <FlapCell value={item.name} width={W.name} />
{/snippet}
{#snippet familyCell(item: BoardRow)}
  <FlapCell value={item.family} width={W.family} />
{/snippet}
{#snippet gzCell(item: BoardRow)}
  <FlapCell value={formatGz(item)} width={W.gz} align="right" />
{/snippet}
{#snippet depsCell(item: BoardRow)}
  <!-- Die Signatur: die Nullen untereinander, in der Livery-Farbe — der
       einzige farbige Ort im ganzen Board, und zugleich die Primärfarbe der
       echten Komponenten daneben. -->
  <span class="deps">
    <FlapCell value={String(item.deps)} width={W.deps} align="right" />
  </span>
{/snippet}
{#snippet pagination()}{/snippet}

{#snippet statusCell(item: BoardRow)}
  <span class:muted={item.status !== 'shipped'}>
    <FlapCell value={item.status} width={W.status} />
  </span>
{/snippet}

<div class="board-wrap">
  <Table
    items={rows}
    columns={[
      { accessor: 'name', title: 'Component', sortable: true, cell: nameCell },
      { accessor: 'family', title: 'Family', sortable: true, cell: familyCell },
      { accessor: 'gz', title: 'Gzip', sortable: true, cell: gzCell },
      { accessor: 'deps', title: 'Deps', cell: depsCell },
      { accessor: 'status', title: 'Status', sortable: true, cell: statusCell }
    ]}
    onRowClick={(row: BoardRow) => pick(row)}
    itemsPerPage={rows.length}
    variant="flush"
    size="sm"
    ariaLabel="Components in the set"
    {pagination}
  />
</div>

<style>
  .board-wrap {
    /* Das Board endet, wo seine Spalten enden — ein Anzeigebrett hat Kanten. */
    position: relative;
    width: fit-content;
    max-width: 100%;
  }

  /* Status weicht in der Helligkeit ab, nicht in der Farbe: Farbe ist im Board
     für genau eine Sache reserviert. */
  .muted :global(.ch) {
    color: var(--dim);
  }
  .deps :global(.ch) {
    color: var(--livery);
    transition: color 0.45s ease;
  }
</style>
