import { describe, expect, it } from 'vitest';
import { executeHotelTool, HOTEL_TOOLS, HOUSES, ROOM_TYPES } from './hotel-tools';

describe('executeHotelTool', () => {
  it('returns houses and room types without a date range', () => {
    const out = executeHotelTool('get_hotel_info', {});
    expect(Array.isArray(out.houses)).toBe(true);
    expect(Array.isArray(out.roomTypes)).toBe(true);
    expect(out.availability).toBeUndefined();
    expect(out.error).toBeUndefined();
  });

  it('returns per-house availability for a stay, deterministically', () => {
    const first = executeHotelTool('get_hotel_info', {
      checkIn: '2026-09-03',
      checkOut: '2026-09-06'
    });
    const second = executeHotelTool('get_hotel_info', {
      checkIn: '2026-09-03',
      checkOut: '2026-09-06'
    });
    expect(second).toEqual(first);

    expect(first.nights).toBe(3);
    const availability = first.availability as Array<{
      houseId: string;
      rooms: Array<{ roomId: string; free: number }>;
    }>;
    expect(availability).toHaveLength(3);
    // Sold-out types are dropped, so every listed room is actually bookable.
    for (const house of availability) {
      for (const room of house.rooms) expect(room.free).toBeGreaterThan(0);
    }
    // At least one house has something free for the recorded fixture's stay.
    expect(availability.some((house) => house.rooms.length > 0)).toBe(true);
  });

  it('never offers more rooms than a house physically has', () => {
    const out = executeHotelTool('get_hotel_info', {
      checkIn: '2026-09-03',
      checkOut: '2026-09-10'
    });
    const availability = out.availability as Array<{
      houseId: string;
      rooms: Array<{ roomId: string; free: number }>;
    }>;
    for (const entry of availability) {
      const house = HOUSES.find((h) => h.id === entry.houseId);
      expect(house).toBeDefined();
      for (const room of entry.rooms) {
        expect(room.free).toBeLessThanOrEqual(house?.stock[room.roomId] ?? 0);
      }
    }
  });

  it('tightens availability as the stay grows (a stay is the minimum over its nights)', () => {
    const freeFor = (checkOut: string) => {
      const out = executeHotelTool('get_hotel_info', { checkIn: '2026-09-03', checkOut });
      const availability = out.availability as Array<{
        houseId: string;
        rooms: Array<{ roomId: string; free: number }>;
      }>;
      return (houseId: string, roomId: string) =>
        availability.find((h) => h.houseId === houseId)?.rooms.find((r) => r.roomId === roomId)
          ?.free ?? 0;
    };
    const oneNight = freeFor('2026-09-04');
    const week = freeFor('2026-09-10');
    for (const house of HOUSES) {
      for (const room of ROOM_TYPES) {
        expect(week(house.id, room.id)).toBeLessThanOrEqual(oneNight(house.id, room.id));
      }
    }
  });

  it('fails loud (error field, no throw) on bad input and unknown tools', () => {
    expect(
      executeHotelTool('get_hotel_info', { checkIn: 'tomorrow', checkOut: '2026-09-06' }).error
    ).toBeTruthy();
    expect(executeHotelTool('get_hotel_info', { checkIn: '2026-09-03' }).error).toBeTruthy();
    expect(executeHotelTool('get_hotel_info', { checkIn: 42, checkOut: 43 }).error).toBeTruthy();
    expect(executeHotelTool('get_hotel_info', null).availability).toBeUndefined();
    expect(executeHotelTool('drop_tables', {}).error).toBeTruthy();
  });

  it('rejects a checkOut on or before checkIn', () => {
    expect(
      executeHotelTool('get_hotel_info', { checkIn: '2026-09-03', checkOut: '2026-09-03' }).error
    ).toBeTruthy();
    expect(
      executeHotelTool('get_hotel_info', { checkIn: '2026-09-06', checkOut: '2026-09-03' }).error
    ).toBeTruthy();
  });

  it('rejects non-existent calendar days instead of letting JS Date roll them over', () => {
    // new Date('2026-02-30…') silently becomes March 2 — the tool must not
    // answer for a different stay than it was asked about.
    expect(
      executeHotelTool('get_hotel_info', { checkIn: '2026-02-30', checkOut: '2026-03-04' }).error
    ).toBeTruthy();
    expect(
      executeHotelTool('get_hotel_info', { checkIn: '2026-04-28', checkOut: '2026-04-31' }).error
    ).toBeTruthy();
    // A real leap day stays valid.
    expect(
      executeHotelTool('get_hotel_info', { checkIn: '2028-02-28', checkOut: '2028-03-01' }).error
    ).toBeUndefined();
  });

  it('keeps every house size equal to the sum of its room stock', () => {
    // The "N rooms" fact is display, the stock is data — they must agree, or
    // the full page claims a size the availability can never reach.
    for (const house of HOUSES) {
      const size = Object.values(house.stock).reduce((a, b) => a + b, 0);
      expect(house.facts[0]).toBe(`${size} rooms`);
    }
  });

  it('exposes exactly the tools the recorder advertises', () => {
    expect(HOTEL_TOOLS.map((tool) => tool.name)).toEqual(['get_hotel_info', 'create_booking']);
  });
});

