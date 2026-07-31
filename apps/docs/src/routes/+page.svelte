<!--
  Die Landing — "3-Zeilen-Journey": erinnern → staunen → erforschen → handeln.
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare); die ersten vier Kacheln teilen das Salon-Universum
  "Bleecker & Bond" ($lib/salon-tools). Jede Kachel scopet die primary-Familie
  auf ihren Kanal (`.room-accent` aus rooms.css) — die lebenden Komponenten
  tragen die Livery ihrer Kachel. Zeile 2: das Hero-Inventar — Build-time-Daten
  aus $lib/server/landing, dieselben geteilten Playgrounds wie die Doku-Seiten,
  Familien-Kanal der Auswahl als Farb-Echo. Zeile 3: ein Befehl, ein Satz, ein
  Ergebnis — drei Vollton-Schritte (Ink → Agents-Grün → Magenta), von denen der
  dritte die im zweiten bestellte Farbe trägt und eine echte BookingCard darauf
  zeigt. Fußzeile auf Ink: die Türen nach draußen, die die Zeilen darüber
  bewusst nicht haben. Alle Farben aus dem generierten Register
  ($lib/landing/channels).
  Konzept: docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
-->
<!-- urbicon-ignore magic-dimension inline-style — deliberate landing scope: the
     solid-colour channel pairs and hand-tuned row heights ARE the design; they
     move into the token system if a second consumer appears -->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { VALIDATE_OK, VALIDATE_SCORE } from '$lib/landing/agent-output';
  import { type Channel, CHANNELS, channelForFamily, TILE_CHANNEL } from '$lib/landing/channels';
  import HeroSpecimen from '$lib/landing/HeroSpecimen.svelte';
  import { formatKb, type HeroRow, SHARED_PREVIEW_NOTES } from '$lib/landing/hero';
  import AgentReplay from '$lib/landing/AgentReplay.svelte';
  import { asset } from '$app/paths';
  import { REPO_URL } from '$lib/seo';
  import BookingCard from '$lib/salon/BookingCard.svelte';
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
    ThemeSwitcher,
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
      title: 'Blocks',
      line: `${data.counts.primitives} primitives, ${data.counts.composed} components, 0 dependencies`,
      channel: CHANNELS[TILE_CHANNEL.blocks]
    },
    {
      key: 'table',
      title: 'Table',
      line: 'Enterprise grid: sorting, grouping, selection, virtual rows, remote data, live updates',
      channel: CHANNELS[TILE_CHANNEL.table]
    },
    {
      key: 'a2ui',
      title: 'A2UI',
      line: 'AI chat creates interactive components on the fly. Tool-controlled, safe, custom-themed.',
      channel: CHANNELS[TILE_CHANNEL.a2ui],
      href: '/salon',
      linkLabel: 'Visit the salon'
    },
    {
      key: 'agent',
      title: 'Agents',
      line: 'Let agents write and maintain clean and consistent, readable code.',
      channel: CHANNELS[TILE_CHANNEL.agents]
    },
    {
      key: 'more',
      title: '…and more',
      line: 'The rest of the set, one click away',
      channel: CHANNELS[TILE_CHANNEL.more]
    }
  ]);

  // ── Die Kacheln Blocks–Agents teilen sich EIN fiktives Universum: der Salon
  //    „Bleecker & Bond" (siehe $lib/salon-tools — dieselben Services,
  //    Stylists und Slot-Zeiten wie das Livery-Exponat und die Vollseite).
  //    Entscheidung 2026-07-30: kohärente Fiktion statt strenger
  //    Selbstreferenz; die Beweiszahlen und Zeile 2 bleiben selbstreferenziell.

  // ── Blocks: das Salon-Backoffice als Dashboard-Collage ──────────
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
  // Die Auslastungs-Spalte des Dashboards (Team, Stühle, Wiederkehrer) —
  // schmal gestapelt unter dem Chart-Block, breit daneben (siehe `.dash2`).
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

  // ── Table: die Buchungsliste des Salons ─────────────────────────
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

  // ── A2UI: das Salon-Exponat (LiveryTile) — echtes aufgezeichnetes
  //    Modell-Output im Replay, vier Liveries, ein Klick zur Vollseite. ─

  // ── Treppe: die restlichen Register — jede Stufe ist eine Tür ───
  const STEPS = $derived([
    { label: `${data.counts.primitives} primitives`, href: '/blocks' },
    { label: `${data.counts.composed} components`, href: '/blocks#display' },
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
  const PROOF = 'one package · one grammar · one gate';

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
      data.rows.find((r) => r.name === 'A2UIView') ??
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

  // …aber die 3:1-Stufe trägt nur Linie und Marke. Die Playgrounds hier sind
  // dieselben wie auf den Doku-Seiten, und mehrere davon malen kleinen Text in
  // `--color-primary` — der aktive Tab-Reiter etwa stand bei 3.1:1 auf dem
  // hellen Papier. `.room-accent` (rooms.css) nimmt darum optional die
  // Text-Stufe des Registers dazu; damit bleibt die Marke frisch und die
  // Beschriftung AA. Nur im Hellmodus nötig, siehe rooms.css.
  const rowAccentText = $derived(selectedChannel.accentText);

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
    // ruhigere `surface-base` plus der Schatten-Token — die eine Stelle, an der
    // diese sonst schattenfreie Seite eine Erhebung behauptet, weil hier
    // tatsächlich etwas auf etwas steht. Der Token statt eines eigenen Werts:
    // er kennt das Dark-Mode-Paar und das reduced-motion-Opt-out.
    preview:
      '!bg-surface-base !rounded-contain !px-5 !py-6 !shadow-[var(--blocks-shadow-md)] !border-0',
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
        <div class="tile-head">
          <p class="eyebrow">UI platform for Svelte 5 + Tailwind 4</p>
          <!-- Die Kachel ist in beiden Modi Ink; der `color-scheme: dark`-Scope
               lässt die Tokens des Switchers dunkel auflösen (helles Icon auf
               dunklem Grund), wie bei der LiveryTile. Persistenz + <html>-Klasse
               teilen sich Landing und Doku-Chrome (gleicher localStorage-Key). -->
          <div style="color-scheme: dark">
            <ThemeSwitcher size="sm" />
          </div>
        </div>
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
              <div class="tile-body">
                {#if tile.key === 'blocks'}
                  <!-- EIN Dashboard, EINE Karte: die Karte ist ihr eigener
                       Container und baut sich per @container um — schmal
                       gestapelt, breit zweispaltig. Kein versteckter Inhalt
                       mehr (die alte Nebenkarte verschwand unter 78rem);
                       Mobile bekommt dasselbe Backoffice, nur gestapelt. -->
                  <div class="card dash2">
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
                    <div class="dash-body">
                      <div class="dash-main">
                        <AreaChart
                          data={bookingsData}
                          series={BOOKING_SERIES}
                          height={132}
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
                      </div>
                      <div class="dash-side">
                        <div class="dash-head">
                          <p class="dash-sub">Chairs today</p>
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
                            size={88}
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
                    <div class="dash-foot">
                      <Toggle bind:checked={walkIns} label="Accept walk-ins" size="sm" />
                      <!-- soft ist hier Geschmack, nicht mehr Notwehr: die solide
                         Intent-Fläche trug text-on-primary, das im
                         .room-accent-Scope auf den Kanal umgefärbt wurde — ein
                         success-Badge bekam also die Schriftfarbe des Raums auf
                         grünem Grund. Seit 2026-07-31 tragen die nicht-primary
                         Füllungen text-on-fill, das kein Raum überschreibt
                         (#47). filled wäre jetzt gefahrlos. -->
                      <Badge intent="success" variant="soft">3 chairs free</Badge>
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
                          // `dataType` ist ab 2026-07-31 das, was die Spalte
                          // summierbar macht — vorher reichte der Name "price",
                          // was für Spalten in anderen Sprachen nie funktioniert
                          // hat. Ohne diese Zeile bleibt der Σ-Knopf dauerhaft
                          // deaktiviert.
                          dataType: 'number',
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
      style:--room-accent-text={rowAccentText}
      style:--room-accent-text-fg="#fbfaf6"
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

    <!-- ── Zeile 3: handeln — ein Befehl, ein Satz, ein Ergebnis.
         Nicht „so richtest du eine Bibliothek ein" (das steht im Guide),
         sondern die These der Seite in drei Bildern: du sagst einen Satz, und
         danach steht die Seite. Deshalb bestellt Schritt 02 wörtlich eine
         Farbe — und Schritt 03 IST diese Farbe, mit der echten BookingCard
         darauf. Die Farbe im Text ist die Farbe der Fläche; das ist der
         Theming-Beweis ohne ein Wort über Theming.

         Dreiklang Ink → Agents-Grün → Magenta: Schritt 01 echot die
         Namens-Kachel (die Bibliothek selbst), Ask den Kanal der
         Agents-Kachel, Ship den A2UI-Kanal. Die Zeile liest damit als
         Reprise von Zeile 1 — dieselbe Kachel-Anatomie (Inhalt mittig, Titel
         zuoberst der Gruppe), aber statisch nebeneinander statt gescrollt. ── -->
    <section class="row3" aria-label="Getting started">
      <div class="step step-ink" style:--ink-solid={CHANNELS.ink.solid}>
        <div class="step-body">
          <h2 class="step-title">Install</h2>
          <code class="cmd">bun add @urbicon-ui/blocks</code>
          <code class="cmd">bunx urbicon init</code>
          <p class="step-line">
            Two commands. The second writes AGENTS.md and installs the design gate.
          </p>
        </div>
      </div>

      <div
        class="step step-channel"
        style:--step-solid={CHANNELS.green.solid}
        style:--step-deep={CHANNELS.green.deep}
        style:--cmd-fg={CHANNELS.green.solid}
      >
        <div class="step-body">
          <h2 class="step-title">Ask</h2>
          <!-- Die Farbe im Prompt ist der Kanalname aus dem Register, nicht
               ein hübscheres Wort dafür: die Fläche rechts IST hue 330. Sagt
               der Prompt „violet" und liefert die Kachel Magenta, bricht genau
               der Beweis, für den dieser Satz hier steht. -->
          <code class="cmd"
            >claude "a neon-magenta booking page for the salon — service, chair, time"</code
          >
          <p class="step-line">In your words. No component names, no token names.</p>
        </div>
      </div>

      <!-- Der Schritt trägt die bestellte Farbe UND scopet die primary-Familie
           darauf (`.room-accent`, wie die Kacheln in Zeile 1): die Karte ist
           eine echte BookingCard — dieselbe Datei, gegen die die
           validate-Zeilen aufgezeichnet sind — und ihr Reserve-Knopf ist
           magenta, weil der Prompt magenta bestellt hat. -->
      <div
        class="step step-channel step-ship room-accent"
        style:--step-solid={CHANNELS.magenta.solid}
        style:--step-deep={CHANNELS.magenta.deep}
        style:--room-accent={CHANNELS.magenta.solid}
        style:--room-accent-fg={CHANNELS.magenta.on}
        style:--gate-ok={CHANNELS.green.solid}
      >
        <!-- Der Magenta-Kanal ist das schwächste Paar im Register
             (`pairContrast` 4.2) — der Vollton trägt auf der Tiefe zwar eine
             Überschrift, aber keine 12-px-Mono-Ausgabe. Der Kasten bekommt
             deshalb Papier als Tinte statt des Kanals; die zwei anderen
             Schritte (Ink, Grün bei 9.0) behalten die Inversion. -->
        <div class="ship-card">
          <BookingCard />
        </div>
        <div class="step-body">
          <h2 class="step-title">Ship</h2>
          <!-- Kein Befehl, sondern seine Ausgabe: derselbe Mono-Kasten wie in
               01/02, damit die drei Schritte als Befehl · Befehl · Antwort
               zusammenliegen. Wortlaut zitiert (siehe agent-output). -->
          <div class="cmd gate">
            <p>{VALIDATE_SCORE}</p>
            <p class="gate-ok">{VALIDATE_OK}</p>
          </div>
          <p class="step-line">
            Built with the set — the gate ran on every file the agent touched.
          </p>
          <a class="step-link" href="/getting-started"
            >Full guide <span aria-hidden="true">↗</span></a
          >
        </div>
      </div>
    </section>

    <!-- Die Seite endet, wo sie angefangen hat: derselbe Ink-Grund wie die
         Namens-Kachel und wie Schritt 01, dieselbe Signatur. Bis hierher war
         die Landing ohne jedes Chrom — die Türen nach draußen (Register,
         Repo, Rechtliches) gehören genau hierher und nirgends höher. -->
    <footer class="foot">
      <div class="foot-brand">
        <p class="brand-sm">
          urbicon <span class="brand-suffix">ui</span><span class="ticks"
            >{#each TILES as tile (tile.key)}<span
                class="tick"
                style:background={tile.channel.solid}
              ></span>{/each}</span
          >
        </p>
        <p class="foot-meta">© 2026 Urbicon · Felix Urban · v{__APP_VERSION__}</p>
      </div>
      <nav class="foot-nav" aria-label="Footer">
        <a href="/blocks">Components</a>
        <a href="/recipes">Recipes</a>
        <a href="/getting-started">Getting started</a>
        <a href="/changelog">Changelog</a>
        <a href="/ai">AI &amp; DX</a>
        <!-- Die Seite behauptet AI-native — die maschinenlesbaren Artefakte
             gehören darum als Türen hierher, wie im Sidebar-Chrome. `asset()`
             statt Route: das sind statische Dateien, kein Client-Routing. -->
        <a href={asset('/llms.txt')}>llms.txt</a>
        <a href={asset('/llms-full.txt')}>llms-full.txt</a>
        <a href={REPO_URL} target="_blank" rel="noopener">GitHub</a>
        <a href="/imprint">Imprint</a>
        <a href="/privacy">Privacy</a>
      </nav>
    </footer>
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
  .tile-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
   * EIN Dashboard, EINE Karte: `.dash2` ist ihr eigener @container und baut
   * sich nach der EIGENEN Breite um, nicht nach dem Viewport — schmal alles
   * gestapelt (Mobile sieht das ganze Backoffice, statt wie früher die
   * Nebenkarte zu verlieren), ab ~30rem Kartenbreite rückt die
   * Auslastungs-Spalte neben den Chart-Block. Der alte Vorbehalt gegen
   * `container-type` galt der KACHEL (sie würde zum Bezugsrahmen für die
   * `position: fixed`-Overlays der Table) — auf der Karte selbst gibt es nur
   * Chart-Tooltips, absolut im eigenen Wrapper. Läuft der Stapel auf kleinen
   * Schirmen doch über die Kachel hinaus, scrollt die Karte innen
   * (card-table-Muster), statt abzuschneiden.
   */
  .dash2 {
    container-type: inline-size;
    width: min(520px, 100%);
    max-height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  /* Kinder einer SCROLLENDEN Flex-Spalte dürfen nicht schrumpfen: sonst
     quetscht flex-shrink Kopf- und Fußzeile über den Grid-Inhalt (Badge über
     der Donut-Notiz), statt dass die Karte scrollt. */
  .dash2 > * {
    flex-shrink: 0;
  }
  .dash-body {
    display: grid;
    gap: 1.1rem;
    min-height: 0;
  }
  .dash-main,
  .dash-side {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  @container (min-width: 30rem) {
    .dash-body {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 1.6rem;
      align-items: stretch;
    }
    .dash-side {
      justify-content: space-between;
    }
  }
  @media (min-width: 78rem) {
    .dash2 {
      width: min(940px, 100%);
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
  /* Der Playground fasst Bühne + Regler + Quelltext in einen Wrapper mit
     Haarlinie oben und unten. Seit die Bühne ihre Kante selbst mitbringt
     (Schatten, siehe PLAYGROUND_SLOTS), ist die obere Linie eine zweite Kante
     an derselben Stelle — und die untere zieht eine Fuge quer durch eine Zeile,
     die sonst fugenlos ist. */
  .stage :global(> section > div) {
    border-block: 0;
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

  /* ── Zeile 3: Getting started — Echo der Kachel-Anatomie, fugenlos.
     Alle drei Schritte tragen jetzt eine Fläche, es
     gibt also keine Papier-Nachbarn und keine Haarlinien mehr: die Kante IST
     der Farbwechsel, wie in Zeile 1. Höher als die alte Zeile, weil Schritt 03
     eine echte Komponente zeigt statt einer Textzeile. */
  .row3 {
    display: grid;
    min-height: clamp(460px, 62vh, 680px);
  }
  @media (min-width: 48rem) {
    .row3 {
      /* Schritt 03 trägt Karte UND Textgruppe und bekommt den Zuschlag. */
      grid-template-columns: 1fr 1fr 1.25fr;
    }
  }
  .step {
    padding: clamp(20px, 2.5vw, 36px);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  /* Die Schritte Install/Ask haben keinen Kachel-Body, den man in die Mitte
     stellen könnte — die Titelgruppe IST ihr Inhalt. Sie an die Unterkante zu
     binden (wie die Kacheln in Zeile 1 ihre Titel) reißt bei der Höhe, die der
     Ship-Schritt der Zeile vorgibt, ein halbes Kachelloch darüber auf. Also:
     Inhalt in der Mitte — dieselbe Anatomie wie die Kacheln, nur mit der
     Titelgruppe in der Rolle des Bodys. */
  .step-body {
    margin-block: auto;
  }
  /* Der Ship-Schritt füllt seinen Raum mit der Karte und braucht die
     Zentrierung nicht — sie würde die Titelgruppe von der Karte wegschieben. */
  .step-ship .step-body {
    margin-block: 0;
  }
  /* Die farbigen Schritte tragen die Kachel-Anatomie aus Zeile 1: Vollton als
     Fläche, Tiefe als Text, im Dark Mode getauscht. */
  .step-channel {
    background: light-dark(var(--step-solid), var(--step-deep));
    color: light-dark(var(--step-deep), var(--step-solid));
  }
  /* Schritt 01 ist unbunt und echot die Namens-Kachel — derselbe Grund,
     dieselbe Tinte. Der Ink-Kanal hat kein Vollton/Tiefe-Paar (pairContrast 0
     im Register), trägt die Inversion unten also nicht: sein Befehlskasten
     hebt sich über die HELLERE Ink-Stufe ab statt über die dunklere. */
  .step-ink {
    background: light-dark(#141414, #191919);
    color: #f4f4f2;
  }
  .step-title {
    font-size: clamp(1.3rem, 2vw, 1.8rem);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 0.6rem;
  }
  /* Der Befehlskasten ist das Negativ seines Schrittes — in beiden Modi. Ein
     fester Ink-Block wäre auf drei verschiedenen Vollton-Gründen dreimal
     dasselbe schwarze Rechteck, und die Farbe wäre nur noch Rahmen statt
     Träger. */
  .cmd {
    display: block;
    width: fit-content;
    max-width: 100%;
    background: light-dark(var(--step-deep), var(--step-solid));
    color: light-dark(var(--cmd-fg, var(--step-solid)), var(--step-deep));
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    padding: 0.55rem 0.9rem;
    margin-bottom: 0.5rem;
    /* Der Prompt in Schritt 02 ist ein ganzer Satz und darf umbrechen, statt
       die Spalte zu sprengen. */
    overflow-wrap: anywhere;
  }
  .step-ink .cmd {
    background: var(--ink-solid);
    color: #f4f4f2;
  }

  /* Der Ship-Schritt stapelt Karte und Titelgruppe mit fester Fuge statt
     `space-between`, und die Karte nimmt den Rest. */
  .step-ship {
    justify-content: flex-start;
    gap: 1.1rem;
  }
  .ship-card {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  /*
   * Keine Eingabe, sondern Ausgabe — und damit derselbe Kasten wie das Terminal
   * der Agents-Kachel: in beiden Modi dunkel, mit denselben Werten wie dort
   * (AgentReplay `.term`). Das ist nicht nur Wiedererkennung, es löst auch den
   * Kontrast: der Magenta-Kanal ist mit `pairContrast` 4.2 das schwächste Paar
   * im Register und trägt bei 12 px Mono in KEINER Richtung — im Light Mode
   * nicht Vollton auf Tiefe, im Dark Mode nicht Tiefe auf Vollton. Die
   * Inversion bleibt den Befehlen (01/02) vorbehalten, die ihre Kanäle tragen.
   */
  .gate {
    font-size: 0.76rem;
    background: #101010;
    color: #d8d8d2;
    margin-bottom: 0.7rem;
  }
  .gate-ok {
    /* Das Grün des Agenten quittiert in der Kachel, die er gebaut hat. */
    color: var(--gate-ok);
  }
  .step-line {
    font-size: 0.9rem;
    opacity: 0.85;
    max-width: 40ch;
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

  /* ── Fußzeile: derselbe Ink-Grund wie Namens-Kachel und Schritt 01, damit
     die Seite dort endet, wo sie angefangen hat. Bewusst niedrig — sie ist
     eine Türleiste, kein sechster Inhalt. */
  .foot {
    background: light-dark(#141414, #191919);
    color: #f4f4f2;
    padding: clamp(20px, 2.5vw, 36px);
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem 2rem;
  }
  .brand-sm {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .foot-meta {
    margin-top: 0.35rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.72rem;
    opacity: 0.55;
  }
  .foot-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    font-size: 0.85rem;
  }
  .foot-nav a {
    color: inherit;
    text-decoration: none;
    opacity: 0.75;
  }
  .foot-nav a:hover,
  .foot-nav a:focus-visible {
    opacity: 1;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
</style>
