import fixture from './booking-fixture.json';

/**
 * Replays a recorded agent exchange.
 *
 * The hotel page is a claim about *design* — one agent payload, three houses —
 * so it must not be hostage to an API key, a network hop, or which way the
 * model felt like phrasing things today. What it plays back is real recorded
 * model output, not hand-written UI — captured by
 * `apps/docs/scripts/record-fixture.ts`, which runs the same tool loop a live
 * relay would (Anthropic stream + `executeHotelTool`) and writes the frames
 * verbatim; the fixture is the versioned truth. To re-record, run that script
 * with `ANTHROPIC_API_KEY` set.
 *
 * Frames come back shaped exactly like `streamSse` yields them (`data` as a
 * JSON string), so the page consumes a replay and a live stream with the same
 * loop — the transport is swapped, nothing downstream knows.
 */

interface RecordedFrame {
  event: string;
  data: unknown;
}
export interface RecordedTurn {
  wire: string;
  display?: string;
  frames: RecordedFrame[];
}

export const TURNS = (fixture as { turns: RecordedTurn[] }).turns;

/** The opening prompt, offered as a suggestion chip. */
export const OPENING_PROMPT = TURNS[0]?.wire ?? '';

const UI_ACTION_PREFIX = '[ui-action] ';

/**
 * Action name → the turn recorded as the agent's answer to THAT action.
 *
 * The recording is a sequence, but the surface is not: nothing stops a visitor
 * from pressing the primary button without pressing "Check availability"
 * first. Advancing a cursor on every press then answers a click that never
 * happened — the transcript showed a `book` press followed by an availability
 * re-check, because that was simply the next turn in line. Keyed by the action
 * the recorder actually sent, each answer stays attached to its own press.
 */
export const TURN_BY_ACTION: ReadonlyMap<string, number> = new Map(
  TURNS.flatMap((turn, index): [string, number][] => {
    if (!turn.wire.startsWith(UI_ACTION_PREFIX)) return [];
    try {
      const { name } = JSON.parse(turn.wire.slice(UI_ACTION_PREFIX.length)) as { name?: string };
      return typeof name === 'string' ? [[name, index]] : [];
    } catch {
      // A wire line that does not parse is a broken recording, not a runtime
      // error — the turn stays reachable in sequence, it just has no action key.
      return [];
    }
  })
);

export interface ReplayOptions {
  signal?: AbortSignal;
  /**
   * Per-token delay in ms. The recording carries no timings of its own — the
   * SDK delivers text in uneven bursts that replay as stutter rather than as
   * typing, so cadence is synthesised here where it can be tuned.
   */
  tokenDelay?: number;
  /** Pause while a tool call is on screen, so the card is readable. */
  toolDelay?: number;
  /**
   * Skip every delay and settle in one pass — for a tile that must already show
   * the finished surface when it scrolls into view.
   *
   * This is NOT a shortcut past the pipeline: the same frames go through the
   * same splitter, router and renderer, so what you see is live UI with real
   * components, not a snapshot. Only the waiting is removed. A `setTimeout(0)`
   * per frame would not do — after five nested timers browsers clamp to ~4ms,
   * which is a visible quarter-second of self-assembly on a page the visitor
   * did not ask to watch.
   */
  instant?: boolean;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Yield one recorded turn's frames with a playback cadence.
 *
 * @param index which turn to play (0 = the opening request)
 */
export async function* replayTurn(
  index: number,
  { signal, tokenDelay = 12, toolDelay = 900, instant = false }: ReplayOptions = {}
): AsyncGenerator<{ event: string; data: string }> {
  const turn = TURNS[index];
  if (!turn) return;

  for (const frame of turn.frames) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!instant) {
      if (frame.event === 'token') {
        await sleep(tokenDelay, signal);
      } else if (frame.event === 'tool_result') {
        await sleep(toolDelay, signal);
      }
    }
    yield { event: frame.event, data: JSON.stringify(frame.data) };
  }
}