describe('create_booking', () => {
  /** A stay the availability hash leaves free — the fixture's own three nights. */
  const STAY = {
    house: 'cala',
    room: 'garden',
    checkIn: '2026-09-03',
    checkOut: '2026-09-06',
    guests: 2,
    name: 'Marlowe'
  };

  it('books a free stay and prices it from the group sheet', () => {
    const out = executeHotelTool('create_booking', STAY);
    expect(out.error).toBeUndefined();
    expect(out.nights).toBe(3);
    expect(out.pricePerNight).toBe(300);
    expect(out.total).toBe(900);
    expect(out.house).toBe('Cala');
    expect(out.guest).toBe('Marlowe');
  });

  it('marks the reference as a demo, so the confirmation card cannot read as real', () => {
    const out = executeHotelTool('create_booking', STAY);
    expect(out.reference).toMatch(/^DEMO-[0-9A-Z]{7}$/);
    expect(String(out.note)).toMatch(/No reservation exists/);
  });

  it('is deterministic and holds nothing — the same stay books identically twice', () => {
    const first = executeHotelTool('create_booking', STAY);
    const second = executeHotelTool('create_booking', STAY);
    expect(second).toEqual(first);
    // And availability is untouched by a booking, which is what keeps a replay
    // agreeing with the fixture it was recorded against.
    const after = executeHotelTool('get_hotel_info', {
      checkIn: STAY.checkIn,
      checkOut: STAY.checkOut
    });
    expect(after).toEqual(
      executeHotelTool('get_hotel_info', { checkIn: STAY.checkIn, checkOut: STAY.checkOut })
    );
  });

  it('gives a different reference to a different stay', () => {
    const a = executeHotelTool('create_booking', STAY);
    const b = executeHotelTool('create_booking', { ...STAY, name: 'Rey' });
    expect(b.reference).not.toBe(a.reference);
  });

  it('refuses a room that is not free for every night of the stay', () => {
    // Walk the room types until the hash sells one out for this stay, so the
    // refusal path is exercised against the real availability rule rather than
    // a hand-picked constant that a stock change could quietly make free.
    const soldOut = ROOM_TYPES.map((room) => room.id).find((room) => {
      const info = executeHotelTool('get_hotel_info', {
        checkIn: '2026-09-03',
        checkOut: '2026-09-10'
      });
      const house = (
        info.availability as Array<{ houseId: string; rooms: Array<{ roomId: string }> }>
      ).find((entry) => entry.houseId === 'cala');
      return !house?.rooms.some((entry) => entry.roomId === room);
    });
    expect(soldOut).toBeDefined();

    const out = executeHotelTool('create_booking', {
      ...STAY,
      room: soldOut,
      checkOut: '2026-09-10'
    });
    expect(String(out.error)).toMatch(/free/);
    expect(out.reference).toBeUndefined();
  });

  it('fails loud on an unknown house, room, name or date instead of booking something else', () => {
    expect(String(executeHotelTool('create_booking', { ...STAY, house: 'mori' }).error)).toMatch(
      /not a house/
    );
    expect(String(executeHotelTool('create_booking', { ...STAY, room: 'attic' }).error)).toMatch(
      /not a room type/
    );
    expect(String(executeHotelTool('create_booking', { ...STAY, name: '  ' }).error)).toMatch(
      /name is required/
    );
    expect(
      String(executeHotelTool('create_booking', { ...STAY, checkIn: '2026-02-30' }).error)
    ).toMatch(/not a valid/);
    expect(
      String(executeHotelTool('create_booking', { ...STAY, checkOut: STAY.checkIn }).error)
    ).toMatch(/at least one night/);
    expect(String(executeHotelTool('create_booking', { ...STAY, guests: 0 }).error)).toMatch(
      /at least 1/
    );
  });
});
