/**
 * Die Empfangsvorgänge für die Schedule-Ansicht der Blocks-Kachel: Abreisen
 * am Vormittag, Ankünfte am Nachmittag — an PARALLELEN Tresen (Lanes), nicht
 * an einem. Ein Ankunftstag ist gleichzeitig, und genau das ist der Showcase:
 * Der Calendar spaltet Überlappungen selbst in Spalten (sein Overlap-Layout,
 * `resolveOverlaps` in der Engine); eine Demo, die nur Sequenzen liefert,
 * sieht aus, als könnte er das nicht. Die Lane-Zahl wächst mit der Tageslast,
 * darum ist der Samstag im Raster wirklich dichter als der Dienstag — dieselbe
 * Kurve, die der Chart der Overview zeichnet.
 *
 * Erzeugt wird die ganze Woche; die Kachel zeigt davon einen TAG (Zeitraster
 * bzw. Agenda). Das Raster erzählt Vorgänge am Tresen, keine Belegung —
 * Belegung wären mehrtägige Balken je Zimmer, und diese Resource-Timeline
 * fehlt dem Calendar noch (#185).
 *
 * Deterministisch, ohne `Math.random()`: Die Seite wird prerendered, und ein
 * zufälliger Plan im HTML liefe beim Hydrieren gegen einen anderen. Dieselbe
 * Woche ergibt darum immer denselben Plan.
 */
import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';
import { ROOM_TYPES } from '$lib/hotel-tools';

/**
 * Die Legende der Schedule-Ansicht: die vier Zimmertypen der Gruppe — dieselben
 * vier, die der Umsatzmix der Overview zeigt und die letzte Ebene des Sankey
 * trägt, in derselben Reihenfolge und (über die Intent-Töne) in denselben
 * Farben. EIN Farbvokabular für die ganze Kachel: auch wenn die Gruppen-Sicht
 * die Häuser mischt, bleibt die Farbe der Zimmertyp — welches Haus ein Vorgang
 * ist, sagt sein Text. Im `.room-accent`-Scope der Kachel wird `primary` zum
 * Kanalton, der Kalender färbt sich also mit der Kachel um.
 */
export const ROOM_CATEGORIES: CalendarEventCategory[] = [
  { id: 'room', label: 'Room', color: 'var(--color-primary)' },
  { id: 'garden', label: 'Garden', color: 'var(--color-success)' },
  { id: 'corner', label: 'Corner', color: 'var(--color-warning)' },
  { id: 'suite', label: 'Suite', color: 'var(--color-neutral-500)' }
];

/**
 * Zwanzig Ziehungen entlang des Zimmerbestands der Gruppe (17 / 10 / 7 / 5 ≈
 * 44 / 26 / 18 / 13 %; das Muster liefert 9/5/4/2 = 45/25/20/10 — näher geht
 * es mit zwanzig Ziehungen nicht). Ein festes Muster statt eines
 * Zufallsgenerators: nachvollziehbar und prerender-fest. Die Vorfassung
 * behauptete dieselben Prozente für ein 10/5/3/2-Muster (50/25/15/10) —
 * Review-Befund 2026-08-12, nachgezählt.
 */
const MIX: number[] = [0, 1, 2, 0, 1, 0, 2, 3, 0, 1, 0, 2, 0, 1, 3, 0, 1, 2, 0, 0];

/**
 * Gäste der Gruppe — Initial + Nachname, wie sie am Empfang stehen. 78 Namen,
 * damit die Eindeutigkeit KONSTRUKTIV ist statt modular erhofft: In der
 * Gruppen-Sicht zieht jedes Haus aus seinem eigenen Drittel der Liste
 * (`guestPool`, 26 Namen — mehr als die ≤ 24 Vorgänge, die ein Tag bei zwei
 * Tresen je Haus erreicht), die Einzelhaus-Sicht aus der vollen Liste (78 >
 * ~35 Vorgänge bei drei Tresen). Disjunkte Mengen können nicht kollidieren —
 * kein Gast steht am selben Tag zweimal am Tresen, in keinem und über kein
 * Haus hinweg (der doppelt reisende Gast war Review-Befund 2026-08-10 und kam
 * mit den parallelen Tresen kurz zurück; ein erster Fix rechnete mit
 * Modulo-Abständen und scheiterte messbar an der Rückrichtung). Die ersten 24
 * Namen sind zugleich die der Ankunftstabelle — ein Universum, eine
 * Gästeliste; die Tabelle bindet Namen an Häuser eines anderen fiktiven
 * Tages, die Schedule-Zuordnung rotiert.
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
  'Y. Ono'
];

// Sieben Stunden, 10–17: Der Empfangstag läuft vom Check-out bis zur letzten
// Ankunft. Sieben statt der früheren acht, damit die aus der Bühne gerechnete
// Stundenhöhe (`timeGridHourHeight`) den 40-px-Boden überhaupt übersteigen
// kann — mit acht Stunden war die Rechnung an jeder Bildschirmgröße vom
// Kachel-Deckel (72vh, max. 800 px) auf den Boden gedrückt und damit tote
// Mechanik (Review-Befund 2026-08-12, über sechs Viewports gemessen).
const DAY_START_MINUTE = 10 * 60;
const DAY_END_MINUTE = 17 * 60;

/** Erster sichtbarer / letzter sichtbarer Stundenstrich der Schedule-Ansicht. */
export const SCHEDULE_START_HOUR = DAY_START_MINUTE / 60;
export const SCHEDULE_END_HOUR = DAY_END_MINUTE / 60;

