<!--
  Die Landing — "3-Zeilen-Journey": erinnern → staunen → erforschen → handeln.
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare); die Kacheln 01–04 teilen das Salon-Universum
  "Bleecker & Bond" ($lib/salon-tools). Jede Kachel scopet die primary-Familie
  auf ihren Kanal (`.room-accent` aus rooms.css) — die lebenden Komponenten
  tragen die Livery ihrer Kachel. Zeile 2: das Hero-Inventar — Build-time-Daten
  aus $lib/server/landing, dieselben geteilten Playgrounds wie die Doku-Seiten,
  Familien-Kanal der Auswahl als Farb-Echo. Zeile 3: Getting started in drei
  fugenlosen Schritten, Schritt 3 (Agents-Grün) übergibt an den Agenten.
  Alle Farben aus dem generierten Register ($lib/landing/channels).
  Konzept: docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
-->
<!-- urbicon-ignore magic-dimension inline-style — deliberate landing scope: the
     solid-colour channel pairs and hand-tuned row heights ARE the design; they
     move into the token system if a second consumer appears -->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { type Channel, CHANNELS, channelForFamily, TILE_CHANNEL } from '$lib/landing/channels';
  import HeroSpecimen from '$lib/landing/HeroSpecimen.svelte';
  import { formatKb, type HeroRow, SHARED_PREVIEW_NOTES } from '$lib/landing/hero';
  import AgentReplay from '$lib/landing/AgentReplay.svelte';
  import LiveryTile from '$lib/salon/LiveryTile.svelte';
  import {
    AreaChart,
    type AvatarProps,
    AvatarGroup,
    Badge,
    type CartesianDatum,
    type ChartSeries,
    CompositionBar,
    type CompositionItem,
    DonutChart,
    Input,
    Progress,
    Scroller,
    SegmentGroup,
    SegmentItem,
    Separator,
    Toggle
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
  // Die Zahlen in den Zeilen kommen build-time aus den Katalogen (loader).
  interface TileDef {
    key: string;
    no: string;
    title: string;
    line: string;
    channel: Channel;
    /** Optionale Tür aus der Kachel heraus (z. B. das volle Salon-Exponat). */
    href?: string;
    linkLabel?: string;
  }
  const TILES: TileDef[] = $derived([
    {
      key: 'blocks',
      no: '01',
      title: 'Blocks',
      line: `${data.counts.primitives} primitives, ${data.counts.composed} components`,
      channel: CHANNELS[TILE_CHANNEL.blocks]
    },
    {
      key: 'table',
      no: '02',
      title: 'Table',
      line: 'Feature-rich enterprise grid',
      channel: CHANNELS[TILE_CHANNEL.table]
    },
    {
      key: 'a2ui',
      no: '03',
      title: 'A2UI',
      line: 'AI chat creates new components on the fly. Tool-controlled, safe, custom-themed.',
      channel: CHANNELS[TILE_CHANNEL.a2ui],
      href: '/salon',
      linkLabel: 'Visit the salon'
    },
    {
      key: 'agent',
      no: '04',
      title: 'Agents',
      line: 'AI harnessing itself',
      channel: CHANNELS[TILE_CHANNEL.agents]
    },
    {
      key: 'more',
      no: '05',
      title: '…and more',
      line: 'The rest of the set, one row down',
      channel: CHANNELS[TILE_CHANNEL.more]
    }
  ]);

  // ── Die Kacheln 01–04 teilen sich EIN fiktives Universum: der Salon
  //    „Bleecker & Bond" (siehe $lib/salon-tools — dieselben Services,
  //    Stylists und Slot-Zeiten wie das Livery-Exponat und die Vollseite).
  //    Entscheidung 2026-07-30: kohärente Fiktion statt strenger
  //    Selbstreferenz; die Beweiszahlen und Zeile 2 bleiben selbstreferenziell.

  // ── 01 Blocks: das Salon-Backoffice als Dashboard-Collage ──────────
  let range = $state('week');
  let walkIns = $state(true);
  const WEEK_BOOKINGS: CartesianDatum[] = [
    { label: 'Tue', values: [9, 3] },
    { label: 'Wed', values: [11, 4] },
    { label: 'Thu', values: [8, 6] },
    { label: 'Fri', values: [13, 5] },
    { label: 'Sat', values: [15, 2] }
  ];
  const MONTH_BOOKINGS: CartesianDatum[] = [
    { label: 'W1', values: [42, 15] },
    { label: 'W2', values: [48, 18] },
    { label: 'W3', values: [39, 21] },
    { label: 'W4', values: [55, 17] }
  ];
  const BOOKING_SERIES: ChartSeries[] = [{ label: 'Booked' }, { label: 'Walk-in' }];
  const bookingsData = $derived(range === 'week' ? WEEK_BOOKINGS : MONTH_BOOKINGS);
  const REVENUE_MIX: CompositionItem[] = [
    { label: 'Bleecker Cut', value: 52, intent: 'primary' },
    { label: 'Dry Cut', value: 24, intent: 'success' },
    { label: 'Beard', value: 17, intent: 'warning' },
    { label: 'Colour', value: 7, intent: 'neutral' }
  ];
  // Die zweite Dashboard-Karte — sie erscheint erst, wenn die Kachel breit
  // genug ist (siehe `.dash-aside`), statt das schmale Layout zu belasten.
  const TEAM: AvatarProps[] = [
    { name: 'Io Nakamura', status: 'online' },
    { name: 'Sable Adeyemi', status: 'online' },
    { name: 'Ren Duval', status: 'busy' },
    { name: 'Mara Kovač' },
    { name: 'Tomás Vidal' }
  ];
  const CHAIRS = [
    { name: 'Io', load: 82 },
    { name: 'Sable', load: 64 },
    { name: 'Ren', load: 41 }
  ];
  // Gästezahlen, keine Prozente: der Donut summiert seine Werte zur Mitte, und
  // eine Mitte, die „100 %" sagt, weil die Anteile sich zu 100 addieren, wäre
  // eine Zahl ohne Aussage.
  const RETURN_MIX = [
    { label: 'Returning', value: 68 },
    { label: 'First visit', value: 32 }
  ];

  // ── 02 Table: die Buchungsliste des Salons ─────────────────────────
  // Zeiten aus dem SLOT_GRID, Services/Stylists/Preise aus salon-tools.
  interface Booking {
    id: string;
    day: 'Today' | 'Tomorrow';
    time: string;
    client: string;
    service: string;
    stylist: string;
    status: 'confirmed' | 'pending' | 'walk-in';
    /** Zahl, nicht "$95": Suche, Sortierung UND Summe rechnen auf dem
        Accessor-Wert. Das Währungszeichen ist Anzeige — `formatter`. */
    price: number;
  }
  const BOOKINGS: Booking[] = [
    {
      id: 'b1',
      day: 'Today',
      time: '09:45',
      client: 'M. Okafor',
      service: 'The Bleecker Cut',
      stylist: 'Io',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b2',
      day: 'Today',
      time: '10:30',
      client: 'J. Laurent',
      service: 'Beard Architecture',
      stylist: 'Sable',
      status: 'confirmed',
      price: 55
    },
    {
      id: 'b3',
      day: 'Today',
      time: '13:00',
      client: 'A. Reyes',
      service: 'Dry Cut & Finish',
      stylist: 'Ren',
      status: 'walk-in',
      price: 70
    },
    {
      id: 'b4',
      day: 'Today',
      time: '15:15',
      client: 'T. Nguyen',
      service: 'Colour Consultation',
      stylist: 'Io',
      status: 'pending',
      price: 0
    },
    {
      id: 'b5',
      day: 'Tomorrow',
      time: '09:00',
      client: 'S. Adeyemi',
      service: 'The Bleecker Cut',
      stylist: 'Sable',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b6',
      day: 'Tomorrow',
      time: '11:15',
      client: 'R. Duval',
      service: 'Beard Architecture',
      stylist: 'Ren',
      status: 'pending',
      price: 55
    },
    {
      id: 'b7',
      day: 'Tomorrow',
      time: '13:45',
      client: 'K. Marsh',
      service: 'Dry Cut & Finish',
      stylist: 'Io',
      status: 'confirmed',
      price: 70
    },
    {
      id: 'b8',
      day: 'Tomorrow',
      time: '16:00',
      client: 'E. Sato',
      service: 'The Bleecker Cut',
      stylist: 'Ren',
      status: 'confirmed',
      price: 95
    }
  ];

  // ── 03 A2UI: das Salon-Exponat (LiveryTile) — echtes aufgezeichnetes
  //    Modell-Output im Replay, vier Liveries, ein Klick zur Vollseite. ─

  // ── 05 Treppe: die restlichen Register — jede Stufe ist eine Tür ───
  const STEPS = $derived([
    { label: `${data.counts.primitives} primitives`, href: '/blocks' },
    { label: `${data.counts.composed} composites`, href: '/blocks#display' },
    { label: `${data.counts.icons} icons`, href: '/icons' },
    { label: 'calendar', href: '/blocks/components/calendar' },
    { label: 'guide', href: '/blocks/components/guide' },
    { label: 'sankey', href: '/blocks/components/sankey' },
    { label: 'charts', href: '/blocks/components/area-chart' },
    { label: 'toast', href: '/blocks/primitives/toast' },
    { label: 'chat', href: '/blocks/components/chat' },
    { label: 'auth', href: '/auth' },
    { label: 'i18n', href: '/i18n' },
    { label: 'recipes', href: '/recipes' },
    { label: 'theming', href: '/customization' }
  ]);

  // Die Fußzeile der Namens-Kachel: drei Konstruktionseigenschaften, keine
  // Messungen — die Zahlen stehen in Zeile 2, wo sie aus den Katalogen kommen.
  const PROOF = 'self-contained · self-organizing · controlled consistency';

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

  // Zeile 2 hat keine Vollton-FLÄCHE, auf der die Kanalfarbe stünde — hier ist
  // sie Linie, Marke und Beschriftung auf Papier. Dafür gibt es die
  // Akzent-Stufe des Registers: die hellste, die gegen Papier noch 3:1 schafft
  // (gemessen im Generator, dort auch die Wache). Der Cusp lag bei 1.2:1, eine
  // feste tiefe Stufe ließ die zehn Hues ineinanderlaufen.
  //
  // Eine Farbe für beide Modi, kein `light-dark()`: die Akzent-Stufe misst
  // 5.8:1 gegen den Nachtgrund und trägt dort genauso.
  const rowAccent = $derived(selectedChannel.accent);
  const rowAccentFg = $derived(selectedChannel.accentOn);

  // Slot-Eingriffe des Hero, unverändert: äußere Rahmung des Configurators
  // abräumen, linke Kante angleichen, eigener Grund unter der Bühne.
  const PLAYGROUND_SLOTS = {
    root: '!border-0 !bg-transparent !p-0 !shadow-none !gap-0',
    // `rounded-contain` statt `rounded-t-xl`: eine Bühne, die nur oben rund ist,
    // liest als abgeschnittene Karte — zumal direkt darüber die Haarlinie des
    // Playgrounds sitzt. Dieselbe Radius-Stufe wie jede andere Fläche im Set.
    //
    // Der Bühnen-Effekt kommt aus der Höhe, nicht aus dem Ton: `surface-elevated`
    // lag zehn Punkte über dem Papier, was als Fläche kaum ankam. Jetzt der
    // ruhigere `surface-base` plus ein Schatten — die eine Stelle, an der diese
    // sonst schattenfreie Seite eine Erhebung behauptet, weil hier tatsächlich
    // etwas auf etwas steht. `.stage` trägt ihn (siehe unten), damit das
    // Motion-Opt-out der Tokens greift.
    preview: '!bg-surface-base !rounded-contain !px-5 !py-6',
    previewContent: '!justify-start',
    controlsPanel: '!bg-transparent !px-5 !pb-5 !pt-0',
    controlsHeader: '!mx-0 !px-0',
    controlsGrid: '!mx-0 !px-0',
    codePanel: '!bg-transparent !px-0',
    codeToolbar: '!px-0'
  };
</script>

<SeoMeta />

<!-- Englisch gepinnt wie im Hero: sonst rutschen Playground-Labels und
     Calendar-Monatsnamen in die Browser-Sprache, mitten in eine englische Seite. -->
<I18nProvider locale="en">
  <main class="proto" lang="en">
    <!-- ── Zeile 1: erinnern + staunen ─────────────────────────────── -->
    <section class="row1" aria-label="Hero">
      <div class="name-tile">
        <p class="eyebrow">UI platform for Svelte 5 + Tailwind 4</p>
        <div class="name-mid">
          <p class="brand">
            urbicon <span class="brand-suffix">ui</span><span class="ticks"
              >{#each TILES as tile (tile.key)}<span
                  class="tick"
                  style:background={tile.channel.solid}
                ></span>{/each}</span
            >
          </p>
          <!-- Der Anspruch trägt die Kachel: „nothing" ist das Wort, das die
               Aussage macht, also steht der Rest zurück (Helligkeit, nicht Farbe
               — die Striche bleiben die einzige Buntheit auf dieser Fläche). -->
          <p class="claim">Depends on <strong>nothing</strong>.</p>
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
          snap="mandatory"
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
                  <div class="dash-grid">
                    <div class="card dash">
                      <div class="dash-head">
                        <div>
                          <p class="dash-title">Bleecker &amp; Bond</p>
                          <p class="dash-sub">Front desk</p>
                        </div>
                        <SegmentGroup bind:value={range} size="sm" ariaLabel="Range">
                          <SegmentItem value="week">Week</SegmentItem>
                          <SegmentItem value="month">Month</SegmentItem>
                        </SegmentGroup>
                      </div>
                      <AreaChart
                        data={bookingsData}
                        series={BOOKING_SERIES}
                        height={150}
                        showLegend={false}
                        fillOpacity={0.25}
                      />
                      <!-- Die Werte SIND Prozente: formatValue macht sie zur
                         Anzeige, showPercentages bliebe sonst als Doppelung
                         daneben stehen (Legende druckt Wert immer). -->
                      <CompositionBar
                        items={REVENUE_MIX}
                        size="sm"
                        showLegend
                        showPercentages={false}
                        formatValue={(v) => `${v} %`}
                        legendPlacement="bottom"
                      />
                      <div class="dash-foot">
                        <Toggle bind:checked={walkIns} label="Accept walk-ins" size="sm" />
                        <!-- soft, nicht filled: die solide Intent-Fläche trägt text-on-primary,
                           das im .room-accent-Scope auf den Kanal umgefärbt ist
                           (docs/technical-debt.md → „Design tokens"). -->
                        <Badge intent="success" variant="soft">3 chairs free</Badge>
                      </div>
                    </div>

                    <!-- Zweite Spalte, nur auf breiten Schirmen: die Kachel ist
                         dort dreimal so breit wie ihr Inhalt. Komplementär zur
                         Table-Kachel (Auslastung statt Terminliste). -->
                    <div class="card dash-aside">
                      <div class="dash-head">
                        <div>
                          <p class="dash-title">Chairs today</p>
                          <p class="dash-sub">Five stylists on rota</p>
                        </div>
                        <AvatarGroup items={TEAM} max={4} size="sm" />
                      </div>
                      <div class="chairs">
                        {#each CHAIRS as chair (chair.name)}
                          <Progress
                            value={chair.load}
                            label={chair.name}
                            showValue
                            formatValue={(v) => `${v} %`}
                          />
                        {/each}
                      </div>
                      <Separator />
                      <div class="dash-foot">
                        <DonutChart
                          data={RETURN_MIX}
                          size={104}
                          showLegend={false}
                          showTotal
                          totalLabel="guests"
                          ariaLabel="Returning guests this week"
                        />
                        <p class="aside-note">
                          <strong>68</strong> of them had been in before.
                        </p>
                      </div>
                    </div>
                  </div>
                {:else if tile.key === 'table'}
                  <div class="card card-table">
                    <Table
                      items={BOOKINGS}
                      columns={[
                        { accessor: 'time', title: 'Time', sortable: true, width: '4.5rem' },
                        { accessor: 'client', title: 'Client', sortable: true, searchable: true },
                        { accessor: 'service', title: 'Service', searchable: true },
                        { accessor: 'stylist', title: 'Chair', searchable: true, width: '4.5rem' },
                        { accessor: 'status', title: 'Status', cell: statusCell },
                        {
                          accessor: 'price',
                          title: 'Price',
                          align: 'right',
                          width: '4rem',
                          // Trägt die Währung — für die Zelle UND für die
                          // Summenzeile (useSummary greift auf denselben
                          // Formatter zurück).
                          formatter: (value) => `$${value}`
                        }
                      ]}
                      initialGroupBy="day"
                      variant="flush"
                      size="sm"
                      ariaLabel="Bookings at Bleecker & Bond"
                      slotClasses={{ table: '!min-w-0' }}
                    />
                  </div>
                {:else if tile.key === 'a2ui'}
                  <div class="salon-host">
                    <LiveryTile />
                  </div>
                {:else if tile.key === 'agent'}
                  <!-- Terminal-Replay + materialisierende BookingCard; die
                     validate-Zeilen sind echte, aufgezeichnete Ausgabe
                     (siehe AgentReplay.svelte). -->
                  <AgentReplay />
                {:else}
                  <ol class="steps">
                    {#each STEPS as step, i (step.label)}
                      <li style:margin-inline-start={`${i * 0.75}em`}>
                        <a href={step.href}>{step.label}</a>
                      </li>
                    {/each}
                  </ol>
                {/if}
              </div>
              <div class="tile-foot">
                <div>
                  <h2 class="tile-title">{tile.title}</h2>
                  <p class="tile-line">{tile.line}</p>
                </div>
                {#if tile.href}
                  <a class="tile-link" href={tile.href}
                    >{tile.linkLabel} <span aria-hidden="true">↗</span></a
                  >
                {/if}
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
      style:--room-accent={rowAccent}
      style:--room-accent-fg={rowAccentFg}
    >
      <div class="inv-col">
        <div class="inv-head">
          <Input
            bind:value={query}
            variant="underline"
            size="sm"
            clearable
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

{#snippet statusCell(item: unknown)}
  {@const s = (item as Booking).status}
  <Badge
    size="sm"
    variant="soft"
    intent={s === 'confirmed' ? 'success' : s === 'pending' ? 'warning' : 'neutral'}>{s}</Badge
  >
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
      /* Die Namens-Kachel atmet bis ~40rem und ist dann satt — den Zuwachs
         großer Schirme bekommt der Scroller (mehr sichtbare Kacheln). */
      grid-template-columns: clamp(24rem, 32vw, 40rem) minmax(0, 1fr);
    }
  }

  .name-tile {
    background: light-dark(#141414, #191919);
    color: #f4f4f2;
    padding: clamp(20px, 2.5vw, 36px);
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    opacity: 0.6;
  }
  /* Name + Anspruch sitzen mittig zwischen Eyebrow und Fußzeile — die Kachel
     ist eine Titelseite, keine Kopfzeile mit Anhang. */
  .name-mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  /* Die Kachel ist 32vw breit, Name plus Signatur brauchen ~9em — mehr als
     ~2.9vw Schriftgrad passt nicht in eine Zeile, und ein Umbruch würde die
     fünf Striche vom Namen abreißen. Der große Text dieser Kachel ist ohnehin
     der Anspruch, nicht die Marke. */
  .brand {
    font-size: clamp(2rem, 2.9vw, 3.5rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  /* Die Signatur bleibt in jedem Fall zusammen. */
  .ticks {
    white-space: nowrap;
  }
  /* Die Marke ist „urbicon"; „ui" ist die Gattung und tritt zurück. */
  .brand-suffix {
    opacity: 0.5;
  }
  .tick {
    display: inline-block;
    width: 0.42em;
    height: 0.09em;
    margin-left: 0.06em;
    /* Ein leerer inline-block sitzt mit seiner Unterkante auf der Baseline —
       genau die Bündigkeit, die die Striche zur Grundlinie des Namens bringt. */
    vertical-align: baseline;
  }
  .claim {
    margin-top: 1.1rem;
    font-size: clamp(1.9rem, 3.4vw, 3.1rem);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.025em;
    max-width: 14ch;
    text-wrap: balance;
    color: #8f8f88;
  }
  .claim strong {
    font-weight: inherit;
    color: #f4f4f2;
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
    /* Zeile 1 dominiert den ersten Screen; Zeile 2 bleibt nur angeschnitten —
       der Anschnitt ist die Scroll-Affordance („anderthalb Zeilen"). */
    height: clamp(420px, 72vh, 800px);
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
    /* Eine Karte ist eine architektonische Fläche — dieselbe Radius-Stufe, die
       Card/Dialog/Drawer im Set tragen (docs/ARCHITECTURE.md → „contain"). Die
       fugenlose Kante gilt den Zeilen, nicht dem, was auf ihnen steht. */
    border-radius: var(--radius-contain);
  }
  /*
   * Die Kacheln sind auf großen Schirmen weit breiter als ihr Inhalt: bei
   * 1920px Viewport misst eine Kachel ~1110px, das Dashboard 520px. Ab
   * ~78rem Viewport ist die Kachel sicher über 700px breit (die Kachel ist
   * 85% von `Viewport − clamp(24rem, 32vw, 40rem)`; unterhalb des
   * `row1`-Umbruchs bei 48rem springt der Wert, darüber wächst er monoton),
   * also darf der Inhalt dort zweispaltig werden. Media-Query statt
   * `@container`: `container-type` zieht `contain: layout` nach sich und
   * würde die Kachel zum Bezugsrahmen für die `position: fixed`-Overlays der
   * Table machen.
   */
  .dash-grid {
    display: grid;
    gap: clamp(1rem, 1.5vw, 1.6rem);
    width: min(520px, 100%);
  }
  /* Das Backoffice-Dashboard der Blocks-Kachel. */
  .dash,
  .dash-aside {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .dash-aside {
    justify-content: space-between;
    /* Schmale Kachel: die Nebenkarte bleibt weg, statt das Dashboard in eine
       Scroll-Säule zu verwandeln. */
    display: none;
  }
  @media (min-width: 78rem) {
    .dash-grid {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      width: min(940px, 100%);
    }
    .dash-aside {
      display: flex;
    }
  }
  .chairs {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .aside-note {
    font-size: 0.8rem;
    line-height: 1.45;
    color: light-dark(#55554e, #a0a099);
    max-width: 18ch;
  }
  .aside-note strong {
    font-weight: 700;
    color: inherit;
  }
  .dash-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .dash-title {
    font-weight: 800;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }
  .dash-sub {
    font-size: 0.75rem;
    color: light-dark(#77776f, #8a8a84);
  }
  .dash-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .card-table {
    width: min(680px, 100%);
    padding: 0.5rem;
    max-height: 100%;
    /* Wird es eng, scrollt der Body hinter dem stehenden Kopf — nie abschneiden. */
    overflow-y: auto;
    scrollbar-width: thin;
  }
  /* Dieselbe Schwelle wie beim Dashboard: ab hier hat die Kachel Platz, den der
     Inhalt bisher an die Vollton-Fläche verschenkt hat. */
  @media (min-width: 78rem) {
    .card-table {
      width: min(1000px, 100%);
    }
    .salon-host {
      width: min(620px, 100%);
    }
  }
  .card-table :global(thead th) {
    position: sticky;
    top: 0;
    z-index: 1;
    background: light-dark(#ffffff, #141414);
  }
  /* Das Salon-Exponat füllt die Kachel-Bühne; die LiveryTile bringt ihren
     eigenen Grund (data-livery) und Rahmen mit. */
  .salon-host {
    width: min(480px, 100%);
    height: 100%;
    min-height: 0;
  }

  .tile-foot {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }
  .tile-link {
    flex-shrink: 0;
    font-weight: 700;
    font-size: 0.85rem;
    color: inherit;
    text-decoration: none;
    border-bottom: 2px solid currentColor;
    padding-bottom: 2px;
  }

  /* Typo-Treppe der restlichen Register — jede Stufe verlinkt ihr Register. */
  .steps {
    list-style: none;
    font-weight: 800;
    font-size: clamp(1rem, 1.5vw, 1.35rem);
    letter-spacing: -0.01em;
    line-height: 1.55;
  }
  /* Die Treppe darf den Platz nehmen, den die Kachel hier hat. */
  @media (min-width: 78rem) {
    .steps {
      font-size: clamp(1.2rem, 1.7vw, 1.7rem);
    }
  }
  .steps a {
    color: inherit;
    text-decoration: none;
  }
  .steps a:hover,
  .steps a:focus-visible {
    text-decoration: underline;
    text-decoration-thickness: 0.09em;
    text-underline-offset: 0.18em;
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
  /* Die Erhebung der Bühne — auf dem Kind, weil der Playground die Fläche
     selbst rendert (PLAYGROUND_SLOTS.preview) und ein Schatten am Wrapper an
     der falschen Kante säße. Zwei Lagen: eine harte Haarlinie für die Kante,
     eine weiche für die Höhe. */
  .stage :global(> * > *:first-child) {
    box-shadow:
      0 1px 2px light-dark(rgb(23 21 15 / 0.07), rgb(0 0 0 / 0.4)),
      0 4px 14px light-dark(rgb(23 21 15 / 0.05), rgb(0 0 0 / 0.3));
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
