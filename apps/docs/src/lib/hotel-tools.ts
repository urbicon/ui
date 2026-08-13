// The demo's grounding layer: a deterministic mock "hotel backend" exposed to
// the model as Anthropic tools. Purpose: the agent must ASK for real data
// (houses, room types, what is actually free for a date range) before building
// a booking surface, instead of hallucinating options — and must ASK to book
// rather than narrating that it did. Pure TS — the recorder calls
// `executeHotelTool` inside its tool loop, the unit tests call it directly.
//
// Nothing here persists: both tools derive their answer from their input, so a
// replay cannot drift from the fixture it was recorded against, and no stay is
// ever actually held.
//
// The fiction: FERMATA, a group of three small houses named after the piece of
// landscape each one stands in, in the language of its place — Cala (cove,
// Menorca), Firn (old snow, Engadin), Duna (dune, Comporta). A fermata is the
// mark a musician holds a note under for longer than written; the group books
// quiet, not glamour. (A fourth house, Mori/Kyoto, was cut on 2026-08-10
// together with its pillar layout: three houses with strong imagery beat four
// where one dilutes.)
//
// Scope note (2026-08-10, the salon universe's scale cut is retired): unlike
// `get_salon_info`, which knew only the flagship while the landing told a
// four-house story, THIS tool knows the whole group — houses, rooms, stock and
// availability. Landing dashboard, full page and recorded conversation all
// read the same registry, so the fiction has one source instead of a house
// level and a group level that must be kept from drifting.

/** Anthropic tool definitions the recorder passes to `messages.stream`. */
export const HOTEL_TOOLS = [
  {
    name: 'get_hotel_info',
    description:
      'Returns the Fermata group: its houses, their room types with nightly rates and, when ' +
      'a date range (checkIn/checkOut, YYYY-MM-DD) is given, how many rooms of each type are ' +
      'free in each house for every night of the stay. ALWAYS call this before building a ' +
      'booking form — never invent houses, room types, rates or availability. To CONFIRM a ' +
      'stay use create_booking, which re-checks availability itself; calling this one first ' +
      'is redundant.',
    input_schema: {
      type: 'object' as const,
      properties: {
        checkIn: {
          type: 'string',
          description: 'Arrival date as YYYY-MM-DD. Omit to get houses and rates only.'
        },
        checkOut: {
          type: 'string',
          description: 'Departure date as YYYY-MM-DD. Required when checkIn is given.'
        }
      }
    }
  },
  {
    name: 'create_booking',
    description:
      'Confirms a stay and returns its booking reference and total. Re-checks availability and ' +
      'refuses if the room is gone. The reference, the total and the `note` come BACK from this ' +
      'call — never invent them, and quote the note to the guest. Call this only once the guest ' +
      'has pressed the booking button on the surface.',
    input_schema: {
      type: 'object' as const,
      properties: {
        house: { type: 'string', description: 'House id from get_hotel_info.' },
        room: { type: 'string', description: 'Room type id from get_hotel_info.' },
        checkIn: { type: 'string', description: 'Arrival date as YYYY-MM-DD.' },
        checkOut: { type: 'string', description: 'Departure date as YYYY-MM-DD.' },
        guests: { type: 'integer', description: 'Number of guests (1 or more).' },
        name: { type: 'string', description: 'Name the stay is booked under.' }
      },
      required: ['house', 'room', 'checkIn', 'checkOut', 'name']
    }
  }
];

/** One bookable room category — the group prices per type, not per house. */
export interface HotelRoomType {
  id: string;
  label: string;
  /** Nightly rate in EUR. A number so maths stays on the value; € is display. */
  price: number;
  /** What the type means, in the words a front desk would use. */
  line: string;
}

export interface HotelHost {
  name: string;
  status?: 'online' | 'busy';
}

export interface HotelHouse {
  id: string;
  name: string;
  /** Where the house stands — island, valley, dune field. */
  place: string;
  /** Three short facts the full page shows beside the hosts. No prose lede —
   * the marketing sentence each house used to carry was cut on request
   * (2026-08-10); the image and the facts say it better. */
  facts: [string, string, string];
  /** Rooms of each type the house physically has; their sum is the house size. */
  stock: Record<string, number>;
  /** The people who run the house — landing dashboard + full page. */
  hosts: HotelHost[];
}

/** The group's name — page mastheads and the agent's grounding read the same value. */
export const GROUP_NAME = 'Fermata';

/**
 * One price sheet for the whole group. The four types are deliberately the
 * same cardinality as the landing's revenue mix, the Sankey's last tier and
 * the arrivals table's colour legend — one vocabulary, four consumers, and
 * any drift between them would be visible arithmetic.
 */