/**
 * Abreisen räumen den Vormittag (10–13), Ankünfte füllen den Nachmittag
 * (13–17). Das Ankunftsfenster ist bewusst das größere: mit dem alten
 * 14-Uhr-Schnitt (5 h gegen 3 h) stellte der Samstag — der Ankunfts-Spitzentag
 * der Overview-Kurve — mehr Abreise- als Ankunftsbalken und las sich im
 * Raster als Abreisetag (Review-Befund 2026-08-12, gemessen 44 gegen 26).
 */
const DEPARTURES_FROM = 10 * 60;
const ARRIVALS_FROM = 13 * 60;
/** Ein Empfangsvorgang im Raster — kurz, aber mit lesbarem Namen. */
const SLOT_MINUTES = 30;
/** Pausen zwischen zwei Vorgängen am SELBEN Tresen, in Minuten. */
const GAPS = [0, 15, 0, 30, 15, 0];
/**
 * Versatz, mit dem Tresen 2 und 3 ihren Tag beginnen: Lane i startet i × 10
 * Minuten später. So überlappen die Vorgänge benachbarter Tresen um 10–20
 * Minuten — genug, dass das Overlap-Layout sie nebeneinander stellt, ohne dass
 * alle Balken deckungsgleich übereinanderliegen.
 */
const LANE_STAGGER_MINUTES = 10;

export interface ScheduleInput {
  /** Montag der dargestellten Woche. */
  weekStart: Date;
  /**
   * Ankünfte je Wochentag, Index 0 = Montag. Die Werte sind der Hausanteil an
   * den Tagessummen, die der Chart der Overview zeichnet. Ein Hotel kennt
   * keinen Ruhetag: alle sieben Tage tragen.
   */
  perDay: number[];
  /**
   * Haus-Präfix für die Beschreibung („Cala · → Garden") — gesetzt in der
   * Gruppen-Sicht, in der die Vorgänge dreier Häuser gemischt laufen. Ohne
   * Präfix (Einzelhaus-Sicht) bleibt es beim knappen „→ Garden".
   */
  houseName?: string;
  /**
   * Drittel der Gästeliste, aus dem dieses Haus zieht (0/1/2, der
   * Haus-Index) — nur in der Gruppen-Sicht gesetzt, damit die drei Häuser
   * disjunkte Namen führen. Ohne Angabe zieht das Haus aus der vollen Liste:
   * die Einzelhaus-Sicht hat keine sichtbaren Nachbarn, mit denen sie
   * kollidieren könnte, und braucht den größeren Vorrat für drei Tresen.
   */
  guestPool?: 0 | 1 | 2;
  /**
   * Deckel für die parallelen Tresen, Default 2. Mehr schnürt die
   * Spitzen-Parallelität dreier gemischter Häuser die Spalten des
   * Overlap-Layouts zu schmal — und die Einzelhaus-Sicht ist ein FILTER der
   * Gruppen-Menge (Kachel), läuft also zwangsläufig mit derselben Spreizung.
   */
  maxLanes?: number;
}

/**
 * Baut die Empfangswoche eines Hauses. Je Tag erst die Abreisen (etwa vier
 * Fünftel der Ankünfte — wer kommt, fährt ein paar Tage später wieder), dann
 * die Ankünfte; beide reihum über die Zimmertypen des `MIX` und reihum über
 * die Tresen des Tages. Die Tresen-Zahl skaliert mit der Last (eine je sechs
 * Ankünfte, gedeckelt), der Versatz zwischen ihnen erzeugt die Überlappungen.
 * Was auch in Lanes nicht in den Tag passt, entfällt still — die Kappung ist
 * an Spitzentagen erheblich und gewollt (das Raster ist Erzählung, keine
 * Buchhaltung): gemessen 2026-08-12 in der Gruppen-Sicht platziert der
 * Samstag 39 von 71 gewollten Ankünften und bleibt mit 69 Vorgängen trotzdem
 * sichtbar der dichteste Tag der Woche (Mo–Mi ≈ 46–49); dank des
 * 13-Uhr-Schnitts überwiegen die Ankünfte an jedem Tag die Abreisen.
 */
