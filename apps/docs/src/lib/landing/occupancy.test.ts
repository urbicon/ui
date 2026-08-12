/**
 * Was der Belegungsgenerator der Landing verspricht, wird hier gemessen — die
 * Kachel behauptet neben dem Raster Prozentzahlen (die Progress-Zeile der
 * Overview), und eine Fiktion, die sich selbst widerspricht, ist der einzige
 * Fehler, den diese Kachel wirklich machen kann.
 *
 * Drei Zusagen:
 *   1. Die gemessene Belegung je Haus trifft die Zahl der Progress-Zeile.
 *   2. Kein Gast liegt im sichtbaren Fenster in zwei Zimmern.
 *   3. Derselbe Fenster-Anfang ergibt denselben Plan (Prerender + Hydration),
 *      ein anderer einen anderen (sonst zeigte „›" dasselbe Bild).
 */
import { describe, expect, it } from 'vitest';
import { HOUSES, ROOM_TYPES } from '$lib/hotel-tools';
import { buildOccupancy, measuredLoad, type OccupancyHouse } from './occupancy';

/** Die Auslastung der Landing-Fiktion — dieselben Zahlen wie `OPS` in +page.svelte. */
const LOAD: Record<string, number> = { cala: 86, firn: 94, duna: 71 };

const GROUP: OccupancyHouse[] = HOUSES.map((house) => ({
  id: house.id,
  name: house.name,
  place: house.place,
  stock: house.stock,
  load: LOAD[house.id]
}));

const NIGHTS = 14;
/** Ein fester Montag — nie die Wanduhr. */
const ANCHOR = new Date(2026, 7, 3);
const windows = Array.from({ length: 30 }, (_, i) => {
  const start = new Date(ANCHOR);
  start.setDate(start.getDate() + i);
  return start;
});

describe('Landing-Belegung — das Raster zeigt die Prozente der Karte', () => {
  it('trifft jede Hausauslastung auf 2 Prozentpunkte, über 30 Fenster', () => {
    let worst = 0;
    for (const windowStart of windows) {
      const occupancy = buildOccupancy({ houses: GROUP, windowStart, nights: NIGHTS });
      for (const house of GROUP) {
        const measured = measuredLoad(occupancy, house.id, windowStart, NIGHTS);
        worst = Math.max(worst, Math.abs(measured - house.load));
      }
    }
    // Der Rest ist Rundung: die Hausumme ist exakt, aber sie wird auf ganze
    // Nächte gerundet (1/14 = 7,1 Prozentpunkte Granularität je Zimmer).
    expect(worst).toBeLessThan(2);
  });

  it('belegt jedes Zimmer mindestens einmal und nicht jedes durchgehend', () => {
    // Positivkontrolle in beide Richtungen: ein Generator, der nichts oder
    // alles belegt, würde die Prozent-Zusage oben je nach Last auch erfüllen.
    const occupancy = buildOccupancy({ houses: GROUP, windowStart: ANCHOR, nights: NIGHTS });
    const perRoom = new Map<string, number>();
    for (const room of occupancy.resources) perRoom.set(room.id, 0);
    for (const stay of occupancy.stays) {
      perRoom.set(stay.roomId, (perRoom.get(stay.roomId) ?? 0) + 1);
    }
    expect([...perRoom.values()].every((count) => count >= 1)).toBe(true);
    // Duna liegt bei 71 % — dort MUSS es freie Nächte geben, also Zimmer mit
    // mehr als einem Aufenthalt.
    const dunaRooms = occupancy.resources.filter((room) => room.groupId === 'duna');
    expect(dunaRooms.some((room) => (perRoom.get(room.id) ?? 0) > 1)).toBe(true);
  });
});

