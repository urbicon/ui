<!--
  Das Fallblatt-Board des Landing-Heros: der Bestand der Library als
  Abflugtafel. Die Signatur ist die DEPS-Spalte — eine Säule aus Nullen, so
  hoch wie das Set.

  Warum keine `Table`: Die Flap-Animation braucht positionsstabile Zellen —
  Position bleibt, Inhalt wechselt. `TableDesktop` iteriert keyed über
  `item.id`, verschiebt also bei einer Sortierung die DOM-Knoten. Genau
  andersherum. Siehe docs/internal/LANDING-CONCEPT-2026-07.md.

  Svelte rendert hier nur die leere Struktur; die Zeichen bespielt
  `FlapEngine` imperativ — 5 000 einzeln reaktive Felder wären um
  Größenordnungen teurer als `textContent`.

  OFFENER BUG — die Engine läuft der Anzeige einen Schritt hinterher: Nach
  einer Sortierung tragen `aria-label` und `data-status` bereits die neue
  Reihenfolge, die Flaps noch die vorherige. Reproduktion und die bereits
  ausgeschlossenen Ursachen stehen in
  prototypes/landing-board/BEFUNDE.md, Abschnitt 7.
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
  import { FlapEngine, type FlapColumn } from './flap-engine';

  interface Props {
    rows: BoardRow[];
    /** Vorausgewählte Zeile — das Schwergewicht gehört in die erste Sekunde. */
    initialSelection?: string;
    onselect?: (row: BoardRow) => void;
  }

  let { rows, initialSelection = 'Sankey', onselect }: Props = $props();

  const ROW_HEIGHT = 26;

  // Die Struktur des Boards — Spaltenbreiten und die Zahl der Zeichenfelder —
  // wird einmal aus der anfänglichen Zeilenmenge gebaut und danach nur noch
  // bespielt. Das ist die Bedingung für die Animation: Position bleibt, Inhalt
  // wechselt. `untrack` macht diese Absicht explizit, statt die Warnung
  // "state_referenced_locally" stehenzulassen.
  const initialRows = untrack(() => rows);
  const initialName = untrack(() => initialSelection);

  function formatGz(row: BoardRow): string {
    return row.gz == null ? '—' : `${(row.gz / 1024).toFixed(1)} kB`;
  }

  // Spaltenbreiten aus den Daten, nicht geraten: Ein abgeschnittenes
  // "ReasoningDisclosu" macht aus der Anzeige eine, die lügt. Die Überschrift
  // steht gesperrt in Versalien und braucht mehr Platz als ihre Zeichenzahl.
  function widthFor(label: string, values: string[]): number {
    return values.reduce((max, v) => Math.max(max, v.length), Math.ceil(label.length * 1.35));
  }

  const columns: FlapColumn<BoardRow>[] = [
    {
      key: 'name',
      label: 'Component',
      align: 'l',
      width: widthFor(
        'Component',
        initialRows.map((r) => r.name)
      )
    },
    {
      key: 'family',
      label: 'Family',
      align: 'l',
      width: widthFor(
        'Family',
        initialRows.map((r) => r.family)
      )
    },
    {
      key: 'gz',
      label: 'Gzip',
      align: 'r',
      format: formatGz,
      width: widthFor('Gzip', initialRows.map(formatGz))
    },
    { key: 'deps', label: 'Deps', align: 'r', width: widthFor('Deps', ['0']) },
    {
      key: 'status',
      label: 'Status',
      align: 'l',
      width: widthFor(
        'Status',
        initialRows.map((r) => r.status)
      )
    }
  ];

  let sortKey = $state<keyof BoardRow>('name');
  let sortDir = $state(1);
  let selectedName = $state(initialName);
  let hostEl = $state<HTMLElement>();

  /** Eine Quelle für Markup und Engine — sonst driften Labels und Flaps. */
  function sortRows(list: BoardRow[], key: keyof BoardRow, dir: number): BoardRow[] {
    return [...list].sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (x == null && y == null) return 0;
      // Zeilen ohne Wert stehen immer hinten, unabhängig von der Richtung.
      if (x == null) return 1;
      if (y == null) return -1;
      const cmp = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y));
      return cmp * dir;
    });
  }

  const sorted = $derived(sortRows(rows, sortKey, sortDir));

  // Die Markierung hängt am Namen, nicht an der Bildschirmposition: Nach einer
  // Sortierung steht dort eine andere Komponente.
  const selectedIndex = $derived(sorted.findIndex((r) => r.name === selectedName));

  const engine = new FlapEngine<BoardRow>(columns);

  // Attach-Funktionen einmal vorab: Eine inline erzeugte Funktion wäre bei
  // jeder Neuauswertung eine neue Referenz und würde Svelte zu einem
  // detach/attach-Zyklus zwingen.
  const attachers = initialRows.map((_, r) =>
    columns.map((col, ci) =>
      Array.from(
        { length: col.width },
        (_unused, k) => (el: HTMLElement) => engine.register(r, ci, k, el)
      )
    )
  );

  let firstPaint = true;

  // Die Sortierung wird hier selbst gerechnet statt aus dem `sorted`-Derived
  // gelesen: Über das Derived lief die Engine der Anzeige zuverlässig **einen
  // Schritt hinterher** — die Flaps zeigten den Stand, den die Labels vor dem
  // letzten Klick hatten. Direkt an `sortKey`/`sortDir` gehängt, ist die
  // Reihenfolge eindeutig.
  $effect(() => {
    const list = sortRows(rows, sortKey, sortDir);
    if (hostEl) {
      const from = Math.max(0, Math.floor(hostEl.scrollTop / ROW_HEIGHT));
      engine.setVisibleRange(from, from + Math.ceil(hostEl.clientHeight / ROW_HEIGHT) + 2);
    }
    engine.update(list, firstPaint);
    firstPaint = false;
  });

  $effect(() => {
    // rAF und Web-Animationen ruhen in unsichtbaren Tabs, aber nicht synchron.
    // Statt eine halb gerollte Anzeige zurückzulassen: sofort finalisieren.
    const onHide = () => {
      if (document.visibilityState === 'hidden') engine.finalize();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      // KEIN engine.destroy() hier. Läuft dieser Effect erneut, leerte es die
      // Registrierung der Zeichenfelder — und `{@attach}` meldet sie nicht neu
      // an, weil die Elemente ja bestehen bleiben. Das Board blieb danach auf
      // dem Stand der vorletzten Sortierung stehen, während die Labels bereits
      // die aktuelle trugen.
      //
      // Aufräumen ist auch gar nicht nötig: `register()` gibt sein eigenes
      // Cleanup zurück, das jedes Feld beim Verschwinden austrägt.
      engine.finalize();
    };
  });

  function sortBy(key: keyof BoardRow) {
    sortDir = key === sortKey ? -sortDir : 1;
    sortKey = key;
  }

  // Die Auswahl meldet sich direkt aus dem Ereignis, nicht aus einem Effect:
  // Ein State-Write der Elternkomponente während der Effect-Phase stört deren
  // Reihenfolge.
  function select(index: number) {
    const row = sorted[index];
    if (!row) return;
    selectedName = row.name;
    onselect?.(row);
  }

  // Einmalig die Vorauswahl melden, damit das Panel nicht leer startet.
  $effect(() => {
    const row = untrack(() => sorted).find((r) => r.name === initialName);
    if (row) onselect?.(row);
  });

  /** Der Zellinhalt als zusammenhängender Text — siehe `aria-label` im Markup. */
  function cellLabel(row: BoardRow | undefined, col: FlapColumn<BoardRow>): string {
    if (!row) return '';
    return col.format ? col.format(row) : String(row[col.key as keyof BoardRow]);
  }
