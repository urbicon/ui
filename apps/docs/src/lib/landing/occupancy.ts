/**
 * Die Belegung der Gruppe für die Rooms-Ansicht der Blocks-Kachel: je Zimmer
 * eine Spur, je Nacht eine Spalte, je Aufenthalt ein Balken — die Ansicht, die
 * ein Hotel-Backoffice wirklich führt.
 *
 * Bis 2026-08-12 erzählte die Kachel hier Empfangsvorgänge im Zeitraster
 * (`schedule.ts`, gelöscht), weil dem Set die Resource-Timeline fehlte (#185).
 * Sie ist da (#190), also erzählt die Kachel jetzt das, was sie erzählen
 * wollte. Was mit der Umstellung wegfiel: die parallelen Tresen, deren einziger
 * Zweck das Overlap-Layout des Calendars war.
 *
 * DIE ZAHLEN SIND EINE WAHRHEIT. Die Auslastungsbalken der Overview sagen
 * Cala 86 %, Firn 94 %, Duna 71 % — also füllt dieser Generator genau diesen
 * Anteil der Zimmernächte je Haus. Wer die Balken im Raster abzählt, kommt auf
 * die Prozente der Progress-Zeile daneben: `occupancy.test.ts` misst die
 * Abweichung über 30 Fenster und hält sie unter 2 Prozentpunkten (gemessen 1,1
 * — der Rest ist die Rundung auf ganze Nächte). Ohne diese Kopplung wäre die
 * Kachel zwei Fiktionen in einer Karte.
 *
 * Deterministisch, ohne `Math.random()`: Die Seite wird prerendered, und ein
 * zufälliger Belegungsplan im HTML liefe beim Hydrieren gegen einen anderen.
 * Derselbe Fenster-Anfang ergibt darum immer denselben Plan — und ein ANDERER
 * Fenster-Anfang einen anderen, sonst zeigte die Woche nach einem Klick auf „›"
 * dasselbe Bild.
 */
import type { DateCategory, TimelineGroup, TimelineResource } from '@urbicon-ui/blocks';
import { ROOM_TYPES } from '$lib/hotel-tools';

/**
 * Die Legende der Rooms-Ansicht: die vier Zimmertypen der Gruppe — dieselben
 * vier, die der Umsatzmix der Overview zeigt und die letzte Ebene des Sankey
 * trägt, in derselben Reihenfolge und aus denselben Intent-Tönen. EIN
 * Farbvokabular für die ganze Kachel: die Farbe ist immer der Zimmertyp, welches
 * Haus eine Spur gehört, sagt ihre Gruppenzeile. Im `.room-accent`-Scope der
 * Kachel wird `primary` zum Kanalton, das Raster färbt sich also mit der Kachel
 * um.
 *
 * EINE STUFE TIEFER als die Töne der Overview, und das ist keine Kosmetik: die
 * Balken tragen ihre Gästenamen IN der Farbe, und die Timeline rechnet die
 * Textfarbe aus dem Farbwert — ein `var(--…)` kann sie nicht auflösen und nimmt
 * Weiß an (dokumentiert an `DateCategory.color`). Weiß auf dem hellen
 * Kanal-Orange sind gemessene 3,1:1, auf dem Warnton 2,6:1; axe zählte 53
 * Verstöße über die Kachel.
 *
 * 80 % Farbe auf 20 % Schwarz ist der HELLSTE Mix, mit dem alle vier Töne 4,5:1
 * erreichen — gemessen am 2026-08-12 im Kachel-Scope, über eine Canvas
 * (`getComputedStyle` gibt bei `color-mix` ein `oklab()` zurück, aus dem sRGB zu
 * rechnen wäre eine zweite Implementierung der Konvertierung):
 *
 *   Ton                 100 %        85 %        80 %
 *   primary (Kanal)     3,13         4,67 ✓      5,36 ✓
 *   warning             2,60 / 2,79  3,94 / 4,21 4,57 / 4,83 ✓
 *   success             8,16 / 4,67  —           7,48 ✓
 *   neutral-500         4,85         —           7,72 ✓
 *
 * (zwei Werte = hell / dunkel, wo das Token umschaltet). Ein Mix statt fester
 * Hex-Werte, weil `primary` im `.room-accent`-Scope der Kanalton ist — der Mix
 * rechnet auf dem jeweils aktiven Token und behält damit den Kachelbezug. Die
 * Legendenpunkte dieser Ansicht tragen dieselben Werte.
 */
