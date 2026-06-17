/**
 * Keyboard handler for the date grid (ARIA `grid` roving-tabindex pattern).
 *
 * Arrow keys move the roving focus by day/week; Home/End jump to the week edges;
 * PageUp/PageDown step a month (Shift = a year); Enter/Space select. All moves
 * go through the controller, which pulls the focus back into view by navigating
 * when it crosses the visible window.
 */

import { endOfWeek, startOfWeek } from '$lib/date';
import type { DateGridContext } from './date-grid.types';

/** The slice of the date-grid surface the keyboard handler drives. Both the
 * controller and its context satisfy it. */
export type DateGridKeyboardTarget = Pick<
  DateGridContext,
  'focusedDate' | 'weekStartsOn' | 'disabled' | 'moveFocus' | 'setFocusedDate' | 'selectDate'
>;

/** Add whole months to a date, clamping the day to the target month's length. */
function addMonths(date: Date, delta: number): Date {
  const targetDay = date.getDate();
  const firstOfTarget = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  const daysInTarget = new Date(
    firstOfTarget.getFullYear(),
    firstOfTarget.getMonth() + 1,
    0
  ).getDate();
  firstOfTarget.setDate(Math.min(targetDay, daysInTarget));
  return firstOfTarget;
}

/**
 * Handle a keydown on the grid. Returns `true` if the key was consumed (and
 * `preventDefault` was called), `false` to let it bubble.
 */
export function handleDateGridKeydown(
  event: KeyboardEvent,
  target: DateGridKeyboardTarget
): boolean {
  if (target.disabled) return false;
  const focused = target.focusedDate;
  const weekStartsOn = target.weekStartsOn;

  switch (event.key) {
    case 'ArrowLeft':
      target.moveFocus(-1);
      break;
    case 'ArrowRight':
      target.moveFocus(1);
      break;
    case 'ArrowUp':
      target.moveFocus(-7);
      break;
    case 'ArrowDown':
      target.moveFocus(7);
      break;
    case 'Home':
      target.setFocusedDate(startOfWeek(focused, weekStartsOn));
      break;
    case 'End':
      target.setFocusedDate(endOfWeek(focused, weekStartsOn));
      break;
    case 'PageUp':
      target.setFocusedDate(addMonths(focused, event.shiftKey ? -12 : -1));
      break;
    case 'PageDown':
      target.setFocusedDate(addMonths(focused, event.shiftKey ? 12 : 1));
      break;
    case 'Enter':
    case ' ':
      target.selectDate(focused);
      break;
    default:
      return false;
  }

  event.preventDefault();
  return true;
}
