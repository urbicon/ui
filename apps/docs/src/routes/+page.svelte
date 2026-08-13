<!--
  Die Landing — "3-Zeilen-Journey": erinnern → staunen → erforschen → handeln.
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare); die ersten vier Kacheln teilen das Hotel-Universum
  "Fermata" ($lib/hotel-tools) — drei Häuser als Sub-Brands (Cala/Menorca,
  Firn/Engadin, Duna/Comporta), damit Dashboard und Grid
  Betriebs-Maßstab zeigen und die Liveries ihre natürlichste Begründung haben.
  Jede Kachel scopet die primary-Familie
  auf ihren Kanal (`.room-accent` aus rooms.css) — die lebenden Komponenten
  tragen die Livery ihrer Kachel. Zeile 2: das Hero-Inventar — Build-time-Daten
  aus $lib/server/landing, dieselben geteilten Playgrounds wie die Doku-Seiten,
  Familien-Kanal der Auswahl als Farb-Echo. Zeile 3: ein Befehl, ein Satz, ein
  Ergebnis — drei Vollton-Schritte (Ink → Agents-Grün → Magenta), von denen der
  dritte die im zweiten bestellte Farbe trägt und eine echte BookingCard darauf
  zeigt. Über allem eine schmale Ink-Kopfleiste (LandingHeader): die vier
  meistgebrauchten Türen plus Suche, sticky — die Seitenmitte war sonst türlos.
  Fußzeile auf Ink: die vollständige Liste der Türen nach draußen. Alle Farben
  aus dem generierten Register ($lib/landing/channels).
  Konzept: docs/internal/LANDING-CONCEPT-2026-07.md → "Struktur v2".
-->
<!-- urbicon-ignore important-modifier — the `!` modifiers are all slot overrides
     (PLAYGROUND_SLOTS, the Scroller control map, the inventory table, the copy
     button in step 01): a slotClasses string and the component's own tv()
     defaults land on the same element, so without `!` the winner depends on
     stylesheet order rather than on intent. Recounted 2026-08-04 with the
     engine's own regex: 39 matches, 37 of them real and every one inside a
     slotClasses map, none loose in a class attribute. The other two are the
     string `!h-full` quoted in prose — once in this very note, once in a CSS
     comment further down; matches, not modifiers. (The count is by regex
     match, not by modifier: its lookbehind wants a quote or space before the
     `!`, so a variant-prefixed one like `hover:!bg-current/15` never enters
     the tally. An earlier version of this note said "35 of 35", which no
     counting method produces, and then "37, 36 real", which missed the second
     quotation.)

     `magic-dimension` and `inline-style` were suppressed here too until the
     Blocks tile was rebuilt as a three-view backoffice; that rewrite removed the
     last of both, and the engine reports a pragma that matches nothing — a stale
     exemption is a claim about the file that is no longer true. -->