const deep = (token: string) => `color-mix(in oklab, var(${token}) 80%, black)`;

export const ROOM_CATEGORIES: DateCategory[] = [
  { id: 'room', label: 'Room', color: deep('--color-primary') },
  { id: 'garden', label: 'Garden', color: deep('--color-success') },
  { id: 'corner', label: 'Corner', color: deep('--color-warning') },
  { id: 'suite', label: 'Suite', color: deep('--color-neutral-500') }
];

/**
 * Gäste der Gruppe — Initial + Nachname, wie sie am Empfang stehen. Jedes Haus
 * zieht aus seinem eigenen Drittel der Liste (Index % 3 = Haus-Index), und
 * genau dieselbe Partition benutzt die Ankunftstabelle der Table-Kachel: wo ein
 * Name im Raster auftaucht, trägt er dort dasselbe Haus wie in der Tabelle (der
 * doppelt reisende Gast war Review-Befund 2026-08-10). Die ersten 24 Namen sind
 * die der Tabelle — ein Universum, eine Gästeliste.
 *
 * 123 Namen, also 41 je Haus: `occupancy.test.ts` misst über 30 aufeinander
 * folgende Fenster, dass kein Haus mehr Aufenthalte erzeugt als sein Drittel
 * Namen hat — gemessenes Maximum über 60 Fenster: 37 von 41. Und
 * `buildOccupancy` warnt im DEV, sollte eine Fenster- oder Bestandsänderung den
 * Vorrat doch sprengen: ein Gast, der im sichtbaren Raster zweimal steht, soll
 * laut werden, nicht still rotieren.
 */
const CLIENTS = [
  'M. Okafor',
  'J. Laurent',
  'A. Reyes',
  'T. Nguyen',
  'E. Sato',
  'P. Whitfield',
  'G. Halloran',
  'S. Duran',
  'R. Lindqvist',
  'K. Marsh',
  'N. Petit',
  'L. Beaumont',
  'Y. Tanaka',
  'F. Abadi',
  'C. Waweru',
  'H. Sørensen',
  'A. Beck',
  'T. Csorba',
  'J. Kovács',
  'O. Adebayo',
  'D. Halvorsen',
  'V. Moreau',
  'B. Ferreira',
  'I. Novak',
  'S. Mbeki',
  'L. Vieira',
  'K. Tammik',
  'R. Okonkwo',
  'M. Lindgren',
  'A. Fontaine',
  'D. Costa',
  'P. Egli',
  'J. Brandt',
  'T. Marino',
  'E. Vásquez',
  'H. Straub',
  'N. Farah',
  'C. Devlin',
  'W. Sauer',
  'G. Peeters',
  'F. Marchetti',
  'O. Nilsen',
  'A. Diallo',
  'M. Kowalski',
  'E. Fournier',
  'T. Andersen',
  'L. Baumann',
  'K. Havlík',
  'D. Moretti',
  'P. Janssen',
  'S. Novotná',
  'R. Ashworth',
  'M. Vogel',
  'C. Ferrand',
  'J. Okello',
  'A. Silva',
  'H. Winter',
  'V. Kask',
  'B. Meirelles',
  'G. Antoniou',
  'N. Sydow',
  'U. Bergström',
  'D. Kaya',
  'R. Iglesias',
  'T. Bakker',
  'E. Horvat',
  'W. Njoroge',
  'S. Petrov',
  'L. Marceau',
  'J. Ruiz',
  'A. Thorne',
  'M. Bianchi',
  'O. Keller',
  'P. Salmi',
  'C. Vandenberg',
  'F. Duarte',
  'K. Mensah',
  'Y. Ono',
  // Ab hier die Erweiterung von 78 auf 123 (2026-08-12): die Belegung braucht
  // je Haus mehr Namen als die Empfangswoche, weil ein Aufenthalt mehrere
  // Nächte trägt und trotzdem nur einmal beschriftet ist.
  'A. Lindholm',
  'S. Cabral',
  'T. Ibsen',
  'M. Delacroix',
  'K. Osei',
  'J. Fenn',
  'E. Brambilla',
  'N. Ravel',
  'P. Grimaud',
  'D. Aaltonen',
  'C. Solano',
  'H. Blomqvist',
  'R. Vidal',
  'L. Serrano',
  'B. Tadic',
  'O. Halim',
  'V. Ostrowski',
  'G. Neumann',
  'F. Larsen',
  'I. Baptista',
  'W. Mercer',
  'A. Nakamura',
  'T. Vaillant',
  'S. Ferreiro',
  'M. Haraldsen',
  'J. Almeida',
  'E. Kirsch',
  'N. Vidmar',
  'D. Rossi',
  'P. Kaufmann',
  'C. Lindqvist',
  'H. Ferrari',
  'R. Mbaye',
  'L. Novak',
  'B. Sandoval',
  'K. Jónsdóttir',
  'O. Barros',
  'V. Toledano',
  'G. Wexler',
  'F. Amsler',
  'I. Skarsgård',
  'W. Delaunay',
  'A. Petrescu',
  'T. Halvarsson',
  'S. Okonjo'
];

