<!--
  Landing prototype — "3-Zeilen-Journey", Stufe 2 (Kachel-Inhalte + Kanal-Livery).
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare). Jede Kachel scopet die primary-Familie auf ihren Kanal
  (`.room-accent` aus rooms.css) — die lebenden Komponenten tragen die Livery
  ihrer Kachel. Zeile 2/3 sind Peek-Dummies.
  Konzept: docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
  NICHT verlinkt, noindex — reine Testroute.
-->
<!-- urbicon-ignore magic-dimension inline-style — prototype scope: the solid-colour
     channel pairs and hand-tuned row heights ARE the experiment; they move into
     the token system once the direction is confirmed -->
<script lang="ts">
  import {
    A2UIView,
    Avatar,
    Badge,
    Button,
    NumberInput,
    Scroller,
    SegmentGroup,
    SegmentItem,
    URBICON_A2UI_CATALOG_ID,
    urbiconA2uiCatalog
  } from '@urbicon-ui/blocks';
  import { Table } from '@urbicon-ui/table';
  // Nur für `.room-accent` (primary-Familie aus --room-accent/--room-accent-fg
  // abgeleitet) — der Rest der Rooms-Klassen bleibt ungenutzt.
  import '$lib/style/rooms.css';

  // Cusp-Palette: Vollton = Sättigungsmaximum des Hues, Tiefe einheitlich
  // L 0.32 im selben Hue. Jeder Kanal ist ein light-dark()-Paar (light:
  // Vollton-Fläche/Tiefe-Text, dark: invertiert). Werte aus der
  // OKLCH-Analyse vom 2026-07-29 (Variante B).
  const TILES = [
    {
      key: 'blocks',
      no: '01',
      title: 'Blocks',
      line: '38 primitives, one grip',
      solid: 'oklch(0.68 0.209 40)',
      deep: 'oklch(0.32 0.09 40)'
    },
    {
      key: 'table',
      no: '02',
      title: 'Table',
      line: 'An enterprise grid, zero deps',
      solid: 'oklch(0.88 0.147 200)',
      deep: 'oklch(0.32 0.054 200)'
    },
    {
      key: 'a2ui',
      no: '03',
      title: 'A2UI',
      line: 'UI inside the chat, themed',
      solid: 'oklch(0.7 0.31 330)',
      deep: 'oklch(0.32 0.09 330)'
    },
    {
      key: 'agent',
      no: '04',
      title: 'Agents',
      line: 'It builds — the gate watches',
      solid: 'oklch(0.87 0.267 145)',
      deep: 'oklch(0.32 0.09 145)'
    },
    {
      key: 'more',
      no: '05',
      title: '…and more',
      line: 'The rest of the set, one row down',
      solid: 'oklch(0.91 0.184 100)',
      deep: 'oklch(0.32 0.067 100)'
    }
  ];

  // ── 01 Blocks: Mini-Collage lebender Primitives ────────────────────
  let view = $state('board');
  let team = $state(8);

  // ── 02 Table: der eigene Bestand als Mini-Board (Selbstreferenz) ───
  // net-gz aus bundle-size.baseline.json, Stand 2026-07-29.
  // TODO Stufe 3: build-time ableiten statt abschreiben.
  const BOARD = [
    { id: 'table', component: 'Table', pkg: 'table', gz: 68.5 },
    { id: 'datepicker', component: 'DatePicker', pkg: 'blocks', gz: 48.3 },
    { id: 'sankey', component: 'Sankey', pkg: 'blocks', gz: 10.1 }
  ];
  let boardSelected = $state<string[]>(['table']);

  // ── 03 A2UI: echter Renderer, echter Katalog, statisches Payload ───
  const A2UI_PAYLOAD = [
    {
      version: 'v0.9.1',
      createSurface: { surfaceId: 'tile-booking', catalogId: URBICON_A2UI_CATALOG_ID }
    },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'tile-booking',
        components: [
          { id: 'root', component: 'Card', child: 'col' },
          { id: 'col', component: 'Column', children: ['title', 'guests', 'submit'] },
          { id: 'title', component: 'Text', text: 'Book a table', variant: 'h4' },
          { id: 'guests', component: 'Input', label: 'Guests', value: { path: '/guests' } },
          { id: 'submit-label', component: 'Text', text: 'Reserve' },
          {
            id: 'submit',
            component: 'Button',
            intent: 'primary',
            child: 'submit-label',
            action: { event: { name: 'reserve', context: { guests: { path: '/guests' } } } }
          }
        ]
      }
    },
    {
      version: 'v0.9.1',
      updateDataModel: { surfaceId: 'tile-booking', value: { guests: '4' } }
    }
  ];

  // ── 05 Treppe: die restlichen Register, Zahlen aus dem Konzept ─────
  const STEPS = [
    '44 composites',
    '315 icons',
    'i18n · EN & DE',
    'charts',
    'chat',
    'auth',
    'theming'
  ];

  // Platzhalter — final build-time abgeleitet (siehe +page.server.ts der Landing).
  const PROOF = '97 components · 0 dependencies · 315 icons';