describe('Landing-Belegung — jeder Aufenthalt ist ein plausibler Aufenthalt', () => {
  it('beendet keinen Aufenthalt vor seinem Beginn, über 30 Fenster', () => {
    // Der Fund, der diese Datei gerettet hat: `seed >> 3` auf einem Hash bis
    // 2³²−1 ist negativ, also war der Überhang am Fensterrand negativ und ein
    // Aufenthalt lief rückwärts. Die Timeline dreht so einen Bereich still um
    // und warnt nur im DEV — auf der Landing hätte es niemand gesehen.
    for (const windowStart of windows) {
      const { stays } = buildOccupancy({ houses: GROUP, windowStart, nights: NIGHTS });
      for (const stay of stays) {
        expect(
          stay.lastNight.getTime() >= stay.firstNight.getTime(),
          `${stay.id} runs backwards`
        ).toBe(true);
      }
    }
  });

  it('hält den Drei-Nächte-Boden auch bei Lasten, die die Kachel nicht nutzt', () => {
    // Der Bereich, in den die Zahlen der Kachel (71–94 %) nie kommen — und in
    // dem dieser Generator zweimal brach: der Nachbartausch prüfte jede Grenze
    // nur an EINEM Zimmer (vorwärts legal, rückwärts nicht), und unter etwa
    // einem Drittel Auslastung ist der Anteil je Zimmer kleiner als ein
    // Aufenthalt — der geht jetzt auf WENIGER Zimmer statt auf kürzere
    // Aufenthalte.
    for (const load of [20, 35, 50, 65]) {
      for (const rooms of [1, 2, 3, 5, 9]) {
        const house: OccupancyHouse = {
          id: 'probe',
          name: 'Probe',
          place: 'Nowhere',
          stock: { room: rooms },
          load
        };
        for (const windowStart of windows.slice(0, 8)) {
          const { stays } = buildOccupancy({ houses: [house], windowStart, nights: NIGHTS });
          for (const stay of stays) {
            const nights =
              Math.round((stay.lastNight.getTime() - stay.firstNight.getTime()) / 86_400_000) + 1;
            expect(
              nights,
              `${load} % / ${rooms} Zimmer: ${stay.id} dauert ${nights}`
            ).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });

  it('hält jeden Aufenthalt zwischen 3 und 12 Nächten, über 30 Fenster', () => {
    // MIN_STAY = 3 und MAX_STAY = 9 plus höchstens drei Nächte Überhang am
    // Fensterrand. Ein Ein-Nacht-Aufenthalt widerspricht dem Haus, das laut
    // Generator ruhig bucht — und entstand zweimal: einmal aus dem
    // Kappungsrest (9 + 1), einmal aus dem Tausch in `split`.
    for (const windowStart of windows) {
      const { stays } = buildOccupancy({ houses: GROUP, windowStart, nights: NIGHTS });
      for (const stay of stays) {
        const nights =
          Math.round((stay.lastNight.getTime() - stay.firstNight.getTime()) / 86_400_000) + 1;
        expect(nights, `${stay.id} lasts ${nights} nights`).toBeGreaterThanOrEqual(3);
        expect(nights, `${stay.id} lasts ${nights} nights`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('stapelt nie zwei Aufenthalte eines Zimmers auf derselben Nacht', () => {
    // Zwei Balken übereinander in einer Spur wären zwei Gäste in einem Zimmer.
    // Berühren dürfen sie sich (Check-out-Morgen = Check-in-Tag), überlappen nie.
    for (const windowStart of windows) {
      const { stays } = buildOccupancy({ houses: GROUP, windowStart, nights: NIGHTS });
      const byRoom = new Map<string, { from: number; to: number }[]>();
      for (const stay of stays) {
        const from = stay.firstNight.getTime();
        const to = stay.lastNight.getTime();
        for (const other of byRoom.get(stay.roomId) ?? []) {
          expect(from <= other.to && to >= other.from, `${stay.id} overlaps in its room`).toBe(
            false
          );
        }
        byRoom.set(stay.roomId, [...(byRoom.get(stay.roomId) ?? []), { from, to }]);
      }
    }
  });
});

describe('Landing-Belegung — ein Gast, ein Zimmer', () => {
  it('legt keinen Gast in zwei Zimmer gleichzeitig, über 30 Fenster', () => {
    for (const windowStart of windows) {
      const { stays } = buildOccupancy({ houses: GROUP, windowStart, nights: NIGHTS });
      const byGuest = new Map<string, { from: number; to: number }[]>();
      for (const stay of stays) {
        const from = stay.firstNight.getTime();
        const to = stay.lastNight.getTime();
        const seen = byGuest.get(stay.guest) ?? [];
        for (const other of seen) {
          const overlaps = from <= other.to && to >= other.from;
          expect(
            overlaps,
            `${stay.guest} is in two rooms at once (window ${windowStart.toDateString()})`
          ).toBe(false);
        }
        seen.push({ from, to });
        byGuest.set(stay.guest, seen);
      }
    }
  });

  it('bleibt im Namensvorrat jedes Hauses', () => {
    // Die gemessene Zusage aus dem Kopf von occupancy.ts: 41 Namen je Haus,
    // und das gemessene Maximum liegt darunter. Bricht das, rotiert der Vorrat
    // und ein Gast steht zweimal im Raster.
    let mostStaysPerHouse = 0;
    for (const windowStart of windows) {
      const { stays, resources } = buildOccupancy({ houses: GROUP, windowStart, nights: NIGHTS });
      for (const house of GROUP) {
        const roomIds = new Set(
          resources.filter((room) => room.groupId === house.id).map((room) => room.id)
        );
        const count = stays.filter((stay) => roomIds.has(stay.roomId)).length;
        mostStaysPerHouse = Math.max(mostStaysPerHouse, count);
      }
    }
    expect(mostStaysPerHouse).toBeLessThanOrEqual(41);
  });
});

describe('Landing-Belegung — deterministisch, und je Fenster verschieden', () => {
  it('ergibt für dasselbe Fenster zweimal denselben Plan', () => {
    const a = buildOccupancy({ houses: GROUP, windowStart: ANCHOR, nights: NIGHTS });
    const b = buildOccupancy({ houses: GROUP, windowStart: ANCHOR, nights: NIGHTS });
    expect(JSON.stringify(b.stays)).toBe(JSON.stringify(a.stays));
  });

  it('ergibt für das nächste Fenster einen anderen Plan', () => {
    const a = buildOccupancy({ houses: GROUP, windowStart: ANCHOR, nights: NIGHTS });
    const next = new Date(ANCHOR);
    next.setDate(next.getDate() + NIGHTS);
    const b = buildOccupancy({ houses: GROUP, windowStart: next, nights: NIGHTS });
    // Nicht nur verschobene Daten: die Muster selbst müssen sich unterscheiden,
    // sonst zeigte die nächste Woche dieselbe Belegung.
    const shape = (stays: typeof a.stays) =>
      stays.map((stay) => `${stay.roomId}:${stay.lastNight.getTime() - stay.firstNight.getTime()}`);
    expect(shape(b.stays)).not.toEqual(shape(a.stays));
  });
});

describe('Landing-Belegung — die Spuren sind das Register', () => {
  it('macht eine Spur je Zimmer, das das Register nennt', () => {
    const { resources, groups } = buildOccupancy({
      houses: GROUP,
      windowStart: ANCHOR,
      nights: NIGHTS
    });
    const expected = GROUP.reduce(
      (sum, house) => sum + Object.values(house.stock).reduce((a, b) => a + b, 0),
      0
    );
    expect(resources).toHaveLength(expected);
    expect(groups.map((group) => group.id)).toEqual(GROUP.map((house) => house.id));
    // Jede Spur trägt einen Zimmertyp aus dem Register — die Farbe im Raster
    // kommt daraus, ein Tippfehler wäre ein farbloser Balken.
    const typeIds = new Set(ROOM_TYPES.map((type) => type.id));
    expect(resources.every((room) => typeIds.has(String(room.categoryId)))).toBe(true);
  });
});