/** Ein Haus, wie die Belegung es braucht: Bestand aus dem Register, Auslastung aus der Kachel. */
export interface OccupancyHouse {
  id: string;
  name: string;
  place: string;
  /** Zimmer je Typ — die Summe ist die Hausgröße. Aus `$lib/hotel-tools`. */
  stock: Record<string, number>;
  /** Anteil der belegten Zimmernächte in Prozent — die Zahl der Progress-Zeile. */
  load: number;
}

/**
 * Ein Aufenthalt. `firstNight` und `lastNight` sind beide Nächte, die der Gast
 * im Zimmer liegt — genau der Vertrag von `getRange` (beidseitig inklusiv); der
 * Check-out ist der Morgen NACH `lastNight`.
 */
export interface Stay {
  id: string;
  roomId: string;
  guest: string;
  firstNight: Date;
  lastNight: Date;
  /** Zimmertyp — färbt den Balken über `getCategoryId`. */
  typeId: string;
}

export interface Occupancy {
  resources: TimelineResource[];
  groups: TimelineGroup[];
  stays: Stay[];
}

/**
 * Aufenthaltslängen: 3 bis 9 Nächte. Fermata ist die Fermate — der Bogen, unter
 * dem eine Note länger gehalten wird als geschrieben; die Gruppe bucht ruhig,
 * nicht schnell, und der Generator soll das zeigen statt Zwei-Nacht-Städtereisen
 * zu stapeln. Nebeneffekt: weniger Aufenthalte je Zimmer, also reicht der
 * Namensvorrat je Haus (s. `CLIENTS`).
 */
const MIN_STAY = 3;
const MAX_STAY = 9;

/**
 * Streuung der Zimmerbelegung um den Hausschnitt, in Nächten. Angewandt als
 * TAUSCH zwischen zwei Nachbarzimmern (das eine bekommt `d` Nächte mehr, das
 * andere `d` weniger), damit die Hausumme exakt bleibt: ohne Streuung hätte
 * jedes Zimmer dieselbe Zahl freier Nächte und das Raster läse sich wie ein
 * Muster, nicht wie ein Betrieb — mit einer Streuung, die nur „im Schnitt"
 * aufgeht, wäre die Prozentzahl neben dem Raster um mehrere Punkte falsch
 * (gemessen 4,4 Prozentpunkte, bevor daraus Tauschgeschäfte wurden).
 */
const SPREAD_NIGHTS = [2, 1, 3, 1, 2, 4];

