import type { A2uiDataSchema } from '@urbicon-ui/blocks';

/**
 * The demo surface data schema — the data-model side of the A2UI contract. The
 * server documents it to the agent (`a2uiDataSchemaSection`) so bound inputs
 * target known paths; the client hands it to `A2UIView` so `updateDataModel`
 * writes are type-checked and any mismatch is relayed back as a `[ui-error]`.
 * Only used in the Urbicon-catalog mode.
 */
export const BOOKING_SCHEMA: A2uiDataSchema = {
  '/name': { type: 'string', description: 'The guest name' },
  '/service': { type: 'string', description: 'The chosen service id (from get_salon_info)' },
  '/stylist': { type: 'string', description: 'The chosen stylist id (from get_salon_info)' },
  '/date': { type: 'string', format: 'date', description: 'Appointment date, YYYY-MM-DD' },
  '/time': { type: 'string', format: 'time', description: 'Appointment time, HH:MM' },
  '/party': { type: 'integer', description: 'Number of guests (1 or more)' },
  '/notes': { type: 'string', description: 'Optional free-text notes' },
  '/agreed': { type: 'boolean', description: 'Consent to the cancellation policy' }
};