<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { VALIDATE_OK, VALIDATE_SCORE } from '$lib/landing/agent-output';
  import { type Channel, CHANNELS, channelForFamily, TILE_CHANNEL } from '$lib/landing/channels';
  import HeroSpecimen from '$lib/landing/HeroSpecimen.svelte';
  import { formatKb, type HeroRow, SHARED_PREVIEW_NOTES } from '$lib/landing/hero';
  import {
    buildOccupancy,
    freeRoomsOn,
    type OccupancyHouse,
    ROOM_CATEGORIES
  } from '$lib/landing/occupancy';
  import { HOUSES as GROUP_HOUSES, GROUP_NAME, ROOM_TYPES } from '$lib/hotel-tools';
  import AgentReplay from '$lib/landing/AgentReplay.svelte';
  import LandingHeader from '$lib/landing/LandingHeader.svelte';
  import { BRAND, BRAND_SUFFIX, CLAIM_LEAD, CLAIM_POINT, PROOF } from '$lib/landing/wordmark';
  import { asset } from '$app/paths';
  import { REPO_URL } from '$lib/seo';
  import BookingCard from '$lib/hotel/BookingCard.svelte';
  import LiveryTile from '$lib/hotel/LiveryTile.svelte';
  import {
    AreaChart,
    type AvatarProps,
    AvatarGroup,
    Badge,
    type CartesianDatum,
    type ChartSeries,
    CompositionBar,
    type CompositionItem,
    CopyButton,
    DonutChart,
    Input,
    Progress,
    ResourceTimeline,
    Sankey,
    Scroller,
    SegmentGroup,
    SegmentItem,
    Toggle
  } from '@urbicon-ui/blocks';
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { MediaQuery } from 'svelte/reactivity';
  import { useUrlParam } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { createTableView, Table } from '@urbicon-ui/table';
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
    /** Optionale Tür aus der Kachel heraus (z. B. das volle Hotel-Exponat). */
    href?: string;
    linkLabel?: string;
  }

  /* Die zwei Befehle aus Schritt 01 — einmal notiert, weil sie zweimal
     gebraucht werden: als sichtbarer Text und als Wert im Kopier-Knopf. Zwei
     Literale wären zwei Wahrheiten, und die falsche landet still in der
     Zwischenablage. Der Bestandsfall in `.step-alt` steht bewusst NICHT hier:
     er ist eine Abzweigung, kein Schritt (siehe Kommentar dort). */
  const INSTALL_COMMANDS = ['bunx sv create my-app --add @urbicon-ui', 'bunx urbicon init --hook'];

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
      href: '/hotel',
      linkLabel: 'Visit the demo hotel'
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

  // ── Die Striche hinter dem Namen sind der Kompass des Scrollers ────
  // Sie trugen bisher nur die fünf Kanalfarben und waren damit das einzige
  // Stück Buntheit auf einer sonst stummen Kachel. Jetzt zeigen sie, wo man
  // im Kachelband steht, und bringen einen hin: die Signatur der Marke IST
  // das Inhaltsverzeichnis der Zeile daneben. Die Punkte unter der Karte
  // bleiben — zwei Orte für dieselbe Navigation, wie Inhaltsverzeichnis und
  // Blätterpfeile.
  let activeTile = $state(0);
  let tileEls = $state<HTMLElement[]>([]);
  const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
  function goToTile(i: number) {
    tileEls[i]?.scrollIntoView({
      behavior: reducedMotion.current ? 'auto' : 'smooth',
      // `inline` bewegt das waagerechte Kachelband, `block: 'nearest'` hält die
      // Seite darunter still — ohne das springt die ganze Landing mit.
      inline: 'start',
      block: 'nearest'
    });
  }

  // ── Die Kacheln Blocks–Agents teilen sich EIN fiktives Universum: die
  //    Hotelgruppe „Fermata" — drei Häuser: Cala (Menorca), Firn (Engadin),
  //    Duna (Comporta). Anders als in der Salon-Ära gibt es
  //    keinen Maßstabs-Schnitt mehr: `get_hotel_info` kennt die GANZE Gruppe
  //    (Häuser, Zimmertypen, Bestand), und Namen, Orte und Teams kommen hier
  //    aus demselben Register wie auf der /hotel-Vollseite und in der
  //    Aufnahme ($lib/hotel-tools). Nur die Betriebszahlen des Backoffice
  //    (Belegung, Gäste, Umsatzmix) sind Landing-Fiktion — das Tool spricht
  //    über Verfügbarkeit, nicht über Umsatz.

  // ── Blocks: das Gruppen-Backoffice in DREI Ansichten ───────────────
  //
  // Bis 2026-08-03 schaltete die SegmentGroup hier Week/Month — eine Kontrolle,
  // die nur die x-Achse eines Charts austauschte, während der Toggle daneben
  // überhaupt nichts tat. Beides auf einer Kachel, deren Aufgabe „Umfang" ist
  // und die dafür fünf Datenanzeigen zeigte. Jetzt schaltet sie die ANSICHT:
  // Dashboard · Planner · Sankey — drei verschiedene Schwergewichte aus einem
  // Set, ein Klick auseinander. Die Schwergewichte kamen auf der ganzen Landing
  // sonst nur als Wörter in der Typo-Treppe vor.
  //
  // Die Zahlen der Ansichten sind EINE Wahrheit: der Donut (344 guests) ist
  // die Gesamtsumme des Sankey-Flusses (die Haus-Kanten summieren exakt auf
  // die guests-Werte je Haus), und der Umsatzmix (33/25/22/20 %) ist dessen
  // letzte Ebene, auf ganze Prozent gerundet. Wer nachrechnet, findet keinen
  // Widerspruch — das ist der Sinn EINES Universums.
  type DashView = 'overview' | 'rooms' | 'flow';
  let dashView = $state<DashView>('overview');
  let sameDay = $state(true);
  /** Gewähltes Haus (Klick auf eine Auslastungszeile) — `null` = die Gruppe. */
  let house = $state<string | null>(null);
  /** Röntgenbild: zeigt, aus welchen Bauteilen die Fläche besteht. */
  let xray = $state(false);

  interface House {
    /** Der Registerschlüssel aus `$lib/hotel-tools` — NICHT aus dem Namen
     *  abgeleitet: jeder Seed der Belegung und jede Spur-Id beginnt damit, und
     *  ein aus dem Anzeigenamen gebauter Schlüssel stimmte nur so lange mit dem
     *  des Tests überein, wie beide zufällig gleich hießen (Review-Befund). */
    id: string;
    name: string;
    city: string;
    /** Belegung in Prozent. */
    load: number;
    /** Gäste diese Woche im Haus. */
    guests: number;
    /** …davon Wiederkehrer. */
    returning: number;
    /** Umsatzmix des Hauses in Prozent, je Zimmertyp (Room/Garden/Corner/Suite). */
    mix: [number, number, number, number];
    /** Zimmer je Typ, aus dem Register — die Belegung baut daraus ihre Spuren. */
    stock: Record<string, number>;
    /** Zimmer des Hauses — die Summe des Bestands. */
    size: number;
    team: AvatarProps[];
  }
  // Die Auslastungszeile der Overview zeigt die Belegung je HAUS; die
  // Rooms-Ansicht darunter zeigt dieselbe Zahl je ZIMMER (das Raster wird aus
  // `load` gebaut, s. $lib/landing/occupancy). Namen, Orte, Teams und
  // Zimmerbestand kommen aus $lib/hotel-tools (EIN Register mit Vollseite und
  // Aufnahme); nur die Betriebszahlen sind Landing-Fiktion. Firn ist klein und
  // praktisch voll — dieselbe Enge, die das Tool für Anfang September meldet.
  const OPS: Record<string, Omit<House, 'id' | 'name' | 'city' | 'stock' | 'size' | 'team'>> = {
    cala: { load: 86, guests: 132, returning: 92, mix: [30, 26, 24, 20] },
    firn: { load: 94, guests: 64, returning: 41, mix: [40, 22, 18, 20] },
    duna: { load: 71, guests: 148, returning: 87, mix: [32, 25, 22, 21] }
  };
  const HOUSES: House[] = GROUP_HOUSES.map((house) => ({
    id: house.id,
    name: house.name,
    city: house.place,
    stock: house.stock,
    size: Object.values(house.stock).reduce((a, b) => a + b, 0),
    team: house.hosts.map((host): AvatarProps => ({ name: host.name, status: host.status })),
    ...OPS[house.id]
  }));
  const GROUP_GUESTS = HOUSES.reduce((n, h) => n + h.guests, 0); // 344
  /** Die Chip-Zeile über den Ansichten: die Gruppe plus je ein Haus. */
  const SCOPES: { key: string | null; label: string }[] = [
    { key: null, label: 'All' },
    ...HOUSES.map((h) => ({ key: h.name, label: h.name }))
  ];
  const activeHouse = $derived(HOUSES.find((h) => h.name === house) ?? null);
  /** Anteil des gewählten Hauses an der Gruppe — skaliert Chart und Zahlen. */
  const share = $derived(activeHouse ? activeHouse.guests / GROUP_GUESTS : 1);

  // Ankünfte je Wochentag, Gruppe — alle sieben Tage: ein Hotel kennt keinen
  // Ruhetag. Freitag/Samstag tragen die Wochenend-Anreisen, genau die Kurve,
  // die auch die Belegung der Rooms-Ansicht trägt.
  const WEEK_ARRIVALS: CartesianDatum[] = [
    { label: 'Mon', values: [30, 4] },
    { label: 'Tue', values: [24, 4] },
    { label: 'Wed', values: [27, 5] },
    { label: 'Thu', values: [33, 6] },
    { label: 'Fri', values: [49, 9] },
    { label: 'Sat', values: [60, 11] },
    { label: 'Sun', values: [38, 6] }
  ];
  // Der Toggle ist keine Deko: ohne Same-day verschwindet die zweite Serie aus
  // Chart UND Legende, und der Badge in der Fußzeile sagt etwas anderes.
  const BOOKING_SERIES: ChartSeries[] = $derived(
    sameDay ? [{ label: 'Reserved' }, { label: 'Same-day' }] : [{ label: 'Reserved' }]
  );
  const bookingsData = $derived(
    WEEK_ARRIVALS.map((d) => ({
      label: d.label,
      values: (sameDay ? d.values : d.values.slice(0, 1)).map((v) => Math.round(v * share))
    }))
  );
  // Die vier Zimmertypen der Gruppe — dasselbe Vokabular wie die Legende des
  // Zeitrasters und die letzte Ebene des Sankey, aus $lib/hotel-tools.
  const MIX_LABELS = ROOM_TYPES.map((room) => room.label.replace(' Room', ''));
  const MIX_INTENTS = ['primary', 'success', 'warning', 'neutral'] as const;
  const GROUP_MIX: [number, number, number, number] = [33, 25, 22, 20];
  const revenueMix: CompositionItem[] = $derived(
    (activeHouse?.mix ?? GROUP_MIX).map((value, i) => ({
      label: MIX_LABELS[i],
      value,
      intent: MIX_INTENTS[i]
    }))
  );
  const team = $derived(activeHouse ? activeHouse.team : HOUSES.flatMap((h) => h.team));
  // Gästezahlen, keine Prozente: der Donut summiert seine Werte zur Mitte.
  // Auf Gruppen-Maßstab (344 guests) liest die Mitte auch nicht versehentlich
  // als „100 %", wie es eine 68/32-Summe täte.
  const GROUP_RETURNING = HOUSES.reduce((n, h) => n + h.returning, 0); // 220
  // Explizite Serienfarben, damit die Textzeile neben dem Ring dieselben Töne
  // als Punkte tragen kann — ohne sie waren die zwei Segmente nicht zuordenbar.
  const returnMix = $derived([
    {
      label: 'Returning',
      value: activeHouse?.returning ?? GROUP_RETURNING,
      color: 'var(--color-primary)'
    },
    {
      label: 'First stay',
      value: (activeHouse?.guests ?? GROUP_GUESTS) - (activeHouse?.returning ?? GROUP_RETURNING),
      color: 'var(--color-neutral-500)'
    }
  ]);

  // ── Rooms: die Belegung im Zimmer-×-Nächte-Raster ──────────────────
  // Das Fenster beginnt HEUTE: die Unterzeile sagt „14 ahead", und der
  // Heute-Knopf der Timeline landet ohnehin auf dem laufenden Tag — ein
  // Wochen-Anker hätte zwei verschiedene Startpunkte für dieselbe Ansicht
  // bedeutet.
  //
  // Kein Anker-plus-$effect-Tanz gegen einen Hydrations-Mismatch, wie ihn die
  // Kachel sonst braucht: die Ansicht startet auf „Overview", das Raster ist
  // also NIE Teil des prerenderten HTML (gemessen am ausgelieferten Dokument:
  // kein `data-blk=\"ResourceTimeline\"`, keine Spur, kein Balken). Was nicht
  // gerendert wird, kann beim Hydrieren nicht widersprechen — deterministisch
  // muss der Generator trotzdem sein, damit „›" und „‹" dasselbe Fenster
  // gleich zeichnen.
  let windowStart = $state(stripToday());
  function stripToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // Vierzehn Nächte breit, zwei Wochen: die Fenstergröße, in der ein Balken von
  // drei bis neun Nächten (der Aufenthalt der Gruppe, s. occupancy.ts) als
  // Balken lesbar ist statt als Punkt — und in der die Auslastung eines Zimmers
  // überhaupt Stufen hat (bei sieben Nächten ist jede freie Nacht 14 %).
  const OCCUPANCY_NIGHTS = 14;
  // Die Häuser, wie die Belegung sie braucht: Bestand aus dem Register,
  // Auslastung aus derselben OPS-Fiktion, die die Progress-Zeile zeigt. Ein
  // Wert, zwei Anzeigen — occupancy.test.ts misst, dass das Raster die Prozente
  // der Balken trifft.
  const OCCUPANCY_HOUSES: OccupancyHouse[] = $derived(
    (activeHouse ? [activeHouse] : HOUSES).map((h) => ({
      id: h.id,
      name: h.name,
      place: h.city,
      stock: h.stock,
      load: h.load
    }))
  );
  const occupancy = $derived(
    buildOccupancy({
      houses: OCCUPANCY_HOUSES,
      windowStart,
      nights: OCCUPANCY_NIGHTS
    })
  );
  // Ein Haus braucht keine Gruppenzeile — sein Name steht in der Unterzeile der
  // Karte. Die Gruppen-Sicht braucht sie: sonst wäre die Spur „101" dreimal da.
  const occupancyGroups = $derived(activeHouse ? undefined : occupancy.groups);
  // Freie Zimmer heute Nacht — GEZÄHLT, in derselben Menge, die das Raster
  // zeichnet. Vorher stand hier der unbelegte Anteil des Bestands
  // (`size × (100 − load)/100`, mit einem Boden von 1) und widersprach der
  // ersten Rasterspalte daneben: 8 gegen gezählte 7, und an einem Tag stand
  // Firn im Raster auf 0 von 9, während der Badge 1 behauptete (Review-Befund
  // 2026-08-12). Die Prozentzahl gilt dem Fenster, diese Zahl der Nacht.
  const freeRooms = $derived(freeRoomsOn(occupancy, windowStart));

  // Die Unterzeile der Karte. Bei „All" zeigt die Rooms-Ansicht alle drei
  // Häuser mit Gruppenzeilen, bei einem Haus trägt DIESE Zeile den Namen —
  // darum braucht das Raster dort keine Gruppenzeile (s. `occupancyGroups`).
  const cardSubtitle = $derived(
    activeHouse ? `${activeHouse.name} · ${activeHouse.city}` : 'All three houses'
  );

  // ── Flow: woher die 344 Gäste kommen und wo sie schlafen ───────────
  // Drei Ebenen, und jede Ebene summiert sich auf dieselben 344 wie der Donut;
  // die letzte Ebene trägt die Zimmertypen, deren Umsatzanteile die
  // CompositionBar zeigt (33/25/22/20).
  const FLOW_NODES = [
    { id: 'direct', label: 'Direct', intent: 'primary' as const },
    { id: 'website', label: 'Website', intent: 'warning' as const },
    { id: 'partners', label: 'Partners', intent: 'neutral' as const },
    ...HOUSES.map((h) => ({
      id: h.name.toLowerCase(),
      label: h.name,
      intent: 'secondary' as const
    })),
    { id: 'room', label: 'Room', intent: 'primary' as const },
    { id: 'garden', label: 'Garden', intent: 'success' as const },
    { id: 'corner', label: 'Corner', intent: 'warning' as const },
    { id: 'suite', label: 'Suite', intent: 'neutral' as const }
  ];
  const FLOW_LINKS = [
    // Stufe 1 fließt in secondary — dem Ton der Haus-Säulen, in die sie
    // mündet. Farbe BEDEUTET im Fluss damit genau eines, den Zimmertyp
    // (Stufe 2); erbten die Kanal-Kanten ihre Knoten-Intents, hieße Orange
    // links „Direct" und rechts „Room" im selben Bild (Review-Befund
    // 2026-08-12). Die Kanal-Knoten selbst bleiben farbig unterscheidbar.
    { source: 'direct', target: 'cala', value: 58, intent: 'secondary' as const },
    { source: 'direct', target: 'firn', value: 30, intent: 'secondary' as const },
    { source: 'direct', target: 'duna', value: 62, intent: 'secondary' as const },
    { source: 'website', target: 'cala', value: 51, intent: 'secondary' as const },
    { source: 'website', target: 'firn', value: 22, intent: 'secondary' as const },
    { source: 'website', target: 'duna', value: 55, intent: 'secondary' as const },
    { source: 'partners', target: 'cala', value: 23, intent: 'secondary' as const },
    { source: 'partners', target: 'firn', value: 12, intent: 'secondary' as const },
    { source: 'partners', target: 'duna', value: 31, intent: 'secondary' as const },
    // Stufe 2 trägt den Zimmertyp als expliziten Link-intent — dieselben vier
    // Töne wie Umsatzmix und Raster-Legende. Ohne ihn erbten alle zwölf Kanten
    // das secondary der Häuser, und die rechte Bildhälfte war ein einziger
    // einfarbiger Strang (Screenshot-Befund 2026-08-12).
    { source: 'cala', target: 'room', value: 40, intent: 'primary' as const },
    { source: 'cala', target: 'garden', value: 34, intent: 'success' as const },
    { source: 'cala', target: 'corner', value: 32, intent: 'warning' as const },
    { source: 'cala', target: 'suite', value: 26, intent: 'neutral' as const },
    { source: 'firn', target: 'room', value: 26, intent: 'primary' as const },
    { source: 'firn', target: 'garden', value: 14, intent: 'success' as const },
    { source: 'firn', target: 'corner', value: 11, intent: 'warning' as const },
    { source: 'firn', target: 'suite', value: 13, intent: 'neutral' as const },
    { source: 'duna', target: 'room', value: 47, intent: 'primary' as const },
    { source: 'duna', target: 'garden', value: 37, intent: 'success' as const },
    { source: 'duna', target: 'corner', value: 33, intent: 'warning' as const },
    { source: 'duna', target: 'suite', value: 31, intent: 'neutral' as const }
  ];
  // Der Fluss bleibt bei einer Hausauswahl vollständig — die Gesamtsumme ist
  // der Punkt der Ansicht —, aber alles, was nicht durch das gewählte Haus
  // läuft, fällt auf `neutral` zurück. Man sieht damit den Anteil EINES Hauses
  // im Bild der ganzen Gruppe, statt die Gruppe zu verlieren.
  const houseId = $derived(house?.toLowerCase() ?? null);
  const HOUSE_IDS = HOUSES.map((h) => h.name.toLowerCase());
  const flowNodes = $derived(
    FLOW_NODES.map((n) =>
      houseId && HOUSE_IDS.includes(n.id) && n.id !== houseId
        ? { ...n, intent: 'neutral' as const }
        : n
    )
  );
  const flowLinks = $derived(
    FLOW_LINKS.map((l) =>
      !houseId || l.source === houseId || l.target === houseId
        ? l
        : { ...l, intent: 'neutral' as const }
    )
  );
  // Sankey-Höhe aus der gemessenen Bühne statt fixer 264 px: die Karte ist so
  // hoch wie die Kachel (72vh-Klammer), und ein fixes SVG ließ auf großen
  // Bühnen ein halbes Kartenfeld leer. Abzug 30 px = gemessener Chrome über
  // dem SVG (Kopfzeile 18 + mt-3 12); Boden 200, weil der alte 264er-Boden
  // auf 900-px-Schirmen die Ansicht um 7 px überlaufen ließ (beides
  // Review-Befunde 2026-08-12).
  let flowHostHeight = $state(0);
  const flowHeight = $derived(Math.max(200, flowHostHeight - 30));

  // ── Table: die heutigen Ankünfte der GRUPPE, gruppiert nach Haus ──
  // Häuser und Zimmertypen aus $lib/hotel-tools, Raten = Typpreis × Nächte.
  // Die Gäste sind Namen aus der Gästeliste der Rooms-Ansicht, und ihre
  // Haus-Zuordnung folgt DERSELBEN Drittel-Partition (CLIENTS-Index % 3,
  // $lib/landing/occupancy): wo ein Name im Belegungsraster auftaucht, trägt er
  // dort dasselbe Haus wie hier. Vorher widersprachen sich Tabelle und Raster
  // für bis zu 10 von 15 Gästen sichtbar (Review-Befund 2026-08-12).
  interface Arrival {
    id: string;
    house: 'Cala' | 'Firn' | 'Duna';
    time: string;
    guest: string;
    room: string;
    nights: number;
    status: 'confirmed' | 'pending' | 'same-day';
    /** Zahl, nicht "€900": Suche, Sortierung UND Summe rechnen auf dem
        Accessor-Wert. Das Währungszeichen ist Anzeige — `formatter`. */
    rate: number;
  }
  // Je Haus chronologisch — die Gruppenreihenfolge ist die Array-Reihenfolge.
  const ARRIVALS: Arrival[] = [
    {
      id: 'a1',
      house: 'Cala',
      time: '14:00',
      guest: 'M. Okafor',
      room: 'Garden',
      nights: 3,
      status: 'confirmed',
      rate: 900
    },
    {
      id: 'a2',
      house: 'Cala',
      time: '14:30',
      guest: 'G. Halloran',
      room: 'Room',
      nights: 4,
      status: 'confirmed',
      rate: 960
    },
    {
      id: 'a3',
      house: 'Cala',
      time: '15:00',
      guest: 'H. Sørensen',
      room: 'Garden',
      nights: 4,
      status: 'confirmed',
      rate: 1200
    },
    {
      id: 'a4',
      house: 'Cala',
      time: '16:00',
      guest: 'T. Nguyen',
      room: 'Room',
      nights: 3,
      status: 'same-day',
      rate: 720
    },
    {
      id: 'a5',
      house: 'Cala',
      time: '17:15',
      guest: 'J. Kovács',
      room: 'Room',
      nights: 2,
      status: 'same-day',
      rate: 480
    },
    {
      id: 'a6',
      house: 'Firn',
      time: '14:30',
      guest: 'J. Laurent',
      room: 'Room',
      nights: 2,
      status: 'confirmed',
      rate: 480
    },
    {
      id: 'a7',
      house: 'Firn',
      time: '15:45',
      guest: 'S. Duran',
      room: 'Corner',
      nights: 3,
      status: 'confirmed',
      rate: 1080
    },
    {
      id: 'a8',
      house: 'Firn',
      time: '16:15',
      guest: 'A. Beck',
      room: 'Corner',
      nights: 3,
      status: 'pending',
      rate: 1080
    },
    {
      id: 'a9',
      house: 'Firn',
      time: '16:45',
      guest: 'E. Sato',
      room: 'Corner',
      nights: 5,
      status: 'confirmed',
      rate: 1800
    },
    {
      id: 'a10',
      house: 'Firn',
      time: '18:00',
      guest: 'O. Adebayo',
      room: 'Suite',
      nights: 5,
      status: 'confirmed',
      rate: 2600
    },
    {
      id: 'a11',
      house: 'Duna',
      time: '14:15',
      guest: 'C. Waweru',
      room: 'Room',
      nights: 2,
      status: 'confirmed',
      rate: 480
    },
    {
      id: 'a12',
      house: 'Duna',
      time: '15:15',
      guest: 'A. Reyes',
      room: 'Suite',
      nights: 4,
      status: 'pending',
      rate: 2080
    },
    {
      id: 'a13',
      house: 'Duna',
      time: '16:30',
      guest: 'T. Csorba',
      room: 'Garden',
      nights: 6,
      status: 'confirmed',
      rate: 1800
    },
    {
      id: 'a14',
      house: 'Duna',
      time: '17:00',
      guest: 'R. Lindqvist',
      room: 'Suite',
      nights: 7,
      status: 'pending',
      rate: 3640
    },
    {
      id: 'a15',
      house: 'Duna',
      time: '17:30',
      guest: 'P. Whitfield',
      room: 'Garden',
      nights: 2,
      status: 'confirmed',
      rate: 600
    }
  ];

  // ── A2UI: das Hotel-Exponat (LiveryTile) — echtes aufgezeichnetes
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

  // Das Inventar hat sein eigenes View: Die Suche steht in einem `Input`
  // daneben, also schreibt sie von außen auf die Achse. Sortierung und
  // Seitengröße sind Startwerte dieses Views, keine zweite Prop-Ebene.
  //
  // Der einmalige Zugriff auf `data` ist Absicht: `+page.server.ts` liest weder
  // `url` noch `params`, es gibt kein `depends`/`invalidate` und die Route ist
  // prerendert — die Zeilenzahl ist eine Build-Konstante, nichts, was
  // `view.pageSize` später nachziehen müsste.
  // svelte-ignore state_referenced_locally
  const inventoryView = createTableView({
    defaults: { pageSize: data.rows.length, sort: { column: 'name', direction: 'asc' } }
  });

  // Ein direkter Feldschreiber setzt die Seite nicht zurück (nur die Handler der
  // Tabelle tun das). Folgenlos hier: Es gibt genau eine Seite.
  $effect(() => {
    inventoryView.search = query;
  });

  // Auswahl in der URL — teilbar wie im Hero, aber ERSETZEND. Ein Eintrag pro
  // Klick klingt nach "überlebt den Zurück-Knopf" und ist das Gegenteil: nach
  // einem Durchlauf durch die Liste standen 50 Einträge in der History (Chromes
  // Deckel), und der Zurück-Knopf führte nicht mehr aus der Seite heraus,
  // sondern durch die zuletzt angesehenen Komponenten. Auf der Einstiegsseite
  // ist "zurück" für die meisten Besucher der Weg nach draußen. Die Auswahl ist
  // Zustand innerhalb einer Ansicht, keine Navigation — dieselbe Einordnung wie
  // Sortierung oder Filter. Am Deeplink ändert das nichts: `?c=calendar` lädt
  // unverändert dieselbe Ansicht, geteilte Links bleiben gültig.
  /** Ziel des Beobachters der Kopfleiste: die große Marke (LandingHeader). */
  let brandEl = $state<HTMLElement | undefined>();

  const [selectedSlug, setSelectedSlug] = useUrlParam<string | null>('c', {
    parse: (sp) => sp.get('c'),
    serialize: (value) => new URLSearchParams(value ? { c: value } : {}),
    initial: null,
    replaceState: true
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
  <LandingHeader watch={brandEl} />
  <main class="proto" lang="en">
    <!-- ── Zeile 1: erinnern + staunen ─────────────────────────────── -->
    <section class="row1" aria-label="Hero">
      <div class="name-tile">
        <!-- Eyebrow und ThemeSwitcher wohnen seit 2026-08-12 in der Kopfleiste
             (LandingHeader) — die Kachel ist reine Titelseite: Name mittig,
             Beweis unten. -->
        <div class="name-mid">
          <!-- The page h1. It was a `<p>`, so the site's own front page had no
               top-level heading at all: the outline started at h2 and heading
               navigation landed mid-page. Tailwind's preflight zeroes h1 margin
               and font-size, and `.brand` sets both, so nothing moves.
               The signature ticks became scroller controls, so they sit in a
               labelled `role="group"` — and a heading takes its name from its
               contents, where a labelled descendant contributes its LABEL. So
               the h1 was named "urbicon ui Highlights" (measured). `aria-label`
               pins the name to the wordmark; the five buttons stay in the tree,
               focusable and individually named. -->
          <h1 class="brand" aria-label={`${BRAND} ${BRAND_SUFFIX}`} bind:this={brandEl}>
            {BRAND} <span class="brand-suffix">{BRAND_SUFFIX}</span><span
              class="ticks"
              role="group"
              aria-label="Highlights"
              >{#each TILES as tile, i (tile.key)}<button
                  type="button"
                  class={['tick', activeTile === i && 'on']}
                  style:background={tile.channel.solid}
                  aria-label={`Show ${tile.title}`}
                  aria-current={activeTile === i ? 'true' : undefined}
                  onclick={() => goToTile(i)}
                ></button>{/each}</span
            >
          </h1>
          <!-- Der Anspruch trägt die Kachel: der zweite Satz ist das, was die
               Aussage macht, also steht der erste zurück (Helligkeit, nicht
               Farbe — die Striche bleiben die einzige Buntheit auf dieser
               Fläche). Die erste Hälfte ist die Eintrittskarte (0 Deps hat
               nicht nur diese Bibliothek), die zweite ist das Argument: dass
               der Gate die Verwendung dort hält, wo sie hingehört. -->
          <p class="claim">{CLAIM_LEAD} <strong>{CLAIM_POINT}</strong></p>
        </div>
        <p class="proof">{PROOF}</p>
      </div>

      <div class="attractions">
        <!-- Overlay-Steuerung als slotClasses-Experiment (keine Komponentenänderung):
           Pfeile links/rechts mittig, Dots als Chip unten mittig. Bewährt sich das,
           wird es eine echte Achse (controlsPlacement) am Scroller. -->
        <!-- `itemBasis` gerundet, nicht schlicht `85%`: 85 % von 1012 px sind
           860,195 px, und die Nachkommastelle summiert sich über die Reihe —
           Kachel 3 begann bei x=2200,39. Eine Kachelkante auf einem halben Pixel
           malt der Browser als Mischfarbe, und die las sich als weiße Haarlinie
           links der Kachel (gemessen 2026-08-13; nach der Rundung liegen alle
           fünf auf ganzen Pixeln). Welche Kachel es trifft, hängt an der
           Fensterbreite — es war nie die A2UI-Kachel als solche. -->
        <Scroller
          label="Highlights"
          itemBasis="round(85%, 1px)"
          snap="mandatory"
          indicator="dots"
          class="relative"
          onActiveChange={(i) => (activeTile = i)}
          slotClasses={{
            viewport: '!gap-0 !py-0',
            controls: '!absolute inset-0 !pt-0 !justify-between px-4 pointer-events-none',
            // Die Pfeile liegen als Overlay ÜBER der Karte und deckten dort
            // Inhalt zu (die Uhrzeit der ersten Buchungszeile stand hinter dem
            // linken Knopf). Wo gewischt wird, sind sie ohnehin die zweite
            // Bedienung — also blenden sie sich per `pointer: coarse` aus, nicht
            // per Breite: ein schmales Desktop-Fenster ist kein Touchscreen und
            // hätte mit einer Breiten-Regel BEIDE Zeiger-Bedienungen verloren
            // (der Scroller blendet seine Scrollleiste aus, solange er eine
            // Steuerleiste zeigt). Was bleibt, bleibt in jedem Fall: der
            // Viewport ist ein Tab-Stop mit Pfeil-/Pos1-/Ende-Navigation, und
            // die Dots sind echte Knöpfe in der freien Zone unter der Karte.
            // Beide Slots sind absolut positioniert — Ausblenden verschiebt
            // nichts.
            control: 'pointer-events-auto shadow-md [@media(pointer:coarse)]:hidden',
            indicator:
              '!absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto rounded-full bg-surface-base/85 px-2 py-1'
          }}
        >
          {#each TILES as tile, i (tile.key)}
            <article
              bind:this={tileEls[i]}
              class="tile room-accent"
              style:--tile-solid={tile.channel.solid}
              style:--tile-deep={tile.channel.deep}
              style:--tile-on={tile.channel.on}
            >
              <div class="tile-body">
                {#if tile.key === 'blocks'}
                  <!-- EIN Backoffice, EINE Karte, DREI Ansichten: die Karte ist
                       ihr eigener Container und baut sich per @container um —
                       schmal gestapelt, breit zweispaltig. Mobile bekommt
                       dasselbe Backoffice, nur gestapelt.
                       `xray` legt über jedes Bauteil seinen Namen (siehe
                       `.xray` im Stilblock) — die Kachel für „Umfang" zeigt
                       damit auf Wunsch, woraus sie besteht. -->
                  <div class={['card', 'dash2', xray && 'xray']}>
                    <div class="dash-head">
                      <div>
                        <p class="dash-title">{GROUP_NAME}</p>
                        <p class="dash-sub">{cardSubtitle}</p>
                      </div>
                      <div class="blk" data-blk="SegmentGroup">
                        <SegmentGroup bind:value={dashView} size="sm" ariaLabel="Backoffice view">
                          <SegmentItem value="overview">Overview</SegmentItem>
                          <SegmentItem value="rooms">Rooms</SegmentItem>
                          <SegmentItem value="flow">Flow</SegmentItem>
                        </SegmentGroup>
                      </div>
                    </div>
                    <!-- Der Geltungsbereich steht ÜBER den Ansichten, weil er
                         auf alle drei wirkt. Bis 2026-08-03 war er nur eine
                         Auslastungszeile im Körper der Overview — also eine
                         Ebene unter dem, worauf er wirkt, und ausgerechnet in
                         der damaligen Schedule-Ansicht unerreichbar, die per
                         Bauart eine Ein-Haus-Ansicht war. Die Zeilen bleiben
                         zusätzlich
                         klickbar: zwei Wege, ein Zustand, wie Filterleiste und
                         Zeilenklick in einer Tabelle. -->
                    <div class="scope" role="group" aria-label="House">
                      {#each SCOPES as s (s.key)}
                        <button
                          type="button"
                          class="chip"
                          aria-pressed={house === s.key}
                          onclick={() => (house = s.key)}
                        >
                          <span class="blk" data-blk="Badge">
                            <Badge
                              size="sm"
                              tier="commit"
                              variant={house === s.key ? 'filled' : 'soft'}
                              intent={house === s.key ? 'primary' : 'neutral'}>{s.label}</Badge
                            >
                          </span>
                        </button>
                      {/each}
                    </div>
                    {#if dashView === 'overview'}
                      <div class="dash-body">
                        <!-- Jeder Block trägt seine eigene kleine Überschrift:
                             ohne sie war der Chart eine unbeschriftete Kurve
                             und der Umsatzmix vier Farben ohne Aussage
                             (Review-Befund 2026-08-10). Der Chart nimmt die
                             volle Kartenbreite; die Legende ist an, weil zwei
                             ungelabelte Serien nicht selbsterklärend sind.
                             Gestapelt, weil Same-day ein TEIL der Tages-
                             ankünfte ist: als eigene Fläche kroch die kleine
                             Serie (4–11 gegen 24–60) als Strich am Chart-Boden
                             und las sich als Renderfehler; als Band auf
                             Reserved ist die Summe die Kurve — dieselben
                             Tagessummen, deren Dichte das Zeitraster zeigt. -->
                        <div>
                          <p class="dash-sub">Arrivals this week</p>
                          <div class="blk mt-2" data-blk="AreaChart">
                            <AreaChart
                              data={bookingsData}
                              series={BOOKING_SERIES}
                              height={96}
                              showLegend
                              stacked
                            />
                          </div>
                        </div>
                        <div class="dash-cols">
                          <div class="dash-main">
                            <div>
                              <p class="dash-sub">Revenue by room type</p>
                              <!-- Die Werte SIND Prozente: formatValue macht sie
                                 zur Anzeige, showPercentages bliebe sonst als
                                 Doppelung daneben stehen (Legende druckt Wert
                                 immer). -->
                              <div class="blk mt-2" data-blk="CompositionBar">
                                <CompositionBar
                                  items={revenueMix}
                                  size="sm"
                                  showLegend
                                  showPercentages={false}
                                  formatValue={(v) => `${v} %`}
                                  legendPlacement="bottom"
                                />
                              </div>
                            </div>
                            <div>
                              <p class="dash-sub">Guests in house</p>
                              <div class="dash-donut">
                                <div class="blk" data-blk="DonutChart">
                                  <DonutChart
                                    data={returnMix}
                                    size={72}
                                    showLegend={false}
                                    showTotal
                                    totalLabel="guests"
                                    ariaLabel="Returning guests this week"
                                  />
                                </div>
                                <p class="aside-note">
                                  <span class="mix-pair"
                                    ><span class="mix-dot" style:background={returnMix[0].color}
                                    ></span><strong>{returnMix[0].value}</strong> returning</span
                                  >
                                  ·
                                  <span class="mix-pair"
                                    ><span class="mix-dot" style:background={returnMix[1].color}
                                    ></span><strong>{returnMix[1].value}</strong> first stay</span
                                  >
                                </p>
                              </div>
                            </div>
                          </div>
                          <div class="dash-side">
                            <div class="dash-head">
                              <p class="dash-sub">
                                {activeHouse ? 'Occupancy · on duty' : 'Occupancy today · on duty'}
                              </p>
                              <!-- Die Gesichter sind nicht mehr Deko: sie zeigen
                                   das Team des gewählten Hauses und wechseln mit
                                   ihm. Die Zeile benennt sie in BEIDEN Sichten
                                   („on duty") — unbeschriftete Status-Avatare
                                   neben einer Belegungsliste waren ein
                                   Fragezeichen (Screenshot-Befund 2026-08-12). -->
                              <div class="blk" data-blk="AvatarGroup">
                                <AvatarGroup items={team} max={4} size="sm" />
                              </div>
                            </div>
                            <!-- Eine Zeile je Haus, und jede ist ein Schalter:
                                 der Klick zieht Chart, Umsatzmix, Donut, Team,
                                 Kopfzeile und die Terminwoche mit. Progress ist
                                 eine Anzeige — die Bedienbarkeit gehört dem
                                 Button darum, nicht der Komponente darin. -->
                            <div class="houses">
                              {#each HOUSES as h (h.name)}
                                <!-- Eigenes `aria-label`: der einzige Inhalt des
                                     Buttons ist ein `role="progressbar"`, dessen
                                     Name auf ihm selbst sitzt und nicht nach
                                     oben durchschlägt — ohne diese Zeile ist es
                                     ein Knopf ohne Namen. -->
                                <button
                                  type="button"
                                  class={['house', house === h.name && 'on']}
                                  aria-pressed={house === h.name}
                                  aria-label={`${h.name}, ${h.city} — ${h.load} % booked`}
                                  onclick={() => (house = house === h.name ? null : h.name)}
                                >
                                  <span class="blk" data-blk="Progress">
                                    <Progress
                                      value={h.load}
                                      label={h.name}
                                      showValue
                                      formatValue={(v) => `${v} %`}
                                    />
                                  </span>
                                </button>
                              {/each}
                            </div>
                          </div>
                        </div>
                      </div>
                    {:else if dashView === 'rooms'}
                      <!-- Die Belegung der Gruppe: je Zimmer eine Spur, je
                           Nacht eine Spalte, je Aufenthalt ein Balken. Warum
                           die Prozente hier und in der Progress-Zeile
                           dieselben sind und woher Namen und Nächte kommen,
                           steht am Kopf von $lib/landing/occupancy (die eine
                           Stelle für diese Erzählung).

                           Bis 2026-08-12 stand hier ein Calendar mit
                           Empfangsvorgängen im Zeitraster — eine Erzählung,
                           die nur deshalb Vorgänge zeigte, weil dem Set die
                           Resource-Timeline fehlte (#185). Sie ist da (#190).

                           `onNavigate` ist der Datenlade-Hook der Komponente,
                           und hier ist er echt: die Pfeile verschieben das
                           Fenster, der Generator baut die nächsten vierzehn
                           Nächte. Ohne diese Zeile zeigte „›" ein leeres
                           Raster.

                           `.rooms-host` statt der scrollenden `.view-host`: 39
                           Spuren sind höher als jede Kachelbühne, und wenn die
                           BÜHNE scrollt, fahren Datumsachse und Legende mit
                           hinaus — gemessen 2026-08-12: nach 600 px Scroll
                           standen Balken über unbeschrifteten Spalten
                           (Review-Befund). Also scrollt der Spur-Körper, nicht
                           die Bühne: der Tagesstreifen der Komponente bekommt
                           eine Höhengrenze und wird damit selbst zum
                           Scroll-Container, und die Kopfzeile klebt an seinem
                           oberen Rand (`sticky`, was nur INNERHALB desselben
                           Scroll-Containers wirkt — darum die Grenze am Track
                           und nicht am Host). -->
                      <div class="rooms-host">
                        <!-- Die Zimmertyp-Legende steht HIER in der Kopfzeile,
                             die komponenteneigene ist aus (showLegend unten):
                             die säße unterhalb der View und läge genau dann im
                             unsichtbaren Scroll-Rest, wenn das Raster die
                             Bühne füllt — eine Legende, die man nur per Scroll
                             findet, erklärt nichts. -->
                        <div class="legend-row">
                          <p class="dash-sub">Rooms — nights booked, {OCCUPANCY_NIGHTS} ahead</p>
                          <p class="dash-sub">
                            {#each ROOM_CATEGORIES as c (c.id)}
                              <span class="mix-pair"
                                ><span class="mix-dot" style:background={c.color}
                                ></span>{c.label}</span
                              >
                            {/each}
                          </p>
                        </div>
                        <div class="blk mt-2" data-blk="ResourceTimeline">
                          <ResourceTimeline
                            view="days"
                            days={OCCUPANCY_NIGHTS}
                            value={windowStart}
                            size="sm"
                            locale="en-GB"
                            resources={occupancy.resources}
                            groups={occupancyGroups}
                            items={occupancy.stays}
                            categories={ROOM_CATEGORIES}
                            getResourceId={(stay) => stay.roomId}
                            getRange={(stay) => ({ start: stay.firstNight, end: stay.lastNight })}
                            getCategoryId={(stay) => stay.typeId}
                            getLabel={(stay) => stay.guest}
                            getId={(stay) => stay.id}
                            showLegend={false}
                            slotClasses={{
                              // Die Höhengrenze macht den Track zum
                              // Scroll-Container; `dayHeaderRow` klebt darin
                              // oben. Die Spur-Spalte klebt weiterhin links —
                              // beide Achsen gehören demselben Container, sonst
                              // liefe die Spaltenausrichtung auseinander.
                              track: 'rooms-track max-h-full',
                              // Nur `sticky` und die Deckfläche: die Stapelhöhe
                              // gegenüber der klebenden Spur-Spalte gehört der
                              // Komponente (`z-30` im dayHeaderRow-Slot), nicht
                              // dem Aufrufer — ein Zahlenwert hier wäre ein
                              // hartkodierter z-index neben einer Skala, die er
                              // nicht kennt.
                              dayHeaderRow: 'sticky top-0 bg-surface-base'
                            }}
                            onNavigate={(date) => (windowStart = date)}
                          />
                        </div>
                      </div>
                    {:else}
                      <!-- Dieselben 344 Gäste wie im Donut, nur von der Seite
                           gesehen: Kanal → Haus → Zimmertyp. Die Kopfzeile
                           sagt, was fließt — ohne sie war der Sankey ein
                           unbeschriftetes Diagramm in einer leeren Karte
                           (Review-Befund 2026-08-10). Die Höhe ist gemessen
                           (bind:clientHeight), nicht fix: ein 264-px-SVG in
                           einer 72vh-Karte ließ das halbe Feld leer. -->
                      <div class="view-host" bind:clientHeight={flowHostHeight}>
                        <p class="dash-sub">
                          Where {GROUP_GUESTS} guests came from — and where they sleep
                        </p>
                        <div class="blk mt-3" data-blk="Sankey">
                          <Sankey
                            nodes={flowNodes}
                            links={flowLinks}
                            height={flowHeight}
                            nodeWidth={12}
                            nodePadding={10}
                            formatValue={(v) => `${v} guests`}
                          />
                        </div>
                      </div>
                    {/if}
                    <!-- Nur in der Overview: der Toggle wirkt auf Chart-Serie
                         und Badge — in Rooms und Flow stünde er als
                         Schalter ohne Wirkung herum (Review-Befund
                         2026-08-10). -->
                    {#if dashView === 'overview'}
                      <div class="dash-foot">
                        <div class="blk" data-blk="Toggle">
                          <Toggle bind:checked={sameDay} label="Take same-day arrivals" size="sm" />
                        </div>
                        <!-- `modify` statt der Badge-Voreinstellung `commit`: die
                         Pille sah aus wie ein Knopf und war keiner — auf einer
                         Fläche, auf der jetzt alles andere wirklich schaltet,
                         ist genau das die Irreführung. Als Status liest der
                         kleine Radius richtig.
                         soft ist Geschmack, nicht mehr Notwehr: die solide
                         Intent-Fläche trug text-on-primary, das im
                         .room-accent-Scope auf den Kanal umgefärbt wurde. Seit
                         2026-07-31 tragen die nicht-primary Füllungen
                         text-on-fill, das kein Raum überschreibt (#47). -->
                        <div class="blk" data-blk="Badge">
                          <Badge
                            intent={sameDay ? 'success' : 'neutral'}
                            variant="soft"
                            tier="modify"
                          >
                            {sameDay ? `${freeRooms} rooms free tonight` : 'Reservations only'}
                          </Badge>
                        </div>
                      </div>
                    {/if}
                  </div>
                {:else if tile.key === 'table'}
                  <!-- `cardsBelow`: die Kachel ist 781px breit und verfehlte den
                       Standardschritt (48rem = 768px) um vier Pixel — sie zeigte
                       Karten, während das `thead`-CSS unten auf einen stehenden
                       Tabellenkopf wartete. 36rem ist der Schritt über dem
                       gemessenen Mindestbedarf dieser sechs Spalten (35.75rem):
                       in der schmalen Kachelbreite (650px) steht die Tabelle
                       noch, darunter kippt sie in die Karten. -->
                  <div class="card card-table">
                    <Table
                      items={ARRIVALS}
                      cardsBelow="36rem"
                      columns={[
                        { accessor: 'time', title: 'Time', sortable: true, width: '4.5rem' },
                        { accessor: 'guest', title: 'Guest', sortable: true, searchable: true },
                        { accessor: 'room', title: 'Room', searchable: true, width: '4.5rem' },
                        {
                          accessor: 'nights',
                          title: 'Nights',
                          dataType: 'number',
                          align: 'right',
                          width: '4rem'
                        },
                        { accessor: 'status', title: 'Status', cell: statusCell },
                        {
                          accessor: 'rate',
                          title: 'Rate',
                          // `dataType` ist ab 2026-07-31 das, was die Spalte
                          // summierbar macht — vorher reichte der Name "price",
                          // was für Spalten in anderen Sprachen nie funktioniert
                          // hat. Ohne diese Zeile bleibt der Σ-Knopf dauerhaft
                          // deaktiviert.
                          dataType: 'number',
                          align: 'right',
                          width: '4.5rem',
                          // Trägt die Währung — für die Zelle UND für die
                          // Summenzeile (useSummary greift auf denselben
                          // Formatter zurück).
                          formatter: (value) => `€${value}`
                        }
                      ]}
                      viewDefaults={{ groupBy: 'house' }}
                      variant="flush"
                      size="sm"
                      ariaLabel="Today's arrivals across the three houses of Fermata"
                    />
                  </div>
                {:else if tile.key === 'a2ui'}
                  <div class="hotel-host">
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
                {:else if tile.key === 'blocks'}
                  <!-- Der Schalter steht AUF der Kachel, nicht in der Karte: er
                       spricht über die Fläche, nicht im Hotel. Innerhalb der
                       Karte gilt die Fiktion, hier draußen die Bibliothek. -->
                  <button
                    type="button"
                    class="tile-link"
                    aria-pressed={xray}
                    onclick={() => (xray = !xray)}
                  >
                    {xray ? 'Hide the parts' : 'Show the parts'}
                    <span aria-hidden="true">⌗</span>
                  </button>
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
          <!-- Ohne das bot Chrome hier gespeicherte Formularwerte an und legte
               eine Mailadresse über das Filterfeld der Landingpage. `off`
               allein reicht dafür nicht — ein namenloses Textfeld ordnet Chrome
               heuristisch ein, also bekommt es einen Namen, der in keiner
               Autofill-Kategorie liegt. Ein `<form>` gibt es hier nicht, der
               Name ist reine Kennzeichnung. -->
          <Input
            bind:value={query}
            variant="underline"
            size="sm"
            clearable
            autocomplete="off"
            name="component-filter"
            placeholder="Filter {data.rows.length} components"
            aria-label="Filter components"
          />
        </div>
        <!-- Alle Zeilen auf einmal, die Spalte scrollt selbst; der leere
           pagination-Snippet nimmt dem Fuß das Chrom (wie im Hero).
           `sticky="header"`: bei 99 Zeilen ist die Kopfzeile die einzige
           Auskunft darüber, dass 41.6 die kB-Spalte ist und nicht die Props —
           sie muss stehen bleiben. Die Table pinnt gegen ihren Scroll-Vorfahren
           (hier `.inventory`) und lässt dafür den eigenen `overflow-x`-Wrapper
           weg, der jedes Pinning von außen aushebeln würde.

           `cardsBelow`: die Table misst ihre eigene Box, und diese Spalte ist
           per Grid auf 34rem gedeckelt — beim Standardschritt (48rem) fiele sie
           also bei JEDER Fensterbreite in die Kartenansicht, obwohl die vier
           Spalten hier viel weniger brauchen. 32rem ist der nächste Schritt über
           dem, was sie zusammen fordern: 29rem plus Zellpolster sind gemessene
           487px, und der Schritt darunter (28rem = 448px) ließ die Tabelle bei
           1300px Fensterbreite um 19px aus ihrer Spalte laufen. Die Spalte (36vw)
           erreicht 32rem ab 1420px Fensterbreite; darunter — und einspaltig
           gestapelt unter 48rem sowieso — stehen die Karten.
           Ein `!min-w-0` braucht die Tabelle dafür nicht mehr: das Raster trägt
           gar keine Mindestbreite mehr, weil der Schritt selbst schon garantiert,
           dass es nur oberhalb seiner eigenen Breite rendert.

           Die 1420px sind knapp: `scripts/capture-shots.ts` nimmt bei 1440px auf,
           die Spalte misst dort 518px gegen 512px Schwelle — 6px Spaltenluft,
           bei 36vw rund 17px Fensterbreite. Deshalb prüft der
           Aufnahmelauf am DOM nach, dass er das Raster fotografiert und nicht die
           Karten (`assertInventoryRendersAsGrid`) — wer hier am Spaltenverhältnis
           dreht, bekommt einen Fehlschlag statt vier still getauschter Bilder. -->
        <div class="inventory">
          <Table
            items={data.rows}
            view={inventoryView}
            enableSmartFilter={false}
            variant="flush"
            size="sm"
            sticky="header"
            cardsBelow="32rem"
            ariaLabel="Every component in the set"
            onRowClick={(row) => setSelectedSlug((row as HeroRow).slug)}
            activeRowId={selected.id}
            slotClasses={{
              headerCell: '!py-2 !text-[0.6875rem] !font-medium !uppercase !tracking-[0.14em]',
              row: '!border-b-0',
              cell: '!py-[0.3rem] !align-middle'
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
      <!-- Der Schritt zeigt den sv-Pfad, nicht `bun add`: das Add-on installiert
           die Pakete UND schreibt den Stylesheet-Import, womit die zwei Zeilen
           hier wirklich alles sind. Mit `bun add` schuldete die Kachel still
           einen dritten Schritt (Tailwind-Plugin + Token-Import) und löste ihn
           erst im Guide ein. `create` ist der Default, weil die Zeile die
           Geschichte „aus dem Nichts" erzählt; der Bestandsfall steht als
           Alternative darunter statt in einer zweiten Kachel. -->
      <div class="step step-ink" style:--ink-solid={CHANNELS.ink.solid}>
        <div class="step-body">
          <h2 class="step-title">Install</h2>
          <!-- Der Kopier-Knopf ist der eigene: die Seite listet zwanzig Zeilen
               weiter oben einen `CopyButton` und ließ die zwei Befehle, für die
               es ihn gibt, von Hand markieren. Der `aria-label` nennt den
               Befehl, sonst heißen beide Knöpfe gleich. -->
          {#each INSTALL_COMMANDS as command (command)}
            <div class="cmd cmd-copy">
              <code>{command}</code>
              <CopyButton
                value={command}
                size="sm"
                aria-label="Copy: {command}"
                slotClasses={{ base: '!text-current hover:!bg-current/15' }}
              />
            </div>
          {/each}
          <p class="step-line">
            From an empty folder to a themed app your agent can build in — the first command
            installs and wires Tailwind, the second brings the agent into the design loop.
          </p>
          <p class="step-alt">
            Existing SvelteKit app? <code>bunx sv add @urbicon-ui</code>
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
            >claude "a neon-magenta booking page for the hotel — room, dates, guests"</code
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
         Namens-Kachel und wie Schritt 01, dieselbe Signatur. Der Footer ist
         die VOLLSTÄNDIGE Liste der Türen nach draußen (Register, Repo,
         Maschinenlesbares, Rechtliches); die Kopfleiste darüber trägt nur die
         vier meistgebrauchten. „Ohne jedes Chrom" galt bis 2026-08-12 — beim
         Benutzen fehlte der direkte Sprung in die Docs, und die Suche gab es
         auf der Landing nur als unsichtbares Tastenkürzel. -->
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
        <!-- Wer hinter der Bibliothek steht: die Tür zurück zur Firmenseite.
             Extern wie GitHub, darum dieselbe Behandlung. -->
        <a href="https://urbicon.de" target="_blank" rel="noopener">Urbicon</a>
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
  {@const s = (item as Arrival).status}
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
  /* Name + Anspruch sitzen mittig über der Fußzeile — die Kachel ist eine
     Titelseite, keine Kopfzeile mit Anhang (Eyebrow: siehe LandingHeader). */
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
       genau die Bündigkeit, die die Striche zur Grundlinie des Namens bringt.
       Der aktive Strich wächst deshalb nach OBEN, ohne die Zeile zu verrücken. */
    vertical-align: baseline;
  }
  /* Nur die Striche der Namens-Kachel schalten — die der Fußzeile sind dieselbe
     Signatur, aber dort führt sie nirgendwohin (unter ihr endet die Seite). */
  button.tick {
    position: relative;
    border: 0;
    padding: 0;
    cursor: pointer;
    opacity: 0.5;
    transition:
      opacity 160ms ease,
      height 160ms ease;
  }
  button.tick:hover {
    opacity: 0.85;
  }
  button.tick.on {
    opacity: 1;
    height: 0.18em;
  }
  button.tick:focus-visible {
    outline: 2px solid #f4f4f2;
    outline-offset: 4px;
  }
  /* Ein 23 × 5 px großer Strich ist kein Ziel. Die Trefferfläche wächst über
     ein Pseudo-Element, damit sie das Layout der Signatur nicht anfasst. */
  button.tick::after {
    content: '';
    position: absolute;
    inset: -0.6em -0.06em;
  }
  @media (prefers-reduced-motion: reduce) {
    button.tick {
      transition: none;
    }
  }
  .claim {
    margin-top: 1.1rem;
    font-size: clamp(1.9rem, 3.4vw, 3.1rem);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.025em;
    /* Genau breit genug für „Zero dependencies." in einer Zeile — der Umbruch
       soll zwischen den beiden Sätzen liegen, nicht in einem von ihnen. */
    max-width: 17ch;
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
  /* Auf schmalen Schirmen ist die Bühne der knappe Faktor, nicht die
     Komposition: von 72vh Kachel bleiben der Karte nach Titelgruppe, Dots-Zone
     und Polstern ~415 px, in denen ein ganzes Backoffice oder ein Grid steht.
     Der Anschnitt der zweiten Zeile braucht weniger Luft als das Exponat. */
  @media (max-width: 40rem) {
    .tile {
      height: clamp(460px, 84vh, 760px);
    }
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
    --card-bg: light-dark(#ffffff, #141414);
    background: var(--card-bg);
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
  /* Innen scrollende Karten müssen zeigen, DASS es weitergeht. Auf Touch gibt
     es keine dauerhaft sichtbare Scrollleiste, also endete die Karte optisch
     mitten im Satz — sie sah abgeschnitten aus, nicht scrollbar. Der klassische
     background-attachment-Trick erledigt das deklarativ: zwei Deckflächen in
     Kartenfarbe hängen am Inhalt (`local`) und fahren mit ihm aus dem Bild,
     zwei Schatten darunter am Rahmen (`scroll`) bleiben stehen — an beiden
     Enden löscht die Deckfläche genau ihren Schatten. Kein JS und kein
     `animation-timeline: scroll()`, das iOS Safari noch nicht kennt. */
  .dash2 > .dash-body,
  .dash2 > .view-host,
  .card.card-table {
    --card-shade: light-dark(rgb(0 0 0 / 0.16), rgb(255 255 255 / 0.14));
    background:
      linear-gradient(var(--card-bg) 30%, transparent) center top / 100% 1.75rem no-repeat local,
      linear-gradient(transparent, var(--card-bg) 70%) center bottom / 100% 1.75rem no-repeat local,
      radial-gradient(farthest-side at 50% 0, var(--card-shade), transparent) center top / 100%
        0.6rem no-repeat scroll,
      radial-gradient(farthest-side at 50% 100%, var(--card-shade), transparent) center bottom /
        100% 0.6rem no-repeat scroll,
      var(--card-bg);
  }
  /* Kopf und Fuß stehen, der Inhalt dazwischen scrollt. Bis 2026-08-03 scrollte
     die ganze Karte — mit drei Ansichten unterschiedlicher Höhe hieß das, dass
     die Fußzeile (Toggle + Badge) je nach Ansicht unter die Kante rutschte.
     Ein Backoffice, dessen Bedienung wegscrollt, ist keins. */
  .dash2 {
    container-type: inline-size;
    width: min(520px, 100%);
    /* Feste Höhe, nicht nur eine Obergrenze: sonst schrumpft die Karte auf den
       Planner bzw. den Sankey zusammen und der Ansichtswechsel lässt Kopfzeile
       und SegmentGroup springen. */
    height: 100%;
    display: grid;
    /* Kopf · Geltungsbereich · Ansicht · Fußzeile. */
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: 0.9rem;
  }
  /* Die Chip-Zeile trennt sich mit einer Haarlinie vom Inhalt darunter — sie
     gehört zum Rahmen der Karte, nicht zur Ansicht. */
  .scope {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding-block-end: 0.5rem;
    border-block-end: 1px solid light-dark(rgb(0 0 0 / 0.08), rgb(255 255 255 / 0.1));
  }
  .chip {
    font: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    border-radius: var(--radius-commit);
    transition: opacity 120ms ease;
  }
  .chip[aria-pressed='false']:hover {
    opacity: 0.72;
  }
  .chip:focus-visible {
    outline: 2px solid var(--tile-solid);
    outline-offset: 2px;
  }
  .chip .blk {
    display: block;
  }
  .dash2 > .dash-body,
  .dash2 > .view-host {
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: thin;
  }
  /* Die Rooms-Ansicht scrollt NICHT als Bühne: 39 Spuren sind höher als jede
     Kachelbühne, und mit der Bühne fahren Datumsachse und Legende hinaus (nach
     600 px Scroll standen Balken über unbeschrifteten Spalten — Review-Befund
     2026-08-12). Stattdessen bekommt der Tagesstreifen der Komponente die
     Resthöhe und scrollt selbst; seine Kopfzeile klebt an seinem oberen Rand.
     Die Kette braucht auf jeder Ebene `min-height: 0`, sonst gibt der
     Flex-Kasten die Höhe seines Inhalts weiter statt sie zu begrenzen. */
  .rooms-host {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .rooms-host > .blk {
    min-height: 0;
    flex: 1;
    display: flex;
  }
  .rooms-host > .blk > :global(*) {
    min-height: 0;
    flex: 1;
  }
  .rooms-host :global(.rooms-track) {
    scrollbar-width: thin;
  }
  /* Enge Karte, engere Spalten — an der KARTE gemessen, nicht am Viewport: bei
     1024 px Viewport ist die Bühne 467 px breit, also so eng wie auf dem
     Telefon, bekam aber die weite Geometrie (Review-Befund). Dieselbe
     30rem-Schwelle, an der die Overview zweispaltig wird; der Wert steht in CSS,
     weil CSS die Breite kennt (vgl. #133). */
  @container (max-width: 30rem) {
    .rooms-host :global(.rooms-track) {
      --rt-lane-w: 4.5rem;
      --rt-day-w: 1.75rem;
    }
  }
  /* Die Namensschilder des Röntgenbilds sitzen über der Oberkante ihres
     Bauteils — im scrollenden Body würde das oberste abgeschnitten. Das Polster
     schafft ihm Platz, das negative Margin nimmt ihn dem Layout wieder ab,
     damit beim Umschalten nichts springt. Nur im Röntgenbild: ein dauerhaftes
     Polster ist ein Streifen, durch den Inhalt an der festgehefteten Kopfzeile
     des Planners vorbeiscrollt. */
  .dash2.xray > .dash-body,
  .dash2.xray > .view-host {
    padding-block-start: 0.7rem;
    margin-block-start: -0.7rem;
  }
  /* Der Chart liegt über der vollen Kartenbreite, die zwei Spalten darunter.
     Vorher stand er in der linken Spalte, die damit deutlich kürzer war als
     die rechte — das Loch unten links war die Differenz, nicht Absicht. */
  .dash-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
  }
  .dash-cols {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
    /* Die Spaltenzeile nimmt die Resthöhe des Bodys — erst damit greift das
       space-between in den Spalten. Ohne dieses Wachsen sammelte sich die
       Resthöhe als Loch zwischen Donut und Fußzeile (Screenshot-Befund
       2026-08-12). */
    flex: 1;
  }
  /* Einspaltig (schmale Karte) steht die Auslastung der Häuser VOR dem
     Umsatzmix: sie ist die Aussage der Kachel, und was hier unten steht,
     erreicht man nur durch Scrollen in der Karte. Zweispaltig hebt die
     Grid-Zuordnung das wieder auf. */
  .dash-side {
    order: -1;
  }
  .dash-main,
  .dash-side {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  @container (min-width: 30rem) {
    .dash-cols {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      /* Die eine Grid-Zeile spannt die volle Resthöhe auf — sonst bliebe das
         flex-Wachsen der Zeile ohne Wirkung auf die Spalten darin. */
      grid-template-rows: minmax(0, 1fr);
      gap: 1.6rem;
      align-items: stretch;
    }
    /* Was an Resthöhe bleibt, verteilt sich zwischen den Blöcken der kürzeren
       Spalte, statt sich unten zu einem Loch zu sammeln. */
    .dash-main,
    .dash-side {
      justify-content: space-between;
    }
    .dash-side {
      order: 0;
    }
  }
  @media (min-width: 78rem) {
    .dash2 {
      width: min(940px, 100%);
    }
  }
  .dash-donut {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  /* Farbpunkte für Donut-Textzeile und Rooms-Legende — dieselben Töne wie
     die Flächen, die sie erklären. Ein Paar aus Punkt und Wort bricht nie
     intern um (.mix-pair), sonst hängt ein Punkt allein am Zeilenende. */
  .mix-dot {
    display: inline-block;
    /* 10 px, nicht 8: die Punkte sind bedeutungstragende Grafik, und der
       Corner-Ton liegt im Hellmodus unter 3:1 — Größe ist der Hebel, der ohne
       Eingriff ins Token-System bleibt (Review-Befund 2026-08-12). */
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: 50%;
    margin-inline-end: 0.3rem;
  }
  .mix-pair {
    white-space: nowrap;
  }
  .mix-pair + .mix-pair {
    margin-inline-start: 0.55rem;
  }
  /* Kopfzeile der Rooms-Ansicht: Untertitel links, Legende rechts. */
  .legend-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem 1rem;
    flex-wrap: wrap;
  }
  /* Zeitraster und Sankey bekommen die Bühne der Karte allein — und füllen
     sie doppelt: der Host streckt sich (flex), und beide Bauteile rechnen ihre
     Pixelhöhe zusätzlich aus der gemessenen Host-Höhe (timeGridHourHeight
     bzw. height), denn ein gestrecktes Wrapper-Div macht ein fixes SVG oder
     Stundenraster nicht höher.
     Der Scroll-Container und das Bauteil sind absichtlich ZWEI Elemente: trug
     ein Element beide Rollen, schnitt es im Röntgenbild sein eigenes
     Namensschild ab — das sitzt über der Oberkante, und ein `overflow: auto`
     clippt dort. */
  .view-host {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .view-host > .blk {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* `1 0 auto`, nicht `1`: wachsen ja, schrumpfen nein. Ein deckelndes
     `height: 100%` (vorher als `!h-full` am Planner) machte den einspaltigen
     Fall unscrollbar — das gestapelte Wochenraster ragte sichtbar heraus, aber
     der Container sah keinen Überlauf, weil sein Kind exakt seine Höhe hatte.
     So bleibt das Bauteil mindestens so hoch wie sein Inhalt und der Container
     scrollt, sobald das mehr ist als die Bühne. */
  .view-host > .blk > :global(*) {
    flex: 1 0 auto;
  }
  .houses {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  /* Jede Auslastungszeile ist ein Schalter — Progress bleibt die Anzeige, der
     Button darum trägt Zustand, Fokusring und Trefferfläche. */
  .house {
    display: block;
    width: 100%;
    text-align: start;
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0.12rem 0.45rem;
    margin-inline: -0.45rem;
    border-radius: var(--radius-modify);
    cursor: pointer;
    transition: background-color 120ms ease;
  }
  .house:hover {
    background: light-dark(rgb(0 0 0 / 0.05), rgb(255 255 255 / 0.07));
  }
  .house.on {
    background: light-dark(rgb(0 0 0 / 0.09), rgb(255 255 255 / 0.12));
  }
  .house:focus-visible {
    outline: 2px solid var(--tile-solid);
    outline-offset: 1px;
  }
  .house .blk {
    display: block;
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
  /* Der KARTENKOPF (nicht der Kopf der Auslastungs-Spalte, der bleibt einzeilig):
     Titel und Bereichswahl teilen sich eine Zeile erst, wenn die Karte breit
     genug für beide ist. Darunter quetschte die Zeile beides gleichzeitig — der
     Titel brach zweizeilig um UND die SegmentGroup fiel in ihre
     Überlauf-Degradation (vertikaler Stapel, korrekt für ein Formular, im Kopf
     einer Karte aber wie ein Fehler aussehend). Gestapelt hat die Gruppe die
     131 px, die ihr Track waagerecht braucht. */
  .dash2 > .dash-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  @container (min-width: 24rem) {
    .dash2 > .dash-head {
      flex-direction: row;
      align-items: flex-start;
      gap: 1rem;
    }
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
    .hotel-host {
      width: min(620px, 100%);
    }
  }
  .card-table :global(thead th) {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--card-bg);
  }
  /* Das Hotel-Exponat füllt die Kachel-Bühne; die LiveryTile bringt ihren
     eigenen Grund (data-livery) und Rahmen mit. */
  .hotel-host {
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
  /* Gilt für die Tür der A2UI-Kachel (<a>) UND für den Röntgen-Schalter der
     Blocks-Kachel (<button>) — dieselbe Stelle, dieselbe Form. */
  .tile-link {
    flex-shrink: 0;
    font: inherit;
    font-weight: 700;
    font-size: 0.85rem;
    color: inherit;
    text-decoration: none;
    background: none;
    border: 0;
    border-bottom: 2px solid currentColor;
    padding-bottom: 2px;
    cursor: pointer;
  }

  /* ── Röntgenbild ─────────────────────────────────────────────────
     Die Kachel für „Umfang" zeigt auf Wunsch, woraus sie besteht: jedes
     Bauteil bekommt seinen Umriss und sein Namensschild. Kein zusätzliches
     Markup — die Namen stehen als `data-blk` schon dort, wo sie hingehören,
     und `::after` holt sie hervor. */
  .blk {
    position: relative;
  }
  .xray .blk {
    outline: 1px dashed color-mix(in oklch, var(--tile-solid) 65%, transparent);
    outline-offset: 3px;
  }
  /* Die Auslastungszeilen stehen dicht — im Röntgenbild säße das Namensschild
     der einen auf dem Balken der anderen. */
  .xray .houses {
    gap: 0.85rem;
  }
  .xray .blk::after {
    content: attr(data-blk);
    position: absolute;
    inset-block-start: -0.6rem;
    inset-inline-start: 0;
    z-index: 2;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    line-height: 1.5;
    padding-inline: 0.25rem;
    border-radius: 2px;
    background: var(--tile-solid);
    color: var(--tile-on);
    pointer-events: none;
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
     Die Zeile hat eine Grundhöhe, aber keine feste mehr: die VORSCHAU scrollt
     nicht, sie dehnt die Zeile.

     Warum: gemessen am 2026-08-04 lief die Vorschau bei der Hälfte der 99
     Zeilen über, die meisten nur um 60–200 px. Ein Scroll-Container, der ein
     bis zwei Radrasten schluckt, wird nicht als eigener Bereich gelesen — er
     fühlt sich an, als hinge die Seite (Chrome hält vor dem Weiterreichen an
     den Seiten-Scroll an). Also `min-height` statt `height`.

     Was das für die Höhe kostet, über alle 99 Zeilen bei 1440 × 813 gemessen:
     54 lassen die Zeile bei ihrer Grundhöhe, 36 dehnen sie um weniger als
     150 px (ein Sechstel Bildschirm — beim Umschalten kaum zu sehen), 9 mehr;
     am weitesten AccountSettings (1309 px) und Calendar (1229). Bei zehn
     Komponenten wird die Zeile damit höher als der Bildschirm — für die
     scrollt dann aber die SEITE, was hier der ganze Punkt ist. Die
     naheliegende Alternative, die Zeile auf die höchste Vorschau zu stellen,
     hätte den anderen 89 Zeilen 400–650 px Leerraum gegeben.

     Die Inventarspalte BLEIBT ein Scroll-Container: 99 Zeilen unter einem
     Filterfeld liest jeder als Liste, und sie schluckt 2700 px, nicht 60.
     Sie klebt, damit sie im Bild bleibt, wenn die Vorschau die Zeile über
     ihre Grundhöhe hinauszieht. */
  .row2 {
    --row2-pad: clamp(16px, 2vw, 32px);
    --row2-base: clamp(560px, 82vh, 860px);
    min-height: var(--row2-base);
    display: grid;
    grid-template-columns: clamp(26rem, 36vw, 34rem) minmax(0, 1fr);
    gap: clamp(1.5rem, 4vw, 4rem);
    padding: var(--row2-pad);
    /* Ohne dies streckt das Grid beide Spalten auf die Zeilenhöhe — die
       gewachsene Zeile zöge dann die klebende Liste mit in die Länge. */
    align-items: start;
  }
  @media (max-width: 48rem) {
    .row2 {
      grid-template-columns: 1fr;
    }
  }

  .inv-col {
    display: flex;
    flex-direction: column;
    /* Die Liste ist auf die Grundhöhe der Zeile begrenzt, nicht auf den
       Viewport: sonst gäbe SIE der Zeile die Höhe und machte sie doch wieder
       bildschirmfüllend — genau das, was die Zeile nicht sein will. */
    max-height: calc(var(--row2-base) - 2 * var(--row2-pad));
    position: sticky;
    top: var(--row2-pad);
    min-height: 0;
    gap: 0.5rem;
  }
  /* Einspaltig gestapelt gibt es nichts, woran die Liste kleben könnte —
     sie stünde sonst über der Vorschau fest, die unter ihr durchläuft. */
  @media (max-width: 48rem) {
    .inv-col {
      position: static;
      max-height: none;
    }
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
  /* Nur die Deckung, NICHT das Pinning: das gehört der Table (`sticky="header"`
     am Aufruf). Vorher stand hier ein eigenes `position: sticky` auf den `th`
     — und es griff nie, weil TableDesktop einen `overflow-x-auto`-Wrapper
     zwischen Tabelle und `.inventory` legt, der zum Scroll-Vorfahren wird.
     Genau diesen Konflikt kennt die Komponente: mit `sticky` lässt sie den
     Wrapper weg. Der Kopf trägt dann `bg-surface-elevated`; hier ist der Grund
     Papier. */
  .inventory :global(thead th) {
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
  /* Der Kasten mit Kopier-Knopf: der Befehl nimmt den Platz, den er braucht,
     der Knopf steht rechts daran. `width: fit-content` von `.cmd` bleibt, die
     zwei Kästen sind also weiter unterschiedlich breit — sie auf eine Breite
     zu ziehen machte aus zwei Befehlen einen Block.

     Der lange Befehl wird dadurch zweizeilig, und das ist Absicht statt
     Versehen. Nachgerechnet bei 1440 px Fensterbreite: der Befehl misst
     327.6 px, der Kasten polstert 19.2, Fuge 9.6, Knopf 30.3 — Bedarf 386.7
     gegen 369 px Spaltenbreite. Es fehlen 18 px, und ohne Knopf lagen nur
     22 px Luft im Kasten. Die 18 px wären aus Fuge, Polsterung und
     Schriftgrad zusammenzukratzen; das hielte genau bei DIESER Breite und
     risse bei 1280 wieder, wo die Spalte nur 330 px hat — eine Scheinlösung
     für eine Fenstergröße. Also bricht der Befehl, der Kasten hält ihn
     zusammen, und der Umbruch sitzt vor `@urbicon-ui`.

     Der Knopf ist quadratisch statt in Button-Textbreite (39 px): ein
     Icon-Knopf braucht keine Polsterung für Text. Das Maß steht hier und
     nicht in `slotClasses` — es ist eine Aussage über diese Spalte, keine
     über den Knopf.

     Die negativen Ränder halten die Kastenhöhe bei der des Befehls; ohne sie
     schiebt der Knopf sie um seine eigene Höhe auf. */
  .cmd-copy {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding-block: 0.2rem;
    padding-inline-end: 0.3rem;
  }
  .cmd-copy :global(button) {
    inline-size: 2rem;
    padding-inline: 0;
    margin-block: -0.35rem;
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
  /* Der Bestandsprojekt-Fall — bewusst KEIN `.cmd`-Kasten: als dritte
     Befehlszeile gelesen wäre er ein dritter Schritt statt einer Abzweigung.
     Also Fußnoten-Gewicht, mit dem Befehl selbst im Mono der Kästen. */
  .step-alt {
    margin-top: 0.9rem;
    font-size: 0.78rem;
    opacity: 0.6;
    max-width: 40ch;
  }
  .step-alt code {
    font-family: 'JetBrains Mono', monospace;
    /* Der Befehl bricht als Ganzes in die nächste Zeile statt mitten im
       Paketnamen — ein halber Befehl liest sich wie ein Tippfehler. */
    white-space: nowrap;
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