</script>

<!--
  Echte Grid-Semantik: Optisch ist das Board ein Objekt, strukturell bleibt es
  eine Datentabelle, und assistive Technik muss sie als solche vorfinden.

  Entscheidend sind die `aria-label` auf den Zellen zusammen mit `aria-hidden`
  auf den Zeichenfeldern: Ohne sie liest ein Screenreader jedes Feld einzeln
  vor und buchstabiert "S-a-n-k-e-y". Der Text steht deshalb einmal am
  Zellcontainer; die Flaps darin sind reine Optik.
-->
<div class="board-wrap">
  <div
    class="board"
    role="grid"
    aria-label="Components in the set"
    aria-rowcount={initialRows.length}
  >
    <div class="row head" role="row">
      {#each columns as col (col.key)}
        <div
          role="columnheader"
          class="head-cell"
          style:width="{col.width}ch"
          aria-sort={col.key === sortKey ? (sortDir === 1 ? 'ascending' : 'descending') : 'none'}
        >
          <button
            type="button"
            class={['col-head', col.key === sortKey && 'active']}
            style:text-align={col.align === 'r' ? 'right' : 'left'}
            onclick={() => sortBy(col.key as keyof BoardRow)}
          >
            {col.label}
          </button>
        </div>
      {/each}
    </div>

    <div class="rows" bind:this={hostEl}>
      {#each initialRows as _row, r (r)}
        <div
          class={['row', r === selectedIndex && 'selected']}
          data-status={sorted[r]?.status}
          role="row"
          aria-rowindex={r + 1}
          aria-selected={r === selectedIndex}
          tabindex="0"
          onclick={() => select(r)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              select(r);
            }
          }}
        >
          {#each columns as col, ci (col.key)}
            <div
              class={['cell', col.align === 'r' && 'num', col.key === 'deps' && 'deps']}
              role="gridcell"
              aria-label={cellLabel(sorted[r], col)}
            >
              {#each attachers[r][ci] as attach, k (k)}
                <div class="ch blank" aria-hidden="true" {@attach attach}>&nbsp;</div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .board-wrap {
    /* Das Board endet, wo seine Spalten enden — ein Anzeigebrett hat Kanten. */
    position: relative;
    width: fit-content;
    max-width: 100%;
  }
  .board-wrap::after {
    /* Die letzte Zeile läuft aus, statt hart abzubrechen: Das Board wirkt
       dadurch tiefer als sein Ausschnitt. */
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: 46px;
    background: linear-gradient(to bottom, transparent, var(--deck));
    pointer-events: none;
  }

  .rows {
    /* Feste Bauhöhe: Das Board ist ein Objekt, kein Dokument — gescrollt wird
       *im* Board, nicht an ihm vorbei. */
    height: min(52vh, 620px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: 10px;
  }
  /* Nur die Pseudoelemente, kein `scrollbar-width`/`scrollbar-color`: Sobald
     die Standard-Eigenschaften greifen, ignoriert WebKit die Pseudoelemente
     und macOS zeigt eine Overlay-Leiste, die erst beim Scrollen erscheint —
     also keine Affordance für jemanden, der noch nicht scrollt. */
  .rows::-webkit-scrollbar {
    width: 11px;
  }
  .rows::-webkit-scrollbar-track {
    background: var(--seam);
    border-radius: 6px;
  }
  .rows::-webkit-scrollbar-thumb {
    background: #3a413d;
    border: 2px solid var(--seam);
    border-radius: 6px;
  }
  .rows:hover::-webkit-scrollbar-thumb {
    background: #4d554f;
  }

  .row {
    display: flex;
    gap: 10px;
    height: 26px;
    align-items: stretch;
  }
  .row:not(.head) {
    cursor: pointer;
  }
  .row.head {
    margin-bottom: 8px;
    height: 24px;
  }
  .row.selected :global(.ch) {
    --flap: #242a27;
    --flap-hi: #2b312d;
    --seam: #1e2421;
  }
  .row:focus-visible {
    outline: 2px solid var(--livery);
    outline-offset: 2px;
  }

  .head-cell {
    flex: none;
  }
  .col-head {
    /* Der Button füllt seine Spalte — die Breite sitzt auf dem
       `columnheader`, damit sie mit der Zelle darunter übereinstimmt. */
    width: 100%;
    font: inherit;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--dim);
    background: none;
    border: 0;
    border-bottom: 1px solid #33343a;
    padding: 0 0 5px;
    cursor: pointer;
  }
  .col-head:hover {
    color: var(--bone);
  }
  .col-head.active {
    color: var(--livery);
    border-bottom-color: var(--livery);
  }
  .col-head:focus-visible {
    outline: 2px solid var(--livery);
    outline-offset: 2px;
  }

  .cell {
    display: flex;
    gap: 1px;
    flex: none;
  }
  .cell.num {
    justify-content: flex-end;
  }

  /* Ein Zeichen = ein Flap. Obere Hälfte fängt Licht, in der Mitte die Kante,
     darunter die abgewandte Fläche — drei Werte statt eines Kastens. Die
     Kante ist bewusst schwach: Bei stärkerem Kontrast verbanden sich die
     Nähte aller Zellen zu einem Band quer durch die Zeile. */
  .cell :global(.ch) {
    width: 1ch;
    display: grid;
    place-items: center;
    font-family: var(--flap-font);
    font-stretch: var(--flap-stretch);
    font-size: var(--flap-size);
    line-height: 1;
    background: linear-gradient(
      to bottom,
      var(--flap-hi) 0%,
      var(--flap-hi) calc(50% - 0.5px),
      var(--seam) 50%,
      var(--flap) calc(50% + 0.5px),
      var(--flap) 100%
    );
    border-radius: 1.5px;
    overflow: hidden;
  }
  /* Leerstellen bleiben Blätter — ein Board hat auch dort eine Klappe, wo
     nichts steht. Nur unbeschriftet. */
  .cell :global(.ch.blank) {
    opacity: 0.55;
  }
  .cell :global(.ch.rolling) {
    color: #cfcabb;
    will-change: transform;
  }

  /* Status weicht in der Helligkeit ab, nicht in der Farbe: Farbe ist im Board
     für genau eine Sache reserviert. */
  .row[data-status='beta'] .cell:last-child :global(.ch),
  .row[data-status='in progress'] .cell:last-child :global(.ch) {
    color: var(--dim);
  }
  /* Die Signatur: die Nullen untereinander, in der Livery-Farbe — der einzige
     farbige Ort im ganzen Board, und zugleich die Primärfarbe der echten
     Komponenten daneben. */
  .cell.deps :global(.ch) {
    color: var(--livery);
    transition: color 0.45s ease;
  }
</style>