/**
 * Tiny deterministic string hash (FNV-1a) — derselbe wie im Hotel-Tool.
 *
 * Jede Ableitung davon schiebt mit `>>>`, nicht mit `>>`: der Hash läuft bis
 * 2³²−1, und ein vorzeichenbehafteter Shift macht daraus eine negative Zahl.
 * `negativ % n` ist in JS negativ, und ein negativer „Überhang" ergab einen
 * Aufenthalt, dessen letzte Nacht VOR seiner ersten lag — die Timeline dreht
 * so einen Bereich still um und warnt nur im DEV. Gemessen am 2026-08-12: mit
 * `>>` fehlten Firn 3,5 Prozentpunkte Belegung.
 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** `YYYY-MM-DD` der lokalen Kalendertages — Hash-Zutat, kein Anzeigewert. */
function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Die Zimmer eines Hauses als Spuren. Die Spur trägt die Nummer, die Zweitzeile
 * den Typ — das Haus steht in der Gruppenzeile darüber, also wäre es hier
 * Wiederholung.
 *
 * Die Typen wechseln sich REIHUM ab, statt in Blöcken zu stehen: die Kachel
 * zeigt von 39 Spuren nur die obersten vier bis sechs, und in Blockreihenfolge
 * waren die alle vom Typ „Room" — ein einfarbiges Raster unter einer
 * vierfarbigen Legende (im Browser gesehen, 2026-08-12). Zweistellige Nummern,
 * keine 101/201: eine Etagen-Nummerierung würde behaupten, in welchem Stock ein
 * Zimmer liegt, und das widerspräche reihum gemischten Typen (die Gartenzimmer
 * des Registers liegen im Erdgeschoss).
 */
function roomsOf(house: OccupancyHouse): TimelineResource[] {
  const remaining = ROOM_TYPES.map((type) => ({ type, left: house.stock[type.id] ?? 0 }));
  const rooms: TimelineResource[] = [];
  let number = 1;
  while (remaining.some((entry) => entry.left > 0)) {
    for (const entry of remaining) {
      if (entry.left === 0) continue;
      entry.left -= 1;
      rooms.push({
        id: `${house.id}-${number}`,
        label: String(number).padStart(2, '0'),
        description: entry.type.label,
        groupId: house.id,
        categoryId: entry.type.id
      });
      number += 1;
    }
  }
  return rooms;
}

/**
 * Belegte Nächte je Zimmer eines Hauses, als Summe EXAKT
 * `round(Zimmer × Nächte × Auslastung/100)`.
 *
 * Zuerst gleichmäßig (Basis plus Rest auf die vorderen Zimmer), dann
 * Nachbartausch aus `SPREAD_NIGHTS`: jeder Tausch nimmt einem Zimmer Nächte und
 * gibt sie dem nächsten, die Summe bleibt also die des Hauses — das ist der
 * Unterschied zwischen „im Schnitt 86 %" und „86 %, nachzählbar". Jedes Zimmer
 * behält mindestens MIN_STAY belegte und höchstens `nights` Nächte, sonst hätte
 * eine Spur nichts zu zeigen oder der Tausch liefe ins Leere.
 */
function occupiedPerRoom(seed: number, rooms: number, nights: number, load: number): number[] {
  const total = Math.round((rooms * nights * load) / 100);
  const base = Math.floor(total / rooms);
  const counts = Array.from({ length: rooms }, (_, i) => base + (i < total % rooms ? 1 : 0));

  for (let i = 0; i + 1 < rooms; i += 2) {
    const delta = SPREAD_NIGHTS[(seed + i) % SPREAD_NIGHTS.length];
    const give = Math.min(delta, counts[i] - MIN_STAY, nights - counts[i + 1]);
    if (give <= 0) continue;
    // Richtung aus dem Seed, damit nicht immer das vordere Zimmer das leerere
    // ist (das wäre ein Gefälle von oben nach unten, kein Betrieb).
    const forward = ((seed >>> (i % 8)) & 1) === 1;
    counts[i] += forward ? -give : give;
    counts[i + 1] += forward ? give : -give;
  }
  return counts;
}

