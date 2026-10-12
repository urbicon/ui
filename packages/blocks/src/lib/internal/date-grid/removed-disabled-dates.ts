/**
 * Calendar, DatePicker, DateRangePicker and Planner no longer take
 * `disabledDates`. Written as an attribute it is a type error; passed through a
 * spread it type-checks, lands on the root element and disables nothing, so the
 * days it closed become selectable again without a word.
 *
 * Call it under `import.meta.env?.DEV`: a production build then drops the call,
 * and with it this module.
 */
export function warnRemovedDisabledDates(component: string, rest: object): void {
  if (typeof window === 'undefined' || !('disabledDates' in rest)) return;
  console.warn(
    `[${component}] disabledDates was removed and disables nothing. Pass ` +
      'isDateDisabled={(d) => blocked.has(toIso(d))}, with blocked = new Set(list.map(toIso)) ' +
      "and toIso from '@urbicon-ui/blocks/date'."
  );
}
