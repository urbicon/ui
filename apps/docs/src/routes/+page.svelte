<!--
  Die Landing — "3-Zeilen-Journey": erinnern → staunen → erforschen → handeln.
  Zeile 1: Namens-Kachel + Scroller mit fünf Kanal-Kacheln (Cusp-Palette,
  light-dark()-Paare); die ersten vier Kacheln teilen das Salon-Universum
  "Bleecker & Bond" ($lib/salon-tools) — seit 2026-07-31 als GRUPPE erzählt:
  vier Häuser (Bleecker/New York, Bond/London, Turenne/Paris, Neubau/Wien),
  damit Dashboard und Grid Betriebs-Maßstab zeigen statt Terminzettel-Idylle.
  Jede Kachel scopet die primary-Familie
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
<!-- urbicon-ignore important-modifier — the `!` modifiers are all slot overrides
     (PLAYGROUND_SLOTS and the Scroller control map): a slotClasses string and the
     component's own tv() defaults land on the same element, so without `!` the
     winner depends on stylesheet order rather than on intent. Counted 2026-08:
     35 of 35 sit inside a slotClasses map, none loose in a class attribute.

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
  import type { CalendarEvent } from '@urbicon-ui/blocks';
  import {
    buildSchedule,
    SCHEDULE_END_HOUR,
    SCHEDULE_START_HOUR,
    SERVICE_CATEGORIES
  } from '$lib/landing/schedule';
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
    Calendar,
    type CartesianDatum,
    type ChartSeries,
    CompositionBar,
    type CompositionItem,
    DonutChart,
    Input,
    Progress,
    Sankey,
    Scroller,
    SegmentGroup,
    SegmentItem,
    ThemeSwitcher,
    Toggle
  } from '@urbicon-ui/blocks';
  import { I18nProvider } from '@urbicon-ui/i18n';
  import { MediaQuery } from 'svelte/reactivity';
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
  //    Salon-GRUPPE „Bleecker & Bond" — vier Häuser: Bleecker (New York),
  //    Bond (London), Turenne (Paris), Neubau (Wien). Entscheidung
  //    2026-07-30: kohärente Fiktion statt strenger Selbstreferenz;
  //    2026-07-31: die Gruppe statt des Einzel-Salons, damit die Kacheln
  //    unter „Enterprise grid" keine Spielzeugdaten tragen. Maßstabs-Schnitt:
  //    Dashboard + Grid zeigen die GRUPPE; das Tool (`get_salon_info`), das
  //    aufgezeichnete Gespräch und die /salon-Vollseite bleiben das Stammhaus
  //    in der Bleecker Street — die Aufnahme ist eine Konserve und darf
  //    nicht von ihrer Datenbasis driften (Services/Slot-Zeiten weiter aus
  //    $lib/salon-tools; die Teams der drei anderen Häuser erweitern nur die
  //    Fiktion, das Tool kennt sie nicht).

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
  // Die Zahlen der drei Ansichten sind EINE Wahrheit: die Wochensummen des
  // Charts (47/55/51/66/72) sind die „+N more"-Zahlen des Planners, der Donut
  // (412 guests) ist die Gesamtsumme des Sankey-Flusses, und der Umsatzmix
  // (52/24/17/7 %) ist dessen letzte Ebene. Wer nachrechnet, findet keinen
  // Widerspruch — das ist der Sinn EINES Universums.
  type DashView = 'overview' | 'schedule' | 'flow';
  let dashView = $state<DashView>('overview');
  let walkIns = $state(true);
  /** Gewähltes Haus (Klick auf eine Auslastungszeile) — `null` = die Gruppe. */
  let house = $state<string | null>(null);
  /** Röntgenbild: zeigt, aus welchen Bauteilen die Fläche besteht. */
  let xray = $state(false);

  interface House {
    name: string;
    city: string;
    /** Auslastung in Prozent. */
    load: number;
    /** Gäste diese Woche. */
    guests: number;
    /** …davon Wiederkehrer. */
    returning: number;
    /** Umsatzmix des Hauses in Prozent — Paris färbt mehr, New York schneidet. */
    mix: [number, number, number, number];
    team: AvatarProps[];
  }
  // Auslastung je HAUS, nicht je Stuhl — die Gruppen-Sicht ist der Punkt der
  // Kachel; die Stuhl-Sicht gehört dem einzelnen Front desk (/salon).
  // Die Cutter des Stammhauses (Io/Sable/Ren) sind die des Tools; die der drei
  // anderen Häuser sind Fiktions-Erweiterung, `get_salon_info` kennt sie nicht.
  // Dieselben Vornamen wie in der Buchungsliste der Table-Kachel.
  const HOUSES: House[] = [
    {
      name: 'Bleecker',
      city: 'New York',
      load: 82,
      guests: 124,
      returning: 88,
      mix: [58, 22, 15, 5],
      team: [
        { name: 'Io Nakamura', status: 'online' },
        { name: 'Sable Adeyemi', status: 'online' },
        { name: 'Ren Duval', status: 'busy' }
      ]
    },
    {
      name: 'Bond',
      city: 'London',
      load: 64,
      guests: 108,
      returning: 76,
      mix: [51, 26, 18, 5],
      team: [
        { name: 'Fen Whitlock', status: 'online' },
        { name: 'Alba Ferrán' },
        { name: 'Noor Haddad', status: 'busy' }
      ]
    },
    {
      name: 'Turenne',
      city: 'Paris',
      load: 47,
      guests: 88,
      returning: 58,
      mix: [44, 22, 16, 18],
      team: [{ name: 'Odile Brassard', status: 'online' }, { name: 'Marius Lenoir' }]
    },
    {
      name: 'Neubau',
      city: 'Vienna',
      load: 71,
      guests: 92,
      returning: 62,
      mix: [55, 25, 15, 5],
      team: [{ name: 'Willa Berger' }, { name: 'Emil Radler', status: 'busy' }]
    }
  ];
  const GROUP_GUESTS = HOUSES.reduce((n, h) => n + h.guests, 0); // 412
  /** Die Chip-Zeile über den Ansichten: die Gruppe plus je ein Haus. */
  const SCOPES: { key: string | null; label: string }[] = [
    { key: null, label: 'All' },
    ...HOUSES.map((h) => ({ key: h.name, label: h.name }))
  ];
  const activeHouse = $derived(HOUSES.find((h) => h.name === house) ?? null);
  /** Anteil des gewählten Hauses an der Gruppe — skaliert Chart und Zahlen. */
  const share = $derived(activeHouse ? activeHouse.guests / GROUP_GUESTS : 1);

  // Buchungen je Wochentag, Gruppe. Mon/Sun fehlen, weil die Häuser dann
  // geschlossen sind — der Planner sagt das eine Ansicht weiter ausdrücklich.
  const WEEK_BOOKINGS: CartesianDatum[] = [
    { label: 'Tue', values: [38, 9] },
    { label: 'Wed', values: [43, 12] },
    { label: 'Thu', values: [35, 16] },
    { label: 'Fri', values: [52, 14] },
    { label: 'Sat', values: [61, 11] }
  ];
  // Der Toggle ist keine Deko: ohne Walk-ins verschwindet die zweite Serie aus
  // Chart UND Legende, und der Badge in der Fußzeile sagt etwas anderes.
  const BOOKING_SERIES: ChartSeries[] = $derived(
    walkIns ? [{ label: 'Booked' }, { label: 'Walk-in' }] : [{ label: 'Booked' }]
  );
  const bookingsData = $derived(
    WEEK_BOOKINGS.map((d) => ({
      label: d.label,
      values: (walkIns ? d.values : d.values.slice(0, 1)).map((v) => Math.round(v * share))
    }))
  );
  const MIX_LABELS = ['Bleecker Cut', 'Dry Cut', 'Beard', 'Colour'] as const;
  const MIX_INTENTS = ['primary', 'success', 'warning', 'neutral'] as const;
  const GROUP_MIX: [number, number, number, number] = [52, 24, 17, 7];
  const revenueMix: CompositionItem[] = $derived(
    (activeHouse?.mix ?? GROUP_MIX).map((value, i) => ({
      label: MIX_LABELS[i],
      value,
      intent: MIX_INTENTS[i]
    }))
  );
  const team = $derived(activeHouse ? activeHouse.team : HOUSES.flatMap((h) => h.team));
  // Gästezahlen, keine Prozente: der Donut summiert seine Werte zur Mitte.
  // Auf Gruppen-Maßstab (412 guests) liest die Mitte auch nicht mehr
  // versehentlich als „100 %", wie es die alte 68/32-Summe tat.
  const returnMix = $derived([
    { label: 'Returning', value: activeHouse?.returning ?? 284 },
    {
      label: 'First visit',
      value: (activeHouse?.guests ?? GROUP_GUESTS) - (activeHouse?.returning ?? 284)
    }
  ]);
  const freeChairs = $derived(
    activeHouse ? Math.max(1, Math.round((100 - activeHouse.load) / 9)) : 9
  );

  // ── Schedule: die Terminwoche EINES Hauses im Calendar ─────────────
  // Der Calendar ist datumsindiziert, die Seite ist prerendered: ein
  // `new Date()` im Initialwert stünde als Build-Woche im HTML und würde beim
  // Hydrieren gegen die echte Woche laufen. Also SSR-stabil mit einem festen
  // Anker starten und erst NACH der Hydration auf die laufende Woche schwenken
  // — ein normales Update, kein Mismatch.
  const WEEK_ANCHOR = new Date(2026, 7, 3); // Montag, 2026-08-03
  let weekStart = $state(WEEK_ANCHOR);
  $effect(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    weekStart = monday;
  });
  // Buchungen der GRUPPE je Wochentag (Index 0 = Montag) — dieselben Summen,
  // die der Chart der Overview zeichnet. Mo und So fehlen, weil die Häuser dann
  // geschlossen sind.
  const GROUP_DAY_TOTALS = [0, 47, 55, 51, 66, 72, 0];
  // Ein Zeitraster zeigt Stühle, keine Gruppen: vier Häuser übereinander wären
  // Tapete. Die Ansicht zeigt darum EIN Haus — das gewählte, sonst das
  // Stammhaus — und die Kopfzeile sagt es. Der Umschalter dafür steht schon
  // da: die Auslastungszeilen der Overview.
  const scheduleHouse = $derived(activeHouse ?? HOUSES[0]);
  const scheduleEvents = $derived(
    buildSchedule({
      weekStart,
      // Zwei Stühle im Dienst — die Vornamen, die auch in der Buchungsliste
      // der Table-Kachel stehen. Nicht das ganze Team: drei parallele Spalten
      // je Tag lassen von einem Terminblock 70 px Breite übrig, in denen kein
      // Name mehr steht. Zwei ist auch die ehrlichere Fiktion — ein Salon hat
      // selten alle Stühle gleichzeitig besetzt. Wer wirklich alle sehen will,
      // findet das Team eine Ansicht weiter in der AvatarGroup.
      chairs: scheduleHouse.team.slice(0, 2).map((m) => String(m.name ?? '').split(' ')[0]),
      // Der Anteil des Hauses an den Tagessummen der Gruppe. Dass der Samstag
      // im Raster sichtbar voller ist als der Dienstag, ist keine Deko: es ist
      // dieselbe Kurve, die der Chart eine Ansicht weiter zeichnet.
      perDay: GROUP_DAY_TOTALS.map((n) => Math.round(n * (scheduleHouse.guests / GROUP_GUESTS)))
    })
  );
  // Das Zeitraster der Wochenansicht degradiert nicht: sieben Spalten bleiben
  // sieben Spalten, auch auf 390 px, und ein Terminblock ist dort 25 px breit
  // mit senkrecht stehendem Namen. (Der Planner kann das — sein Wochenraster
  // stapelt unter `md`.) Schmal zeigt die Kachel darum die Agenda: dieselben
  // Termine als Liste, die Form, die ein Telefon ohnehin verlangt.
  const wideEnoughForWeek = new MediaQuery('(min-width: 48rem)', true);
  const scheduleView = $derived(wideEnoughForWeek.current ? 'week' : 'agenda');
  // Fest auf `en-GB`, nicht auf die Laufzeit-Locale: die Seite ist auf `en`
  // gepinnt, und ein 24-Stunden-Format neben einem 24-Stunden-Zeitraster ist
  // das, was zusammenpasst.
  const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

  // Die Unterzeile der Karte. In der Schedule-Ansicht nennt sie IMMER ein Haus,
  // auch wenn keins gewählt ist — sonst verspräche „All four houses" über einem
  // Zeitraster, das nur eines zeigt.
  const cardSubtitle = $derived(
    dashView === 'schedule'
      ? `${scheduleHouse.name} · ${scheduleHouse.city}`
      : activeHouse
        ? `${activeHouse.name} · ${activeHouse.city}`
        : 'All four houses'
  );

  // ── Flow: woher die 412 Gäste kommen und wo sie landen ─────────────
  // Drei Ebenen, und jede Ebene summiert sich auf dieselben 412 wie der Donut;
  // die letzte Ebene trägt die Prozente des Umsatzmixes (52/24/17/7).
  const FLOW_NODES = [
    { id: 'online', label: 'Online', intent: 'primary' as const },
    { id: 'walkin', label: 'Walk-in', intent: 'warning' as const },
    { id: 'phone', label: 'Phone', intent: 'neutral' as const },
    ...HOUSES.map((h) => ({
      id: h.name.toLowerCase(),
      label: h.name,
      intent: 'secondary' as const
    })),
    { id: 'cut', label: 'Bleecker Cut', intent: 'primary' as const },
    { id: 'dry', label: 'Dry Cut', intent: 'success' as const },
    { id: 'beard', label: 'Beard', intent: 'warning' as const },
    { id: 'colour', label: 'Colour', intent: 'neutral' as const }
  ];
  const FLOW_LINKS = [
    { source: 'online', target: 'bleecker', value: 66 },
    { source: 'online', target: 'bond', value: 56 },
    { source: 'online', target: 'turenne', value: 44 },
    { source: 'online', target: 'neubau', value: 44 },
    { source: 'walkin', target: 'bleecker', value: 36 },
    { source: 'walkin', target: 'bond', value: 30 },
    { source: 'walkin', target: 'turenne', value: 26 },
    { source: 'walkin', target: 'neubau', value: 26 },
    { source: 'phone', target: 'bleecker', value: 22 },
    { source: 'phone', target: 'bond', value: 22 },
    { source: 'phone', target: 'turenne', value: 18 },
    { source: 'phone', target: 'neubau', value: 22 },
    { source: 'bleecker', target: 'cut', value: 64 },
    { source: 'bleecker', target: 'dry', value: 30 },
    { source: 'bleecker', target: 'beard', value: 21 },
    { source: 'bleecker', target: 'colour', value: 9 },
    { source: 'bond', target: 'cut', value: 56 },
    { source: 'bond', target: 'dry', value: 26 },
    { source: 'bond', target: 'beard', value: 18 },
    { source: 'bond', target: 'colour', value: 8 },
    { source: 'turenne', target: 'cut', value: 46 },
    { source: 'turenne', target: 'dry', value: 21 },
    { source: 'turenne', target: 'beard', value: 15 },
    { source: 'turenne', target: 'colour', value: 6 },
    { source: 'neubau', target: 'cut', value: 48 },
    { source: 'neubau', target: 'dry', value: 22 },
    { source: 'neubau', target: 'beard', value: 16 },
    { source: 'neubau', target: 'colour', value: 6 }
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

  // ── Table: die heutige Buchungsliste der GRUPPE, gruppiert nach Haus ──
  // Zeiten aus dem SLOT_GRID, Services/Preise aus salon-tools. Die Cutter des
  // Stammhauses (Io/Sable/Ren) sind die des Tools; die der drei anderen
  // Häuser sind Fiktions-Erweiterung — `get_salon_info` kennt sie nicht,
  // und die Aufnahme (booking-fixture) bleibt davon unberührt.
  interface Booking {
    id: string;
    house: 'Bleecker' | 'Bond' | 'Turenne' | 'Neubau';
    time: string;
    client: string;
    service: string;
    stylist: string;
    status: 'confirmed' | 'pending' | 'walk-in';
    /** Zahl, nicht "$95": Suche, Sortierung UND Summe rechnen auf dem
        Accessor-Wert. Das Währungszeichen ist Anzeige — `formatter`. */
    price: number;
  }
  // Je Haus chronologisch — die Gruppenreihenfolge ist die Array-Reihenfolge.
  const BOOKINGS: Booking[] = [
    {
      id: 'b1',
      house: 'Bleecker',
      time: '09:45',
      client: 'M. Okafor',
      service: 'The Bleecker Cut',
      stylist: 'Io',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b2',
      house: 'Bleecker',
      time: '10:30',
      client: 'J. Laurent',
      service: 'Beard Architecture',
      stylist: 'Sable',
      status: 'confirmed',
      price: 55
    },
    {
      id: 'b3',
      house: 'Bleecker',
      time: '13:00',
      client: 'A. Reyes',
      service: 'Dry Cut & Finish',
      stylist: 'Ren',
      status: 'walk-in',
      price: 70
    },
    {
      id: 'b4',
      house: 'Bleecker',
      time: '15:15',
      client: 'T. Nguyen',
      service: 'Colour Consultation',
      stylist: 'Io',
      status: 'pending',
      price: 0
    },
    {
      id: 'b5',
      house: 'Bleecker',
      time: '16:00',
      client: 'E. Sato',
      service: 'The Bleecker Cut',
      stylist: 'Ren',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b6',
      house: 'Bond',
      time: '09:00',
      client: 'P. Whitfield',
      service: 'The Bleecker Cut',
      stylist: 'Fen',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b7',
      house: 'Bond',
      time: '10:30',
      client: 'G. Halloran',
      service: 'Dry Cut & Finish',
      stylist: 'Alba',
      status: 'confirmed',
      price: 70
    },
    {
      id: 'b8',
      house: 'Bond',
      time: '11:15',
      client: 'S. Duran',
      service: 'Beard Architecture',
      stylist: 'Noor',
      status: 'pending',
      price: 55
    },
    {
      id: 'b9',
      house: 'Bond',
      time: '13:45',
      client: 'R. Lindqvist',
      service: 'The Bleecker Cut',
      stylist: 'Fen',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b10',
      house: 'Bond',
      time: '15:15',
      client: 'K. Marsh',
      service: 'Dry Cut & Finish',
      stylist: 'Alba',
      status: 'walk-in',
      price: 70
    },
    {
      id: 'b11',
      house: 'Turenne',
      time: '09:45',
      client: 'N. Petit',
      service: 'The Bleecker Cut',
      stylist: 'Odile',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b12',
      house: 'Turenne',
      time: '11:15',
      client: 'L. Beaumont',
      service: 'Colour Consultation',
      stylist: 'Marius',
      status: 'pending',
      price: 0
    },
    {
      id: 'b13',
      house: 'Turenne',
      time: '13:00',
      client: 'Y. Tanaka',
      service: 'Dry Cut & Finish',
      stylist: 'Odile',
      status: 'confirmed',
      price: 70
    },
    {
      id: 'b14',
      house: 'Turenne',
      time: '14:30',
      client: 'F. Abadi',
      service: 'Beard Architecture',
      stylist: 'Marius',
      status: 'confirmed',
      price: 55
    },
    {
      id: 'b15',
      house: 'Turenne',
      time: '16:00',
      client: 'C. Waweru',
      service: 'The Bleecker Cut',
      stylist: 'Odile',
      status: 'walk-in',
      price: 95
    },
    {
      id: 'b16',
      house: 'Neubau',
      time: '09:00',
      client: 'H. Sørensen',
      service: 'Dry Cut & Finish',
      stylist: 'Willa',
      status: 'confirmed',
      price: 70
    },
    {
      id: 'b17',
      house: 'Neubau',
      time: '10:30',
      client: 'A. Beck',
      service: 'The Bleecker Cut',
      stylist: 'Emil',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b18',
      house: 'Neubau',
      time: '13:45',
      client: 'T. Csorba',
      service: 'Beard Architecture',
      stylist: 'Willa',
      status: 'pending',
      price: 55
    },
    {
      id: 'b19',
      house: 'Neubau',
      time: '15:15',
      client: 'J. Kovács',
      service: 'The Bleecker Cut',
      stylist: 'Emil',
      status: 'confirmed',
      price: 95
    },
    {
      id: 'b20',
      house: 'Neubau',
      time: '16:00',
      client: 'O. Adebayo',
      service: 'Dry Cut & Finish',
      stylist: 'Willa',
      status: 'confirmed',
      price: 70
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

  // Die Fußzeile der Namens-Kachel. Bis 2026-08-03 stand hier
  // „one package · one grammar · one gate". Die Dreizahl war nicht das Problem,
  // die dreifache Anapher war es: `one … one … one …` ist die Figur einer
  // deutschen Parole, und gesperrte Mono-Versalie auf Ink liefert die Optik
  // dazu. Der Satz sagt jetzt dasselbe (alles darin wurde darin gemacht) ohne
  // die Figur — und er ist die These der Seite, nicht ihre Aufzählung.
  const PROOF = 'Everything in it was made in it.';

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
          <h1 class="brand" aria-label="urbicon ui">
            urbicon <span class="brand-suffix">ui</span><span
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
          <p class="claim">Zero dependencies. <strong>No drift.</strong></p>
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
                        <p class="dash-title">Bleecker &amp; Bond</p>
                        <p class="dash-sub">{cardSubtitle}</p>
                      </div>
                      <div class="blk" data-blk="SegmentGroup">
                        <SegmentGroup bind:value={dashView} size="sm" ariaLabel="Backoffice view">
                          <SegmentItem value="overview">Overview</SegmentItem>
                          <SegmentItem value="schedule">Schedule</SegmentItem>
                          <SegmentItem value="flow">Flow</SegmentItem>
                        </SegmentGroup>
                      </div>
                    </div>
                    <!-- Der Geltungsbereich steht ÜBER den Ansichten, weil er
                         auf alle drei wirkt. Bis 2026-08-03 war er nur eine
                         Auslastungszeile im Körper der Overview — also eine
                         Ebene unter dem, worauf er wirkt, und ausgerechnet in
                         der Schedule-Ansicht unerreichbar, die per Bauart eine
                         Ein-Haus-Ansicht ist. Die Zeilen bleiben zusätzlich
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
                        <!-- Der Chart nimmt die volle Kartenbreite: darunter
                             tragen zwei Spalten ähnlich viel Höhe, statt dass
                             die kürzere (früher links) unten ein Loch lässt. -->
                        <div class="blk" data-blk="AreaChart">
                          <AreaChart
                            data={bookingsData}
                            series={BOOKING_SERIES}
                            height={88}
                            showLegend={false}
                            fillOpacity={0.25}
                          />
                        </div>
                        <div class="dash-cols">
                          <div class="dash-main">
                            <!-- Die Werte SIND Prozente: formatValue macht sie zur
                               Anzeige, showPercentages bliebe sonst als Doppelung
                               daneben stehen (Legende druckt Wert immer). -->
                            <div class="blk" data-blk="CompositionBar">
                              <CompositionBar
                                items={revenueMix}
                                size="sm"
                                showLegend
                                showPercentages={false}
                                formatValue={(v) => `${v} %`}
                                legendPlacement="bottom"
                              />
                            </div>
                            <div class="dash-donut">
                              <div class="blk" data-blk="DonutChart">
                                <DonutChart
                                  data={returnMix}
                                  size={66}
                                  showLegend={false}
                                  showTotal
                                  totalLabel="guests"
                                  ariaLabel="Returning guests this week"
                                />
                              </div>
                              <p class="aside-note">
                                <strong>{returnMix[0].value}</strong> of them had been in before.
                              </p>
                            </div>
                          </div>
                          <div class="dash-side">
                            <div class="dash-head">
                              <p class="dash-sub">
                                {activeHouse ? 'On the floor' : 'Houses today'}
                              </p>
                              <!-- Die Gesichter sind nicht mehr Deko: sie zeigen
                                   das Team des gewählten Hauses und wechseln mit
                                   ihm. -->
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
                    {:else if dashView === 'schedule'}
                      <!-- Die Belegung eines Hauses auf dem Zeitraster: wo die
                           Blöcke dicht liegen, ist voll — die Ansicht ZEIGT die
                           Auslastung, die die Overview daneben in Prozent
                           behauptet. Mon/Sun bleiben leer, weil die Häuser dann
                           geschlossen sind; das erklärt, warum der Chart bei
                           Tue anfängt.
                           `{#key}`, weil `defaultDate` laut Vertrag nur beim
                           Mounten gelesen wird — der Schwenk von der Anker- auf
                           die laufende Woche nach der Hydration käme sonst nie
                           an. Kein Wischen: die Kachel liegt in einem
                           waagerecht wischbaren Band, und dort muss die Geste
                           die Kachel wechseln, nicht die Woche. -->
                      <div class="view-host">
                        <div class="blk" data-blk="Calendar">
                          {#key `${weekStart.getTime()}-${scheduleView}`}
                            <Calendar
                              events={scheduleEvents}
                              categories={SERVICE_CATEGORIES}
                              view={scheduleView}
                              views={[scheduleView]}
                              agendaDays={7}
                              showViewSwitcher={false}
                              defaultDate={weekStart}
                              size="sm"
                              showTimeGrid
                              timeGridStartHour={SCHEDULE_START_HOUR}
                              timeGridEndHour={SCHEDULE_END_HOUR}
                              timeGridInterval={60}
                              showEventList={false}
                              swipeable={false}
                              showLegend={false}
                              slotClasses={{
                                // Einspaltig scrollt die Woche durch die Karte —
                                // ohne das Festheften wäre nach zwei Tagen nicht
                                // mehr zu sehen, um welche Woche es geht.
                                // `--z-docked` ist die Stufe für genau das:
                                // festgeheftet INNERHALB eines Behälters (so
                                // nutzt JourneyTimeline sie auch). Das
                                // Namensschild des Röntgenmodus liegt bei
                                // `z-index: 2`, aber auf −0.6rem, also über der
                                // Blockkante — die beiden überlappen nicht.
                                header: 'sticky top-0 z-[var(--z-docked)] bg-[var(--card-bg)]'
                              }}
                              eventItem={agendaItem}
                            />
                          {/key}
                        </div>
                      </div>
                    {:else}
                      <!-- Dieselben 412 Gäste wie im Donut, nur von der Seite
                           gesehen: Kanal → Haus → Leistung. Die letzte Ebene
                           trägt die Prozente des Umsatzmixes. -->
                      <div class="view-host">
                        <div class="blk" data-blk="Sankey">
                          <Sankey
                            nodes={flowNodes}
                            links={flowLinks}
                            height={292}
                            nodeWidth={12}
                            nodePadding={10}
                            formatValue={(v) => `${v} guests`}
                          />
                        </div>
                      </div>
                    {/if}
                    <div class="dash-foot">
                      <div class="blk" data-blk="Toggle">
                        <Toggle bind:checked={walkIns} label="Accept walk-ins" size="sm" />
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
                          intent={walkIns ? 'success' : 'neutral'}
                          variant="soft"
                          tier="modify"
                        >
                          {walkIns ? `${freeChairs} chairs free` : 'By appointment only'}
                        </Badge>
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
                      initialGroupBy="house"
                      variant="flush"
                      size="sm"
                      ariaLabel="Today's bookings across the four houses of Bleecker & Bond"
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
                {:else if tile.key === 'blocks'}
                  <!-- Der Schalter steht AUF der Kachel, nicht in der Karte: er
                       spricht über die Fläche, nicht im Salon. Innerhalb der
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
          <code class="cmd">bunx sv create my-app --add @urbicon-ui</code>
          <code class="cmd">bunx urbicon init --hook</code>
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

<!-- Der Eintrag der Agenda-Ansicht (schmale Viewports). Eigener Snippet, weil
     der eingebaute Eintrag Titel, Beschreibung und Hilfstext rendert — aber
     nie die Uhrzeit, auch bei `allDay: false` nicht. Eine Terminliste ohne
     Uhrzeit ist keine. Das Zeitraster der Wochenansicht ist davon unberührt:
     dort steht der Block an seiner Uhrzeit, eine zweite wäre Doppelung. -->
{#snippet agendaItem({ event, category }: { event: CalendarEvent; category?: { color: string } })}
  <span class="agenda-row">
    <span class="agenda-bar" style:background={category?.color ?? 'var(--color-border-default)'}
    ></span>
    <span class="agenda-time">{TIME_FMT.format(event.start)}</span>
    <span class="agenda-who">{event.title}</span>
    <span class="agenda-chair">{event.description}</span>
  </span>
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
  /* Planner und Sankey bekommen die Bühne der Karte allein — und füllen sie:
     ohne das Strecken stünde ein Wochenraster mit drei Terminen je Spalte oben
     im Kasten und ließe darunter ein halbes Kartenfeld leer.
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

  /* Eintrag der Agenda-Ansicht: Farbstreifen, Uhrzeit, Gast, Stuhl — eine
     Zeile, weil das Telefon keine zwei hergibt. Der Snippet ersetzt den
     GANZEN Eintrag (nicht nur seinen Inhalt), also kommt auch das Layout von
     hier; statt eines Kastens je Termin trennt eine Haarlinie. */
  .agenda-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding-block: 0.45rem;
    border-block-end: 1px solid light-dark(rgb(0 0 0 / 0.07), rgb(255 255 255 / 0.09));
  }
  .agenda-bar {
    width: 3px;
    align-self: stretch;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .agenda-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  .agenda-who {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
  }
  .agenda-chair {
    margin-inline-start: auto;
    flex-shrink: 0;
    font-size: 0.75rem;
    color: light-dark(#77776f, #8a8a84);
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
    .salon-host {
      width: min(620px, 100%);
    }
  }
  .card-table :global(thead th) {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--card-bg);
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