/**
 * Ein Zimmerplan als Bitmuster: `occupied` belegte Nächte in Läufen von
 * mindestens MIN_STAY, getrennt von Lücken, die zusammen die freien Nächte
 * ergeben — und am Ende zirkulär gedreht, damit nicht jedes Zimmer am ersten
 * sichtbaren Tag belegt ist (das läse sich als Spalte). Die Drehung kann einen
 * Lauf am Fensterrand teilen; genau dort verlängert `buildOccupancy` ihn über
 * den Rand hinaus, die Timeline schneidet ab.
 */
function nightPattern(seed: number, nights: number, occupied: number): boolean[] {
  const free = nights - occupied;
  const pattern = new Array<boolean>(nights).fill(false);

  // Lücken: höchstens eine je freier Nacht, und nur so viele, dass jeder Lauf
  // MIN_STAY behält. Ohne diese Schranke entstanden Ein-Nacht-Aufenthalte —
  // gemessen 84 statt 28 Aufenthalten je Haus, also mehr, als der
  // Namensvorrat trägt.
  const maxGaps = Math.min(free, Math.max(0, Math.floor(occupied / MIN_STAY) - 1));
  const gaps = maxGaps === 0 ? 0 : 1 + (seed % maxGaps);
  const runs = gaps + 1;

  const runLengths = split(occupied, runs, seed >>> 5, MIN_STAY);
  const gapLengths = gaps === 0 ? [] : split(free, gaps, seed >>> 11);

  let cursor = 0;
  for (let i = 0; i < runs; i++) {
    for (let n = 0; n < runLengths[i]; n++) pattern[cursor++] = true;
    cursor += gapLengths[i] ?? 0;
  }

  const rotate = seed % nights;
  return pattern.map((_, i) => pattern[(i + rotate) % nights]);
}

/** `total` auf `parts` gleich große Teile verteilen; der Rest geht nach vorn. */
function even(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) => base + (i < total % parts ? 1 : 0));
}

/**
 * Wie {@link even}, plus ein Tausch zwischen erstem und letztem Teil — sonst
 * wären die Läufe eines Zimmers auffällig gleich lang. Der Tausch respektiert
 * `floor`: ohne diese Schranke schrumpfte ein Teil auf eine Nacht und
 * widersprach dem Mindestaufenthalt, den derselbe Generator zwei Zeilen weiter
 * oben zusichert.
 */
function split(total: number, parts: number, seed: number, floor = 1): number[] {
  const sizes = even(total, parts);
  if (parts > 1) {
    const give = Math.max(0, Math.min(seed % 3, sizes[0] - floor));
    sizes[0] -= give;
    sizes[parts - 1] += give;
  }
  return sizes;
}

/**
 * Baut die Belegung: Spuren, Gruppenzeilen und Aufenthalte für ein Fenster von
 * `nights` Nächten ab `windowStart`.
 *
 * Aufenthalte, die am Fensterrand anliegen, werden über den Rand hinaus
 * verlängert (ein Gast reist nicht zufällig am ersten sichtbaren Tag an) — die
 * Timeline schneidet sie ab und markiert den Schnitt über `isStart`/`isEnd`. Die
 * belegten Nächte IM Fenster ändert das nicht, die Auslastungsrechnung bleibt
 * also gültig.
 */
