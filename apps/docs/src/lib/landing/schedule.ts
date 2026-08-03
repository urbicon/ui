/**
 * Die Terminwoche EINES Hauses für die Schedule-Ansicht der Blocks-Kachel.
 *
 * Warum generiert und nicht getippt: Ein Zeitraster verspricht Vollständigkeit.
 * Wo der Planner drei Termine zeigen und „+41 more" darunterschreiben konnte,
 * muss der Calendar den Tag wirklich füllen — sonst behauptet die Ansicht einen
 * leeren Salon, während die Overview daneben 82 % Auslastung meldet. Von Hand
 * wären das ~90 Einträge je Haus.
 *
 * Deterministisch, ohne `Math.random()`: Die Seite wird prerendered, und ein
 * zufälliger Terminplan im HTML liefe beim Hydrieren gegen einen anderen.
 * Dieselbe Woche ergibt darum immer denselben Plan.
 */
import type { CalendarEvent, CalendarEventCategory } from '@urbicon-ui/blocks';

/** Eine Leistung des Hauses. Dauer und Anteil tragen die Zahlen der Kachel. */
interface Service {
  id: string;
  label: string;
  minutes: number;
}

/**
 * Die vier Leistungen — dieselben vier, die der Umsatzmix der Overview zeigt,
 * in derselben Reihenfolge und (über `CATEGORIES`) in denselben Farben. Wer die
 * Ansicht wechselt, sieht dieselbe Aufteilung einmal als Balken und einmal als
 * Belegung.
 */
const SERVICES: Service[] = [
  { id: 'cut', label: 'Bleecker Cut', minutes: 60 },
  { id: 'dry', label: 'Dry Cut', minutes: 45 },
  { id: 'beard', label: 'Beard', minutes: 30 },
  { id: 'colour', label: 'Colour', minutes: 90 }
];

/**
 * Die Legende der Wochenansicht. Die Farben sind die Intent-Töne der
 * CompositionBar (primary / success / warning / neutral) — im
 * `.room-accent`-Scope der Kachel wird `primary` zum Kanalton, der Kalender
 * färbt sich also mit der Kachel um.
 */
export const SERVICE_CATEGORIES: CalendarEventCategory[] = [
  { id: 'cut', label: 'Bleecker Cut', color: 'var(--color-primary)' },
  { id: 'dry', label: 'Dry Cut', color: 'var(--color-success)' },
  { id: 'beard', label: 'Beard', color: 'var(--color-warning)' },
  { id: 'colour', label: 'Colour', color: 'var(--color-neutral-500)' }
];

/**
 * Zwanzig Ziehungen im Verhältnis des Umsatzmixes (10 / 5 / 3 / 2 ≈ 50 / 25 /
 * 15 / 10 %). Ein festes Muster statt eines Zufallsgenerators: es ist
 * nachvollziehbar, prerender-fest und trifft die Anteile genauer als eine
 * kurze Zufallsreihe es täte.
 */
const MIX: number[] = [0, 1, 0, 2, 0, 3, 0, 1, 0, 2, 0, 1, 3, 0, 1, 0, 2, 0, 1, 0];

/** Pausen zwischen zwei Terminen desselben Stuhls, in Minuten. */
const GAPS = [0, 15, 0, 30, 15, 0];

/** Gäste des Hauses — Initial + Nachname, wie sie am Empfang stehen. */
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

// Acht Stunden, nicht neun: bei der Stundenhöhe des Zeitrasters (40 px in
// `size="sm"`, nicht einstellbar) kostet jede Stunde 40 px Kartenhöhe. Neun
// Stunden schoben den Nachmittag aus der Karte.
const OPEN_MINUTE = 9 * 60;
const CLOSE_MINUTE = 17 * 60;

/** Erster sichtbarer / letzter sichtbarer Stundenstrich der Wochenansicht. */
export const SCHEDULE_START_HOUR = OPEN_MINUTE / 60;
export const SCHEDULE_END_HOUR = CLOSE_MINUTE / 60;

export interface ScheduleInput {
  /** Montag der dargestellten Woche. */
  weekStart: Date;
  /** Die Stühle des Hauses — je einer wird zu einer Spalte im Zeitraster. */
  chairs: string[];
  /**
   * Buchungen je Wochentag, Index 0 = Montag. Ein `0` heißt geschlossen. Die
   * Werte sind der Hausanteil an den Tagessummen, die der Chart der Overview
   * zeichnet — deshalb ist der Samstag im Raster sichtbar voller als der
   * Dienstag, genau wie die Kurve daneben ansteigt.
   */
  perDay: number[];
}

/**
 * Baut die Termine einer Woche. Die Stühle werden reihum belegt, damit sich die
 * Last gleichmäßig auf die Spalten verteilt statt den ersten Stuhl vollzupacken
 * und den dritten leer zu lassen.
 */
export function buildSchedule({ weekStart, chairs, perDay }: ScheduleInput): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (let day = 0; day < perDay.length; day++) {
    const count = perDay[day];
    if (!count) continue;

    const date = new Date(weekStart);
    date.setDate(date.getDate() + day);

    // Wann der jeweilige Stuhl wieder frei ist. Versetzte Startzeiten, damit
    // nicht alle drei Spalten um 9:00 mit demselben Block beginnen.
    const freeAt = chairs.map((_, c) => OPEN_MINUTE + c * 20);

    for (let i = 0; i < count; i++) {
      const c = i % chairs.length;
      const service = SERVICES[MIX[(day * 7 + c * 3 + i) % MIX.length]];
      const start = freeAt[c];
      // Was nicht mehr vor Feierabend fertig wird, wird nicht mehr angenommen.
      if (start + service.minutes > CLOSE_MINUTE) continue;

      const startDate = new Date(date);
      startDate.setHours(Math.floor(start / 60), start % 60, 0, 0);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + service.minutes);

      events.push({
        id: `s${day}-${c}-${i}`,
        title: CLIENTS[(day * 5 + i) % CLIENTS.length],
        start: startDate,
        end: endDate,
        allDay: false,
        categoryId: service.id,
        description: chairs[c]
      });

      freeAt[c] = start + service.minutes + GAPS[(i + c) % GAPS.length];
    }
  }

  // Chronologisch, nicht in Erzeugungsreihenfolge: die Stühle werden reihum
  // belegt, das Ergebnis wäre also nach Stuhl gruppiert. Im Zeitraster fällt
  // das nicht auf (dort bestimmt die Uhrzeit die Position), in der
  // Agenda-Ansicht schon — sie listet in Array-Reihenfolge und sortiert nicht
  // selbst.
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
