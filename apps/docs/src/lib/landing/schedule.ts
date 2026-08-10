/**
 * Die An- und Abreisewoche EINES Hauses für die Schedule-Ansicht der
 * Blocks-Kachel: Abreisen am Vormittag, Ankünfte am Nachmittag — die Woche,
 * wie sie am Empfang aussieht.
 *
 * Warum generiert und nicht getippt: Ein Zeitraster verspricht Vollständigkeit.
 * Wo der Planner drei Einträge zeigen und „+41 more" darunterschreiben konnte,
 * muss der Calendar den Tag wirklich füllen — sonst behauptet die Ansicht ein
 * leeres Haus, während die Overview daneben 86 % Belegung meldet. Von Hand
 * wären das ~70 Einträge je Haus.
 *
 * Deterministisch, ohne `Math.random()`: Die Seite wird prerendered, und ein
 * zufälliger Plan im HTML liefe beim Hydrieren gegen einen anderen. Dieselbe
 * Woche ergibt darum immer denselben Plan.
 */
import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';
import { ROOM_TYPES } from '$lib/hotel-tools';

/**
 * Die Legende der Wochenansicht: die vier Zimmertypen der Gruppe — dieselben
 * vier, die der Umsatzmix der Overview zeigt und die letzte Ebene des Sankey
 * trägt, in derselben Reihenfolge und (über die Intent-Töne) in denselben
 * Farben. Wer die Ansicht wechselt, sieht dieselbe Aufteilung einmal als
 * Balken und einmal als Ankunftsdichte. Im `.room-accent`-Scope der Kachel
 * wird `primary` zum Kanalton, der Kalender färbt sich also mit der Kachel um.
 */
export const ROOM_CATEGORIES: CalendarEventCategory[] = [
  { id: 'room', label: 'Room', color: 'var(--color-primary)' },
  { id: 'garden', label: 'Garden', color: 'var(--color-success)' },
  { id: 'corner', label: 'Corner', color: 'var(--color-warning)' },
  { id: 'suite', label: 'Suite', color: 'var(--color-neutral-500)' }
];

/**
 * Zwanzig Ziehungen im Verhältnis des Zimmerbestands der Gruppe (22 / 13 / 9 /
 * 6 ≈ 45 / 25 / 18 / 12 %). Ein festes Muster statt eines Zufallsgenerators:
 * es ist nachvollziehbar, prerender-fest und trifft die Anteile genauer als
 * eine kurze Zufallsreihe es täte.
 */
const MIX: number[] = [0, 1, 0, 2, 0, 3, 0, 1, 0, 2, 0, 1, 3, 0, 1, 0, 2, 0, 1, 0];

/** Gäste der Gruppe — Initial + Nachname, wie sie am Empfang stehen. */
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
  'I. Novak'
];

// Acht Stunden, nicht mehr: bei der Stundenhöhe des Zeitrasters (40 px in
// `size="sm"`, nicht einstellbar) kostet jede Stunde 40 px Kartenhöhe. Der
// Empfangstag läuft von den ersten Abreisen bis zur letzten Ankunft.
const DAY_START_MINUTE = 9 * 60;
const DAY_END_MINUTE = 17 * 60;

/** Erster sichtbarer / letzter sichtbarer Stundenstrich der Wochenansicht. */
export const SCHEDULE_START_HOUR = DAY_START_MINUTE / 60;
export const SCHEDULE_END_HOUR = DAY_END_MINUTE / 60;

/** Abreisen räumen den Vormittag, Ankünfte füllen den Nachmittag. */
const DEPARTURES_FROM = 9 * 60;
const ARRIVALS_FROM = 14 * 60;
/** Ein Empfangsvorgang im Raster — kurz, aber mit lesbarem Namen. */
const SLOT_MINUTES = 30;
/** Pausen zwischen zwei Vorgängen am selben Tresen, in Minuten. */
const GAPS = [0, 15, 0, 30, 15, 0];

export interface ScheduleInput {
  /** Montag der dargestellten Woche. */
  weekStart: Date;
  /**
   * Ankünfte je Wochentag, Index 0 = Montag. Die Werte sind der Hausanteil an
   * den Tagessummen, die der Chart der Overview zeichnet — deshalb ist der
   * Samstag im Raster sichtbar voller als der Dienstag, genau wie die Kurve
   * daneben ansteigt. Ein Hotel kennt keinen Ruhetag: alle sieben Tage tragen.
   */
  perDay: number[];
}

/**
 * Baut die Empfangswoche. Je Tag erst die Abreisen (etwa vier Fünftel der
 * Ankünfte — wer kommt, fährt ein paar Tage später wieder), dann die
 * Ankünfte; beide reihum über die Zimmertypen des `MIX`, damit die Legende
 * jede Farbe wirklich zeigt.
 */
export function buildSchedule({ weekStart, perDay }: ScheduleInput): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (let day = 0; day < perDay.length; day++) {
    const arrivals = perDay[day];
    if (!arrivals) continue;
    const departures = Math.max(1, Math.round(arrivals * 0.8));

    const date = new Date(weekStart);
    date.setDate(date.getDate() + day);

    const push = (kind: 'out' | 'in', index: number, startMinute: number): number => {
      const roomType =
        ROOM_TYPES[MIX[(day * 7 + index * 3 + (kind === 'in' ? 1 : 0)) % MIX.length]];
      if (startMinute + SLOT_MINUTES > DAY_END_MINUTE) return startMinute;

      const startDate = new Date(date);
      startDate.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + SLOT_MINUTES);

      events.push({
        id: `s${day}-${kind}-${index}`,
        title: CLIENTS[(day * 5 + index * (kind === 'in' ? 1 : 2)) % CLIENTS.length],
        start: startDate,
        end: endDate,
        allDay: false,
        categoryId: roomType.id,
        description: kind === 'in' ? `→ ${roomType.label}` : `${roomType.label} →`
      });

      return startMinute + SLOT_MINUTES + GAPS[(index + day) % GAPS.length];
    };

    // Vormittag: Abreisen ab 9:00, bis der Block in die Ankünfte liefe.
    let cursor = DEPARTURES_FROM;
    for (let i = 0; i < departures && cursor + SLOT_MINUTES <= ARRIVALS_FROM; i++) {
      cursor = push('out', i, cursor);
    }
    // Nachmittag: Ankünfte ab 14:00 bis Rasterende.
    cursor = ARRIVALS_FROM;
    for (let i = 0; i < arrivals; i++) {
      cursor = push('in', i, cursor);
      if (cursor + SLOT_MINUTES > DAY_END_MINUTE) break;
    }
  }

  // Chronologisch, nicht in Erzeugungsreihenfolge: Im Zeitraster fällt das
  // nicht auf (dort bestimmt die Uhrzeit die Position), in der Agenda-Ansicht
  // schon — sie listet in Array-Reihenfolge und sortiert nicht selbst.
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