export function buildOccupancy({
  houses,
  windowStart,
  nights
}: {
  houses: OccupancyHouse[];
  windowStart: Date;
  nights: number;
}): Occupancy {
  const resources: TimelineResource[] = [];
  const groups: TimelineGroup[] = [];
  const stays: Stay[] = [];
  const window = isoDay(windowStart);

  houses.forEach((house, houseIndex) => {
    groups.push({ id: house.id, label: `${house.name} · ${house.place}` });
    const rooms = roomsOf(house);
    resources.push(...rooms);

    // Das Drittel der Gästeliste, das diesem Haus gehört (s. `CLIENTS`): ein
    // Zähler je Haus, damit die Namen innerhalb des Hauses nicht kollidieren.
    const pool = CLIENTS.filter((_, i) => i % 3 === houseIndex % 3);
    let guest = 0;

    const counts = occupiedPerRoom(hash(`${house.id}|${window}`), rooms.length, nights, house.load);

    rooms.forEach((room, roomIndex) => {
      const seed = hash(`${room.id}|${window}`);
      const pattern = nightPattern(seed, nights, counts[roomIndex]);

      let night = 0;
      while (night < nights) {
        if (!pattern[night]) {
          night += 1;
          continue;
        }
        // Der ganze Lauf belegter Nächte …
        let length = 0;
        while (night + length < nights && pattern[night + length]) length += 1;
        const runStart = night;
        night += length;

        // … dann in gleich lange Stücke von höchstens MAX_STAY Nächten, die
        // sich am Check-out-Morgen berühren (der Fall, den die Timeline ohne
        // zweite Zeile nebeneinander stellt). GLEICH lange, nicht „so viel wie
        // geht und ein Rest": ein Lauf von zehn Nächten ergab sonst 9 + 1, und
        // die eine Nacht widersprach dem Mindestaufenthalt des Hauses.
        const pieces = Math.max(1, Math.ceil(length / MAX_STAY));
        let offset = 0;
        for (const piece of even(length, pieces)) {
          const first = runStart + offset;
          const last = first + piece - 1;
          offset += piece;

          // Ein Stück am Fensterrand reicht darüber hinaus: nach vorn, wenn es
          // am ersten Tag beginnt, nach hinten, wenn es am letzten endet — ein
          // Gast reist nicht zufällig am ersten sichtbaren Tag an. Der Überhang
          // ist mindestens so groß, dass auch ein am Rand abgeschnittenes Stück
          // auf MIN_STAY kommt: die Drehung in `nightPattern` teilt Läufe am
          // Fensterrand, und ohne diese Schranke stand dort ein
          // Zwei-Nacht-Aufenthalt in einem Haus, das laut Generator ruhig bucht.
          const visible = last - first + 1;
          const overhang = Math.max(0, MIN_STAY - visible);
          const before = first === 0 ? Math.max(1 + (seed % MIN_STAY), overhang) : 0;
          const after = last === nights - 1 ? Math.max(1 + ((seed >>> 3) % MIN_STAY), overhang) : 0;

          stays.push({
            id: `${room.id}-${first}`,
            roomId: room.id,
            guest: pool[guest % pool.length],
            typeId: String(room.categoryId),
            firstNight: addDays(windowStart, first - before),
            lastNight: addDays(windowStart, last + after)
          });
          guest += 1;
        }
      }
    });

    // Der Vorrat ist gemessen bemessen (s. `CLIENTS`) — sollte eine Fenster-
    // oder Bestandsänderung ihn doch sprengen, steht ein Gast zweimal im
    // sichtbaren Raster, und das soll laut werden.
    if (import.meta.env?.DEV && guest > pool.length) {
      console.warn(
        `[occupancy] guest pool exhausted for ${house.name}: ${guest} stays > ${pool.length} names — a guest is on screen twice`
      );
    }
  });

  return { resources, groups, stays };
}

/**
 * Der gemessene Belegungsanteil eines Hauses im Fenster, in Prozent — was das
 * Raster wirklich zeigt. Der Test hält ihn gegen `house.load`; die Kachel
 * braucht ihn nicht, aber ohne diese Funktion wäre die Kopplung eine Behauptung
 * statt einer Messung.
 */
export function measuredLoad(
  occupancy: Occupancy,
  houseId: string,
  windowStart: Date,
  nights: number
): number {
  const rooms = occupancy.resources.filter((room) => room.groupId === houseId);
  const roomIds = new Set(rooms.map((room) => room.id));
  const nightsInWindow = new Set<string>();
  for (const stay of occupancy.stays) {
    if (!roomIds.has(stay.roomId)) continue;
    for (let d = new Date(stay.firstNight); d <= stay.lastNight; d = addDays(d, 1)) {
      const offset = Math.round((d.getTime() - windowStart.getTime()) / 86_400_000);
      if (offset >= 0 && offset < nights) nightsInWindow.add(`${stay.roomId}|${offset}`);
    }
  }
  return (nightsInWindow.size / (rooms.length * nights)) * 100;
}