export const ROOM_TYPES: HotelRoomType[] = [
  { id: 'room', label: 'Room', price: 240, line: 'A bed, a chair, a window that opens' },
  { id: 'garden', label: 'Garden Room', price: 300, line: 'Ground floor, doors to the green' },
  { id: 'corner', label: 'Corner Room', price: 360, line: 'Light from two sides' },
  { id: 'suite', label: 'Suite', price: 520, line: 'A room to sleep in, a room to sit in' }
];

export const HOUSES: HotelHouse[] = [
  {
    id: 'cala',
    name: 'Cala',
    place: 'Menorca',
    facts: ['14 rooms', 'the bay at 40 m', 'open Apr — Oct'],
    stock: { room: 6, garden: 4, corner: 2, suite: 2 },
    hosts: [
      { name: 'Núria Pons', status: 'online' },
      { name: 'Biel Serra', status: 'online' },
      { name: 'Aina Camps', status: 'busy' }
    ]
  },
  {
    id: 'firn',
    name: 'Firn',
    place: 'Engadin',
    facts: ['9 rooms', '1,850 m', 'open all year'],
    stock: { room: 4, garden: 2, corner: 2, suite: 1 },
    hosts: [{ name: 'Gian Caduff', status: 'online' }, { name: 'Ladina Planta' }]
  },
  {
    id: 'duna',
    name: 'Duna',
    place: 'Comporta',
    facts: ['16 rooms', 'the ocean past the dunes', 'open Mar — Nov'],
    stock: { room: 7, garden: 4, corner: 3, suite: 2 },
    hosts: [
      { name: 'Inês Camacho', status: 'online' },
      { name: 'Tomás Varela', status: 'busy' }
    ]
  }
];

export function houseById(id: string | null | undefined): HotelHouse | undefined {
  return HOUSES.find((house) => house.id === id);
}

/** Tiny deterministic string hash (FNV-1a) — stable mock availability, no RNG. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Parse a YYYY-MM-DD string to a UTC-noon Date, or null if it is not a real day. */
function parseIsoDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // JS Date rolls non-existent days over (2026-02-30 → March 2) — reject them
  // instead of silently answering for a different day.
  if (parsed.toISOString().slice(0, 10) !== date) return null;
  return parsed;
}

const NIGHT_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD of `date` plus `nights` days. */
function plusNights(date: Date, nights: number): string {
  return new Date(date.getTime() + nights * NIGHT_MS).toISOString().slice(0, 10);
}

/**
 * Deterministic free count for one room type in one house on one night:
 * a date-dependent share of the stock, so different stays really show
 * different availability without any randomness. Small stock runs out first —
 * suites are genuinely scarce.
 */
function freeOnNight(houseId: string, roomId: string, night: string, stock: number): number {
  return hash(`${houseId}|${roomId}|${night}`) % (stock + 1);
}

/**
 * Rooms of one type bookable for a whole stay = the minimum free count across
 * its nights. One sold-out night sells out the stay, which is how hotels work.
 */
function freeForStay(houseId: string, roomId: string, checkIn: Date, nights: number): number {
  const stock = houseById(houseId)?.stock[roomId] ?? 0;
  let free = stock;
  for (let n = 0; n < nights; n++) {
    free = Math.min(free, freeOnNight(houseId, roomId, plusNights(checkIn, n), stock));
    if (free === 0) return 0;
  }
  return free;
}

/**
 * Execute a hotel tool call. Unknown tool names and malformed input fail loud
 * with an `error` field (relayed to the model as the tool result) instead of
 * throwing — the recording stream must survive bad calls.
 */
export function executeHotelTool(name: string, input: unknown): Record<string, unknown> {
  const params =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  if (name === 'get_hotel_info') return getHotelInfo(params);
  if (name === 'create_booking') return createBooking(params);
  return { error: `Unknown tool "${name}"` };
}