</script>

<svelte:head>
  <title>Landing-Prototyp — 3-Zeilen-Journey</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="proto">
  <!-- ── Zeile 1: erinnern + staunen ─────────────────────────────── -->
  <section class="row1" aria-label="Hero">
    <div class="name-tile">
      <div>
        <p class="brand">
          urbicon{#each TILES as tile (tile.key)}<span class="tick" style:background={tile.solid}
            ></span>{/each}
        </p>
        <p class="claim">Everything in it was made in it.</p>
      </div>
      <p class="proof">{PROOF}</p>
    </div>

    <div class="attractions">
      <!-- Overlay-Steuerung als slotClasses-Experiment (keine Komponentenänderung):
           Pfeile links/rechts mittig, Dots als Chip unten mittig. Bewährt sich das,
           wird es eine echte Achse (controlsPlacement) am Scroller. -->
      <Scroller
        label="Highlights"
        itemBasis="85%"
        indicator="dots"
        class="relative"
        slotClasses={{
          viewport: '!gap-0 !py-0',
          controls: '!absolute inset-0 !pt-0 !justify-between px-4 pointer-events-none',
          control: 'pointer-events-auto shadow-md',
          indicator:
            '!absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto rounded-full bg-surface-base/85 px-2 py-1'
        }}
      >
        {#each TILES as tile (tile.key)}
          <article
            class="tile room-accent"
            style:--tile-solid={tile.solid}
            style:--tile-deep={tile.deep}
          >
            <span class="no">{tile.no}</span>
            <div class="tile-body">
              {#if tile.key === 'blocks'}
                <div class="card specimen">
                  <SegmentGroup bind:value={view} size="sm" ariaLabel="View">
                    <SegmentItem value="board">Board</SegmentItem>
                    <SegmentItem value="list">List</SegmentItem>
                  </SegmentGroup>
                  <NumberInput label="Team" bind:value={team} min={1} max={48} size="sm" />
                  <Button intent="primary" size="sm">Save draft</Button>
                  <Badge intent="success">shipped</Badge>
                  <Avatar name="Urbicon UI" size="sm" />
                </div>
              {:else if tile.key === 'table'}
                <div class="card card-table">
                  <Table
                    items={BOARD}
                    columns={[
                      { accessor: 'component', title: 'Component', sortable: true },
                      { accessor: 'pkg', title: 'Pkg' },
                      { accessor: 'gz', title: 'net gz (kB)', sortable: true }
                    ]}
                    selectionMode="single"
                    selectedIds={boardSelected}
                    onSelectionChange={(items) => (boardSelected = items.map((r) => r.id))}
                    enableSmartFilter={false}
                    enableColumnVisibility={false}
                    variant="flush"
                    slotClasses={{ table: '!min-w-0' }}
                  />
                </div>
              {:else if tile.key === 'a2ui'}
                <div class="a2ui-host">
                  <A2UIView payload={A2UI_PAYLOAD} catalogs={[urbiconA2uiCatalog]} />
                </div>
              {:else if tile.key === 'agent'}
                <!-- Gestalteter Loop-Auszug. Stufe 3 ersetzt ihn durch ein
                     aufgezeichnetes echtes Transkript im Replay (Echtheitsregel). -->
                <div class="term">
                  <p><span class="dim">$</span> claude "add a pricing section"</p>
                  <p><span class="ok">✚</span> src/routes/pricing/+page.svelte</p>
                  <p><span class="dim">▸</span> urbicon validate</p>
                  <p><span class="ok">✓</span> tokens · focus-visible · no magic numbers</p>
                </div>
              {:else}
                <ol class="steps">
                  {#each STEPS as step, i (step)}
                    <li style:margin-inline-start={`${i * 1.1}em`}>{step}</li>
                  {/each}
                </ol>
              {/if}
            </div>
            <div>
              <h2 class="tile-title">{tile.title}</h2>
              <p class="tile-line">{tile.line}</p>
            </div>
          </article>
        {/each}
      </Scroller>
    </div>
  </section>

  <!-- ── Zeile 2: erforschen (Dummy für den Peek-Test) ───────────── -->
  <section class="row-dummy row2" aria-label="Components (placeholder)">
    <p class="dummy-label">Zeile 2 — Component-Liste mit Detailansicht</p>
  </section>

  <!-- ── Zeile 3: handeln (Dummy) ────────────────────────────────── -->
  <section class="row-dummy row3" aria-label="Getting started (placeholder)">
    <p class="dummy-label">Zeile 3 — Getting started in 3 Schritten</p>
  </section>
</main>

<style>
  .proto {
    --paper: light-dark(#f4f4f2, #0d0d0d);
    --ink: light-dark(#111111, #f4f4f2);
    background: var(--paper);
    color: var(--ink);
    /* Fugenlos (Asphalt-Logik): Flächen stoßen aneinander, die Kante ist der
       Farbwechsel. Kein Außenrand — full-bleed. */
    display: grid;
  }

  /* ── Zeile 1 ─────────────────────────────────────────────────── */
  .row1 {
    display: grid;
  }
  @media (min-width: 48rem) {
    .row1 {
      grid-template-columns: 1fr 1fr;
    }
  }

  .name-tile {
    background: light-dark(#141414, #191919);
    color: #f4f4f2;
    padding: clamp(20px, 2.5vw, 36px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2rem;
  }
  .brand {
    font-size: clamp(2.4rem, 5vw, 4rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  .tick {
    display: inline-block;
    width: 0.42em;
    height: 0.09em;
    margin-left: 0.06em;
    vertical-align: 0.1em;
  }
  .claim {
    margin-top: 0.75rem;
    font-size: clamp(1.1rem, 1.8vw, 1.5rem);
    max-width: 24ch;
    text-wrap: balance;
  }
  .proof {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    opacity: 0.65;
  }

  .attractions {
    min-width: 0;
  }

  /* ── Kanal-Kacheln ───────────────────────────────────────────── */
  .tile {
    background: light-dark(var(--tile-solid), var(--tile-deep));
    color: light-dark(var(--tile-deep), var(--tile-solid));
    height: clamp(380px, 52vh, 580px);
    padding: clamp(16px, 1.8vw, 26px);
    /* Freie Zone unter der Titelgruppe, in der der Dots-Chip (Overlay, 32px)
       liegt, ohne die Beschreibung zu überlappen. */
    padding-bottom: calc(clamp(16px, 1.8vw, 26px) + 44px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    /* Kanal-Livery: `.room-accent` (rooms.css) leitet die komplette
       primary-Familie aus diesen zwei Vars ab — Vollton als primary,
       Tiefe als text-on-primary, in beiden Modi. */
    --room-accent: var(--tile-solid);
    --room-accent-fg: var(--tile-deep);
  }
  .no {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    opacity: 0.8;
  }
  .tile-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem 0;
    min-height: 0;
  }
  .tile-title {
    font-size: clamp(1.5rem, 2.4vw, 2.2rem);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .tile-line {
    font-size: 0.9rem;
    opacity: 0.85;
  }

  /* Neutrale Karte für lebende Komponenten auf der Vollton-Fläche —
     das Muster der alten Landing (Farbfeld hält eine neutrale Bühne). */
  .card {
    background: light-dark(#ffffff, #141414);
    padding: 1.25rem;
    width: min(420px, 100%);
  }
  .specimen {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .card-table {
    padding: 0.5rem;
    max-height: 100%;
    overflow: hidden;
  }
  .a2ui-host {
    width: min(320px, 100%);
    max-height: 100%;
    overflow: hidden;
  }

  /* Terminal ist in beiden Modi dunkel; die Akzente kommen aus der
     Kanal-Livery (primary = Vollton-Grün der Kachel). */
  .term {
    background: #101010;
    color: #d8d8d2;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px;
    line-height: 1.9;
    padding: 1rem 1.25rem;
    width: min(400px, 100%);
  }
  .term .dim {
    opacity: 0.55;
  }
  .term .ok {
    color: var(--color-primary);
  }

  /* Typo-Treppe der restlichen Register. */
  .steps {
    list-style: none;
    font-weight: 800;
    font-size: clamp(1rem, 1.5vw, 1.35rem);
    letter-spacing: -0.01em;
    line-height: 1.55;
  }

  /* ── Zeilen-Dummies ──────────────────────────────────────────── */
  .row-dummy {
    display: grid;
    place-items: center;
    border: 1px dashed light-dark(#c9c9c4, #333333);
    color: light-dark(#77776f, #8a8a84);
  }
  .row2 {
    min-height: 75vh;
  }
  .row3 {
    min-height: 45vh;
  }
  .dummy-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
  }
</style>
