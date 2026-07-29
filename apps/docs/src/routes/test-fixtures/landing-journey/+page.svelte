<!--
  Landing prototype — "3-Zeilen-Journey", Stufe 2 (Kachel-Inhalte + Kanal-Livery).
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare). Jede Kachel scopet die primary-Familie auf ihren Kanal
  (`.room-accent` aus rooms.css) — die lebenden Komponenten tragen die Livery
  ihrer Kachel. Zeile 2: das Hero-Inventar (test-fixtures/landing-hero) als
  niedrigere Zeile — gleiche Daten (Loader-Re-Export), gleiche geteilte
  Playgrounds, Familien-Kanal der Auswahl als Farb-Echo. Zeile 3: Getting
  started in drei fugenlosen Schritten, Schritt 3 (Agents-Grün) übergibt an
  den Agenten. Alle Farben aus dem generierten Register ($lib/landing/channels).
  Konzept: docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
  NICHT verlinkt, noindex — reine Testroute.
-->
<!-- urbicon-ignore magic-dimension inline-style — prototype scope: the solid-colour
     channel pairs and hand-tuned row heights ARE the experiment; they move into
     the token system once the direction is confirmed -->
<script lang="ts">
  import { CHANNELS, channelForFamily, TILE_CHANNEL } from '$lib/landing/channels';
  import HeroSpecimen from '$lib/landing/HeroSpecimen.svelte';
  import { formatKb, type HeroRow, SHARED_PREVIEW_NOTES } from '$lib/landing/hero';
  import {
    A2UIView,
    Avatar,
    Badge,
    Button,
    Input,
    NumberInput,
    Scroller,
    SegmentGroup,
    SegmentItem,
    URBICON_A2UI_CATALOG_ID,
    urbiconA2uiCatalog
  } from '@urbicon-ui/blocks';
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { useUrlParam } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { Table } from '@urbicon-ui/table';
  import type { Component } from 'svelte';
  import type { PageData } from './$types';
  // Nur für `.room-accent` (primary-Familie aus --room-accent/--room-accent-fg
  // abgeleitet) — der Rest der Rooms-Klassen bleibt ungenutzt.
  import '$lib/style/rooms.css';

  let { data }: { data: PageData } = $props();

  // Alle Kanal-Farben kommen aus dem generierten Register (channels.ts,
  // Cusp-Formel + gemessene on-Farben) — hier wird nur noch referenziert.
  const TILES = [
    {
      key: 'blocks',
      no: '01',
      title: 'Blocks',
      line: '38 primitives, one grip',
      channel: CHANNELS[TILE_CHANNEL.blocks]
    },
    {
      key: 'table',
      no: '02',
      title: 'Table',
      line: 'An enterprise grid, zero deps',
      channel: CHANNELS[TILE_CHANNEL.table]
    },
    {
      key: 'a2ui',
      no: '03',
      title: 'A2UI',
      line: 'UI inside the chat, themed',
      channel: CHANNELS[TILE_CHANNEL.a2ui]
    },
    {
      key: 'agent',
      no: '04',
      title: 'Agents',
      line: 'It builds — the gate watches',
      channel: CHANNELS[TILE_CHANNEL.agents]
    },
    {
      key: 'more',
      no: '05',
      title: '…and more',
      line: 'The rest of the set, one row down',
      channel: CHANNELS[TILE_CHANNEL.more]
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

  // ── Zeile 2: das Hero-Inventar als niedrigere Zeile ────────────────
  // Mechanik 1:1 aus test-fixtures/landing-hero: die Vorschau ist der gepflegte
  // Playground der Doku-Seite (zwei Konsumenten, eine Wahrheit), lazy geladen.
  const MODULES = import.meta.glob([
    '/src/routes/blocks/**/Playground.svelte',
    '/src/routes/table/**/Playground.svelte',
    '/src/routes/auth/**/Playground.svelte',
    '/src/routes/auth/**/examples/BasicDemo.svelte',
    '/src/routes/auth/**/examples/Basic.svelte'
  ]) as Record<string, () => Promise<{ default: Component }>>;

  function keyOf(path: string): string {
    const segments = path.split('/');
    const slug = segments[segments.indexOf('examples') - 1] ?? segments[segments.length - 2];
    return `${segments[3]}:${slug}`;
  }

  interface Specimen {
    load: () => Promise<{ default: Component }>;
    interactive: boolean;
    docsHref: string;
    rank: number;
  }

  function docsHrefOf(path: string): string {
    const route = path.replace('/src/routes', '').replace(/\/(examples\/)?[^/]+\.svelte$/, '');
    return route.startsWith('/blocks/components/guide-') ? '/blocks/components/guide' : route;
  }

  function rankOf(path: string): number {
    if (path.endsWith('/Playground.svelte')) return 0;
    if (path.endsWith('/BasicDemo.svelte')) return 1;
    return 2;
  }

  const SPECIMENS: Partial<Record<string, Specimen>> = {};
  for (const [path, load] of Object.entries(MODULES)) {
    const key = keyOf(path);
    const rank = rankOf(path);
    const current = SPECIMENS[key];
    if (!current || rank < current.rank) {
      SPECIMENS[key] = { load, interactive: rank === 0, docsHref: docsHrefOf(path), rank };
    }
  }

  let query = $state('');

  // Auswahl in der URL (teilbar, überlebt den Zurück-Knopf) — wie im Hero.
  const [selectedSlug, setSelectedSlug] = useUrlParam<string | null>('c', {
    parse: (sp) => sp.get('c'),
    serialize: (value) => new URLSearchParams(value ? { c: value } : {}),
    initial: null,
    replaceState: false
  });

  const selected = $derived<HeroRow>(
    data.rows.find((r) => r.slug === selectedSlug()) ??
      data.rows.find((r) => r.name === 'Sankey') ??
      data.rows[0]
  );

  const specimen = $derived(SPECIMENS[`${selected.pkg}:${selected.slug}`]);
  const sharedNote = $derived(SHARED_PREVIEW_NOTES[selected.slug]);

  // Zeile 2 bleibt federleicht, erbt aber den Familien-Kanal der gewählten
  // Komponente (Ebene 2 des Registers). EINE Farbsemantik über beide Zeilen;
  // getragen nur von Selektion, Pfeil und den lebenden Playgrounds
  // (room-accent), nicht von Flächen.
  const selectedChannel = $derived(channelForFamily(selected.family));

  // Slot-Eingriffe des Hero, unverändert: äußere Rahmung des Configurators
  // abräumen, linke Kante angleichen, eigener Grund unter der Bühne.
  const PLAYGROUND_SLOTS = {
    root: '!border-0 !bg-transparent !p-0 !shadow-none !gap-0',
    preview: '!bg-surface-elevated !rounded-t-xl !px-5 !py-6',
    previewContent: '!justify-start',
    controlsPanel: '!bg-transparent !px-5 !pb-5 !pt-0',
    controlsHeader: '!mx-0 !px-0',
    controlsGrid: '!mx-0 !px-0',
    codePanel: '!bg-transparent !px-0',
    codeToolbar: '!px-0'
  };
</script>

<svelte:head>
  <title>Landing-Prototyp — 3-Zeilen-Journey</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- Englisch gepinnt wie im Hero: sonst rutschen Playground-Labels und
     Calendar-Monatsnamen in die Browser-Sprache, mitten in eine englische Seite. -->
<I18nProvider locale="en">
  <main class="proto" lang="en">
    <!-- ── Zeile 1: erinnern + staunen ─────────────────────────────── -->
    <section class="row1" aria-label="Hero">
      <div class="name-tile">
        <div>
          <p class="brand">
            urbicon{#each TILES as tile (tile.key)}<span
                class="tick"
                style:background={tile.channel.solid}
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
              style:--tile-solid={tile.channel.solid}
              style:--tile-deep={tile.channel.deep}
              style:--tile-on={tile.channel.on}
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

    <!-- ── Zeile 2: erforschen — das Inventar mit Detailansicht ────── -->
    <section
      class="row2 room-accent"
      aria-label="Component index"
      style:--room-accent={selectedChannel.solid}
      style:--room-accent-fg={selectedChannel.on}
    >
      <div class="inv-col">
        <div class="inv-head">
          <Input
            bind:value={query}
            variant="underline"
            size="sm"
            placeholder="Filter {data.rows.length} components"
            aria-label="Filter components"
          />
        </div>
        <!-- Alle Zeilen auf einmal, die Spalte scrollt selbst; der leere
           pagination-Snippet nimmt dem Fuß das Chrom (wie im Hero). -->
        <div class="inventory">
          <Table
            items={data.rows}
            searchTerm={query}
            enableSmartFilter={false}
            variant="flush"
            size="sm"
            ariaLabel="Every component in the set"
            itemsPerPage={data.rows.length}
            onRowClick={(row) => setSelectedSlug((row as HeroRow).slug)}
            activeRowId={selected.id}
            initialSort={{ column: 'name', direction: 'asc' }}
            slotClasses={{
              headerCell: '!py-2 !text-[0.6875rem] !font-medium !uppercase !tracking-[0.14em]',
              row: '!border-b-0',
              cell: '!py-[0.3rem] !align-middle',
              table: '!min-w-0'
            }}
            columns={[
              {
                accessor: 'name',
                title: 'Component',
                sortable: true,
                searchable: true,
                width: '15rem',
                cell: nameCell
              },
              {
                accessor: 'family',
                title: 'Family',
                sortable: true,
                searchable: true,
                width: '6rem',
                cell: quietCell
              },
              {
                id: 'kb',
                accessor: (row) => (row as HeroRow).net ?? -1,
                title: 'kB',
                sortable: true,
                align: 'right',
                width: '4rem',
                cell: sizeCell
              },
              {
                accessor: 'props',
                title: 'Props',
                sortable: true,
                align: 'right',
                width: '4rem',
                cell: propsCell
              }
            ]}
          >
            {#snippet pagination()}{/snippet}
          </Table>
        </div>
        <p class="fineprint">
          kB is gzipped, net of the {formatKb(data.foundationGz)} kB foundation and the Svelte runtime
          your app bundles anyway.
        </p>
      </div>

      <section class="preview" aria-label="Component preview">
        <div class="preview-head" aria-live="polite">
          <div class="title-row">
            <h2>
              {#if specimen}
                <a href={specimen.docsHref}>
                  {selected.name}<span class="arrow" aria-hidden="true">↗</span>
                </a>
              {:else}
                {selected.name}
              {/if}
            </h2>
            <p class="meta">
              {selected.family} · {selected.pkg}{selected.net == null
                ? ''
                : ` · ${formatKb(selected.net)} kB`}
            </p>
          </div>
          <p class="desc">{selected.description}</p>
          {#if sharedNote}
            <p class="shared-note">{sharedNote}</p>
          {/if}
        </div>

        {#key selected.id}
          <div class="stage">
            {#if specimen}
              {#await specimen.load() then module}
                {@const Specimen = module.default}
                {#if specimen.interactive}
                  <Specimen size="sm" slotClasses={PLAYGROUND_SLOTS} />
                {:else}
                  <Specimen />
                {/if}
              {/await}
            {:else}
              <HeroSpecimen row={selected} />
            {/if}
          </div>
        {/key}

        {#if !specimen?.interactive}
          <code>{selected.importLine}</code>
        {/if}
      </section>
    </section>

    <!-- ── Zeile 3: handeln — drei Schritte, der dritte gehört dem Agenten.
         Die Zeile endet mit einer Tür (Install + Guide-Link), nicht mit einem
         Argument. Schritt 3 trägt das Agents-Grün — die Erzählfarbe aus
         Kachel 04 kehrt als Abschluss-Akkord zurück. ─────────────────── -->
    <section class="row3" aria-label="Getting started">
      <div class="step">
        <span class="no">01</span>
        <div>
          <h2 class="step-title">Install</h2>
          <code class="cmd">bun add @urbicon-ui/blocks</code>
          <p class="step-line">One package. Your lockfile stays yours.</p>
        </div>
      </div>
      <div class="step">
        <span class="no">02</span>
        <div>
          <h2 class="step-title">Provide</h2>
          <code class="cmd">&lt;BlocksProvider&gt;&lt;App /&gt;&lt;/BlocksProvider&gt;</code>
          <p class="step-line">Tokens, dark mode and i18n — on by default.</p>
        </div>
      </div>
      <div
        class="step step-agent"
        style:--tile-solid={CHANNELS.green.solid}
        style:--tile-deep={CHANNELS.green.deep}
      >
        <span class="no">03</span>
        <div>
          <h2 class="step-title">Hand it over</h2>
          <code class="cmd">bunx urbicon init</code>
          <p class="step-line">
            Scaffolds AGENTS.md and the design gate — your agent builds with the set, and
            <code>urbicon validate</code> keeps it clean.
          </p>
          <a class="step-link" href="/getting-started"
            >Full guide <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
    </section>
  </main>
</I18nProvider>

{#snippet nameCell(item: unknown, value: unknown)}
  {@const status = (item as HeroRow).status}
  <span class="name">{value}</span>{#if status !== 'shipped'}<span class="status">{status}</span
    >{/if}
{/snippet}

{#snippet quietCell(_item: unknown, value: unknown)}
  <span class="quiet">{value}</span>
{/snippet}

{#snippet sizeCell(item: unknown)}
  <span class="num">{formatKb((item as HeroRow).net)}</span>
{/snippet}

{#snippet propsCell(item: unknown)}
  <span class="num">{(item as HeroRow).props}</span>
{/snippet}

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
       primary-Familie aus diesen zwei Vars ab — Vollton als primary, die
       GEMESSENE on-Farbe des Registers als text-on-primary, in beiden Modi. */
    --room-accent: var(--tile-solid);
    --room-accent-fg: var(--tile-on);
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

  /* ── Zeile 2: Inventar + Vorschau — die niedrigere Hero-Fassung ─
     Feste Zeilenhöhe statt 100dvh: beide Spalten scrollen intern, die
     Seite läuft normal weiter. */
  .row2 {
    height: clamp(560px, 82vh, 860px);
    display: grid;
    grid-template-columns: clamp(26rem, 36vw, 34rem) minmax(0, 1fr);
    gap: clamp(1.5rem, 4vw, 4rem);
    padding: clamp(16px, 2vw, 32px);
    min-height: 0;
    overflow: hidden;
  }
  @media (max-width: 48rem) {
    .row2 {
      height: auto;
      grid-template-columns: 1fr;
    }
  }

  .inv-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: 0.5rem;
  }
  .inv-head {
    max-width: 18rem;
  }
  .inventory {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  @media (max-width: 48rem) {
    .inventory {
      max-height: 45vh;
    }
  }
  .inventory :global(thead th) {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--paper);
  }
  .fineprint {
    font-size: 0.72rem;
    color: light-dark(#77776f, #8a8a84);
    max-width: 46ch;
  }

  .preview {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    gap: 1rem;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .preview h2 {
    font-size: clamp(1.4rem, 2vw, 1.9rem);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .preview h2 a {
    color: inherit;
    text-decoration: none;
  }
  .preview h2 a:hover .arrow {
    translate: 0.1em -0.1em;
  }
  .arrow {
    display: inline-block;
    font-size: 0.7em;
    margin-left: 0.2em;
    transition: translate 120ms ease;
    /* Das eine sichtbare Kanal-Signal im Kopf der Detailansicht. */
    color: var(--color-primary);
  }
  .meta {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    color: light-dark(#77776f, #8a8a84);
  }
  .desc {
    font-size: 0.9rem;
    max-width: 60ch;
  }
  .shared-note {
    font-size: 0.8rem;
    color: light-dark(#77776f, #8a8a84);
    max-width: 60ch;
  }
  .stage {
    min-height: 0;
  }
  .preview code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.78rem;
    color: light-dark(#55554e, #a0a099);
  }
  .name {
    font-weight: 500;
  }
  .status {
    margin-left: 0.5em;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: light-dark(#8a6d00, #d4b106);
  }
  .quiet,
  .num {
    color: light-dark(#77776f, #8a8a84);
  }
  .num {
    font-variant-numeric: tabular-nums;
  }

  /* ── Zeile 3: Getting started — Echo der Kachel-Anatomie (Nummer oben,
     Inhalt unten), fugenlos; Haarlinien nur zwischen den Paper-Schritten. */
  .row3 {
    display: grid;
    min-height: 45vh;
    border-top: 1px solid light-dark(#e3e3df, #2a2a2a);
  }
  @media (min-width: 48rem) {
    .row3 {
      grid-template-columns: 1fr 1fr 1fr;
    }
  }
  .step {
    padding: clamp(20px, 2.5vw, 36px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1.5rem;
  }
  .step + .step {
    border-inline-start: 1px solid light-dark(#e3e3df, #2a2a2a);
  }
  .step-agent {
    background: light-dark(var(--tile-solid), var(--tile-deep));
    color: light-dark(var(--tile-deep), var(--tile-solid));
    border-inline-start: none;
  }
  .step-title {
    font-size: clamp(1.3rem, 2vw, 1.8rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.6rem;
  }
  .cmd {
    display: inline-block;
    background: #101010;
    color: #d8d8d2;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    padding: 0.55rem 0.9rem;
    margin-bottom: 0.7rem;
  }
  .step-line {
    font-size: 0.9rem;
    opacity: 0.85;
    max-width: 40ch;
  }
  .step-line code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85em;
  }
  .step-link {
    display: inline-block;
    margin-top: 0.9rem;
    font-weight: 700;
    color: inherit;
    text-decoration: none;
    border-bottom: 2px solid currentColor;
    padding-bottom: 2px;
  }
</style>