export function buildSchedule({
  weekStart,
  perDay,
  houseName,
  guestPool,
  maxLanes = 2
}: ScheduleInput): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const idPrefix = houseName ? `s-${houseName.toLowerCase()}` : 's';
  const pool = guestPool === undefined ? CLIENTS : CLIENTS.filter((_, i) => i % 3 === guestPool);

  for (let day = 0; day < perDay.length; day++) {
    const arrivals = perDay[day];
    if (!arrivals) continue;
    const departures = Math.max(1, Math.round(arrivals * 0.8));
    const lanes = Math.min(maxLanes, Math.max(1, Math.ceil(arrivals / 6)));

    const date = new Date(weekStart);
    date.setDate(date.getDate() + day);

    // Ein Zähler über BEIDE Läufe des Tages, damit jeder Gast an einem Tag
    // genau einmal am Tresen steht (Dreier-Schritt, s. `CLIENTS`).
    let seq = 0;
    // Ein Zeit-Cursor JE Tresen — Parallelität entsteht, weil die Cursor
    // unabhängig laufen und versetzt starten.
    const cursors: number[] = [];

    const push = (kind: 'out' | 'in', lane: number, startMinute: number): number => {
      const roomType = ROOM_TYPES[MIX[(day * 7 + seq * 3) % MIX.length]];
      if (startMinute + SLOT_MINUTES > DAY_END_MINUTE) return DAY_END_MINUTE;

      const startDate = new Date(date);
      startDate.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + SLOT_MINUTES);

      const typeText = kind === 'in' ? `→ ${roomType.label}` : `${roomType.label} →`;
      events.push({
        id: `${idPrefix}${day}-${kind}-${seq}`,
        title: pool[(day * 7 + seq) % pool.length],
        start: startDate,
        end: endDate,
        allDay: false,
        categoryId: roomType.id,
        description: houseName ? `${houseName} · ${typeText}` : typeText,
        // Fürs Filtern der Einzelhaus-Sicht (Kachel) — die Sicht ist eine
        // Teilmenge der Gruppen-Menge, kein zweiter Generator-Lauf, damit
        // ein Gast beim Umschalten des Geltungsbereichs nicht das Haus
        // wechselt (Review-Befund 2026-08-12).
        meta: houseName ? { house: houseName } : undefined
      });

      seq += 1;
      // Der Namensvorrat ist konstruktiv bemessen (s. `CLIENTS`) — sollte eine
      // Fenster-/Lane-Änderung ihn doch sprengen, ist das ein Duplikat im
      // sichtbaren Raster und soll laut werden, nicht still rotieren.
      if (import.meta.env?.DEV && seq > pool.length) {
        console.warn(
          `[schedule] guest pool exhausted on day ${day}: ${seq} operations > ${pool.length} names — duplicates on screen`
        );
      }
      return startMinute + SLOT_MINUTES + GAPS[(seq + day + lane) % GAPS.length];
    };

    // Vormittag: Abreisen ab 9:00, reihum über die Tresen, bis der jeweilige
    // Tresen in die Ankünfte liefe.
    for (let lane = 0; lane < lanes; lane++) {
      cursors[lane] = DEPARTURES_FROM + lane * LANE_STAGGER_MINUTES;
    }
    for (let i = 0; i < departures; i++) {
      const lane = i % lanes;
      if (cursors[lane] + SLOT_MINUTES > ARRIVALS_FROM) continue;
      cursors[lane] = push('out', lane, cursors[lane]);
    }

    // Nachmittag: Ankünfte ab 14:00 bis Rasterende, wieder reihum.
    for (let lane = 0; lane < lanes; lane++) {
      cursors[lane] = ARRIVALS_FROM + lane * LANE_STAGGER_MINUTES;
    }
    for (let i = 0; i < arrivals; i++) {
      const lane = i % lanes;
      if (cursors[lane] + SLOT_MINUTES > DAY_END_MINUTE) continue;
      cursors[lane] = push('in', lane, cursors[lane]);
    }
  }

  // Chronologisch, nicht in Erzeugungsreihenfolge: Im Zeitraster fällt das
  // nicht auf (dort bestimmt die Uhrzeit die Position), in der Agenda-Ansicht
  // schon — sie listet in Array-Reihenfolge und sortiert nicht selbst (#95;
  // sobald das landet, ist dieses Sortieren redundant, aber harmlos).
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