function getHotelInfo(params: Record<string, unknown>): Record<string, unknown> {
  const { checkIn, checkOut } = params;

  const base: Record<string, unknown> = {
    group: GROUP_NAME,
    roomTypes: ROOM_TYPES.map(({ id, label, price }) => ({ id, label, pricePerNight: price })),
    houses: HOUSES.map(({ id, name: houseName, place }) => ({ id, name: houseName, place }))
  };

  if (checkIn === undefined && checkOut === undefined) return base;
  if (typeof checkIn !== 'string' || typeof checkOut !== 'string') {
    return { ...base, error: 'checkIn and checkOut must both be YYYY-MM-DD strings' };
  }
  const arrival = parseIsoDate(checkIn);
  const departure = parseIsoDate(checkOut);
  if (arrival === null || departure === null) {
    return {
      ...base,
      error: `"${arrival === null ? checkIn : checkOut}" is not a valid YYYY-MM-DD date`
    };
  }
  const nights = Math.round((departure.getTime() - arrival.getTime()) / NIGHT_MS);
  if (nights < 1) {
    return { ...base, error: 'checkOut must be at least one night after checkIn' };
  }

  return {
    ...base,
    checkIn,
    checkOut,
    nights,
    availability: HOUSES.map((house) => ({
      houseId: house.id,
      name: house.name,
      place: house.place,
      rooms: ROOM_TYPES.map((room) => ({
        roomId: room.id,
        label: room.label,
        pricePerNight: room.price,
        free: freeForStay(house.id, room.id, arrival, nights)
      })).filter((room) => room.free > 0)
    }))
  };
}

/**
 * The write half of the fiction.
 *
 * It exists because the agent loop was a lie at its last step: with only a read
 * tool, "Booked — €900 total" was the model doing arithmetic in prose. Now the
 * reference and the total come back from a call, which is the pattern the demo
 * is there to show — and which `get_hotel_info` already insists on for
 * everything else ("never invent … rates or availability").
 *
 * Nothing is written anywhere. The booking is derived from its own input, so
 * the same stay always yields the same reference and availability is unchanged
 * afterwards — a recording plays once, and a demo that accumulated state would
 * drift away from its fixture on every replay.
 */
function createBooking(params: Record<string, unknown>): Record<string, unknown> {
  const { house: houseId, room: roomId, checkIn, checkOut, name: guestName, guests } = params;

  if (typeof houseId !== 'string' || typeof roomId !== 'string') {
    return { error: 'house and room must both be ids from get_hotel_info' };
  }
  const house = houseById(houseId);
  const room = ROOM_TYPES.find((type) => type.id === roomId);
  if (!house) return { error: `"${houseId}" is not a house of ${GROUP_NAME}` };
  if (!room) return { error: `"${roomId}" is not a room type of ${GROUP_NAME}` };

  if (typeof guestName !== 'string' || guestName.trim() === '') {
    return { error: 'name is required — a stay is booked under someone' };
  }
  if (typeof checkIn !== 'string' || typeof checkOut !== 'string') {
    return { error: 'checkIn and checkOut must both be YYYY-MM-DD strings' };
  }
  const arrival = parseIsoDate(checkIn);
  const departure = parseIsoDate(checkOut);
  if (arrival === null || departure === null) {
    return { error: `"${arrival === null ? checkIn : checkOut}" is not a valid YYYY-MM-DD date` };
  }
  const nights = Math.round((departure.getTime() - arrival.getTime()) / NIGHT_MS);
  if (nights < 1) return { error: 'checkOut must be at least one night after checkIn' };
  if (
    guests !== undefined &&
    (typeof guests !== 'number' || !Number.isInteger(guests) || guests < 1)
  ) {
    return { error: 'guests must be a whole number of at least 1' };
  }

  // The same check the form was built from — a stay can sell out between the
  // question and the answer, and a booking tool that skips its own backend's
  // availability is the bug this whole tool exists to remove.
  if (freeForStay(house.id, room.id, arrival, nights) < 1) {
    return {
      error: `No ${room.label} is free at ${house.name} for every night of ${checkIn} — ${checkOut}`,
      house: house.name,
      roomType: room.label
    };
  }

  return {
    // `DEMO-` is load-bearing, not decoration: this string is the one thing a
    // visitor is likely to keep from the exchange, and it is quoted on the
    // confirmation card. A reference that read like a real one would undo the
    // banner and the notice the page carries.
    reference: `DEMO-${hash(`${house.id}|${room.id}|${checkIn}|${checkOut}|${guestName.trim()}`)
      .toString(36)
      .toUpperCase()
      .padStart(7, '0')}`,
    guest: guestName.trim(),
    guests: typeof guests === 'number' ? guests : 1,
    house: house.name,
    place: house.place,
    roomType: room.label,
    checkIn,
    checkOut,
    nights,
    pricePerNight: room.price,
    total: room.price * nights,
    currency: 'EUR',
    // Handed to the model rather than kept on the page, so the fiction is
    // stated by the front desk itself instead of being edited into a recording
    // afterwards. The tool description tells it to quote this.
    note: 'This is a demonstration of an AI-generated interface. No reservation exists, no confirmation will be sent, and no payment is due.'
  };
}
