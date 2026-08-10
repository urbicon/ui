import type { A2uiDataSchema } from '@urbicon-ui/blocks';

/**
 * The demo surface data schema — the data-model side of the A2UI contract. The
 * recorder documents it to the agent (`a2uiDataSchemaSection`) so bound inputs
 * target known paths; the client hands it to `A2UIView` so `updateDataModel`
 * writes are type-checked and any mismatch is relayed back as a `[ui-error]`.
 * Only used in the Urbicon-catalog mode.
 */
export const BOOKING_SCHEMA: A2uiDataSchema = {
  '/name': { type: 'string', description: 'The guest name' },
  // House / room are chosen with a Select, whose value is a string ARRAY
  // (single-select writes a one-element array) — declare them as arrays so a
  // bound write type-checks. Use RadioGroup instead to bind a single string.
  '/house': { type: 'array', description: 'Chosen house id(s) (from get_hotel_info)' },
  '/room': { type: 'array', description: 'Chosen room type id(s) (from get_hotel_info)' },
  '/checkIn': { type: 'string', format: 'date', description: 'Arrival date, YYYY-MM-DD' },
  '/checkOut': { type: 'string', format: 'date', description: 'Departure date, YYYY-MM-DD' },
  '/guests': { type: 'integer', description: 'Number of guests (1 or more)' },
  '/notes': { type: 'string', description: 'Optional free-text notes' },
  '/agreed': { type: 'boolean', description: 'Consent to the cancellation policy' },
  // The multi-step slot: empty until the user asks what is free (an action),
  // then patched with what get_hotel_info returned for that stay. Declared so
  // the fetch-then-patch flow writes to a KNOWN path instead of warning.
  '/options': {
    type: 'array',
    description: 'Bookable rooms for the chosen dates/house, filled in by updateDataModel'
  }
};
