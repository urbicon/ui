// The demo's grounding layer: a deterministic mock "salon backend" exposed to
// the model as an Anthropic tool. Purpose: the agent must ASK for real data
// (services, stylists, free slots) before building a booking surface, instead
// of hallucinating options. Pure TS — the SSE relay calls `executeSalonTool`,
// the unit tests call it directly.

/** Anthropic tool definitions the relay passes to `messages.stream`. */
export const SALON_TOOLS = [
  {
    name: 'get_salon_info',
    description:
      'Returns the salon services, stylists and, when a date (YYYY-MM-DD) is given, the free ' +
      'appointment slots per stylist for that date. ALWAYS call this before building a booking ' +
      'form or confirming an appointment — never invent services, stylists, prices or slots.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Requested date as YYYY-MM-DD. Omit to get services/stylists only.'
        }
      }
    }
  }
];

export interface SalonService {
  id: string;
  label: string;
  minutes: number;
  price: string;
}
export interface SalonStylist {
  id: string;
  name: string;
  /** ISO weekday numbers the stylist works (1 = Monday … 7 = Sunday). */
  workdays: number[];
}

const SERVICES: SalonService[] = [
  { id: 'cut', label: 'Haircut', minutes: 30, price: '34 €' },
  { id: 'cut-wash', label: 'Cut & Wash', minutes: 45, price: '42 €' },
  { id: 'cut-beard', label: 'Cut & Beard', minutes: 45, price: '46 €' },
  { id: 'kids', label: 'Kids Cut', minutes: 20, price: '19 €' }
];

const STYLISTS: SalonStylist[] = [
  { id: 'mira', name: 'Mira', workdays: [1, 2, 3, 4, 5] },
  { id: 'jonas', name: 'Jonas', workdays: [2, 3, 4, 5, 6] },
  { id: 'ayla', name: 'Ayla', workdays: [1, 3, 5, 6] }
];

/** All slots the salon could theoretically offer on a workday. */
const SLOT_GRID = ['09:00', '09:45', '10:30', '11:15', '13:00', '13:45', '14:30', '15:15', '16:00'];

/** Tiny deterministic string hash (FNV-1a) — stable mock availability, no RNG. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** ISO weekday (1 = Monday … 7 = Sunday) for a YYYY-MM-DD string, or null. */
function isoWeekday(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // JS Date rolls non-existent days over (2026-02-30 → March 2) — reject them
  // instead of silently answering for a different day.
  if (parsed.toISOString().slice(0, 10) !== date) return null;
  const day = parsed.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Deterministic free slots for one stylist on one date: every stylist keeps a
 * date-dependent subset of the grid (roughly half), so different dates really
 * show different availability without any randomness.
 */
function slotsFor(stylistId: string, date: string): string[] {
  return SLOT_GRID.filter((slot) => hash(`${stylistId}|${date}|${slot}`) % 5 < 3);
}

/**
 * Execute a salon tool call. Unknown tool names and malformed input fail loud
 * with an `error` field (relayed to the model as the tool result) instead of
 * throwing — the SSE stream must survive bad calls.
 */
export function executeSalonTool(name: string, input: unknown): Record<string, unknown> {
  if (name !== 'get_salon_info') {
    return { error: `Unknown tool "${name}"` };
  }
  const date =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>).date
      : undefined;

  const base: Record<string, unknown> = {
    salon: 'Urbicut Studio',
    services: SERVICES,
    stylists: STYLISTS.map(({ id, name: stylistName }) => ({ id, name: stylistName }))
  };

  if (date === undefined) return base;
  if (typeof date !== 'string') {
    return { ...base, error: 'date must be a YYYY-MM-DD string' };
  }
  const weekday = isoWeekday(date);
  if (weekday === null) {
    return { ...base, error: `"${date}" is not a valid YYYY-MM-DD date` };
  }
  if (weekday === 7) {
    return { ...base, date, availability: [], note: 'The salon is closed on Sundays.' };
  }
  return {
    ...base,
    date,
    availability: STYLISTS.map((stylist) => ({
      stylistId: stylist.id,
      name: stylist.name,
      slots: stylist.workdays.includes(weekday) ? slotsFor(stylist.id, date) : []
    }))
  };
}
