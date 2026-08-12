/**
 * Keyboard handler for the resource timeline (ARIA `grid` roving-tabindex).
 *
 * **Deliberately not `handleDateGridKeydown`.** That handler is date-only:
 * `ArrowUp`/`ArrowDown` move ∓7 days because its grid's vertical axis *is* the
 * week. Here the vertical axis is the resource lane, so Up/Down must change
 * lane at the same date — reusing the date-grid handler would silently jump a
 * week sideways instead. The two models cannot be merged; they disagree about
 * what "up" means.
 *
 * The window edges clamp rather than scroll: Left at column 0 stays put, and
 * PageUp/PageDown are the keys that move the window. Auto-navigating on an
 * arrow would re-anchor every column under the user's cursor for a one-column
 * move.
 */

/** The slice of the timeline surface the keyboard handler drives. */
export interface ResourceTimelineKeyboardTarget {
  /** Number of lanes (rows) currently rendered. */
  readonly laneCount: number;
  /** Number of day columns in the window. */
  readonly dayCount: number;
  /** Whether the whole grid is disabled. */
  readonly disabled: boolean;
  /** Current roving lane index. */
  readonly focusedLane: number;
  /** Current roving day-column index. */
  readonly focusedDay: number;
  /** Move the roving focus (already clamped by the handler). */
  focusCell: (lane: number, day: number) => void;
  /** Step the visible window by `delta` (− back, + forward). */
  navigateWindow: (delta: number) => void;
  /**
   * Activate the cell at `(lane, day)` — any span **covering** it (repeated
   * activation walks the stack), else the empty cell.
   */
  activateCell: (lane: number, day: number) => void;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

/**
 * Handle a keydown on a timeline cell. Returns `true` if the key was consumed
 * (and `preventDefault` was called), `false` to let it bubble.
 */
export function handleResourceTimelineKeydown(
  event: KeyboardEvent,
  target: ResourceTimelineKeyboardTarget
): boolean {
  if (target.disabled) return false;
  const lastLane = target.laneCount - 1;
  const lastDay = target.dayCount - 1;
  if (lastLane < 0 || lastDay < 0) return false;

  const lane = clamp(target.focusedLane, lastLane);
  const day = clamp(target.focusedDay, lastDay);

  switch (event.key) {
    case 'ArrowLeft':
      target.focusCell(lane, clamp(day - 1, lastDay));
      break;
    case 'ArrowRight':
      target.focusCell(lane, clamp(day + 1, lastDay));
      break;
    // The anti-regression: one LANE, not one week.
    case 'ArrowUp':
      target.focusCell(clamp(lane - 1, lastLane), day);
      break;
    case 'ArrowDown':
      target.focusCell(clamp(lane + 1, lastLane), day);
      break;
    case 'Home':
      // Ctrl+Home is the grid pattern's "first cell of the grid".
      target.focusCell(event.ctrlKey ? 0 : lane, 0);
      break;
    case 'End':
      target.focusCell(event.ctrlKey ? lastLane : lane, lastDay);
      break;
    case 'PageUp':
      target.navigateWindow(-1);
      break;
    case 'PageDown':
      target.navigateWindow(1);
      break;
    case 'Enter':
    case ' ':
      target.activateCell(lane, day);
      break;
    default:
      return false;
  }

  event.preventDefault();
  return true;
}
