/**
 * Shared clipboard-copy interaction state.
 *
 * Three components ship a copy affordance — `CopyButton`, `CodeBlock` and
 * `ChatMessage` — and each had hand-rolled the same sequence: write to the
 * clipboard, flip a flag, start a revert timer, clear that timer on unmount,
 * expose a live region so the outcome is announced. Three copies of one
 * interaction drift, and they had: only `CopyButton` surfaced a FAILED copy at
 * all. The other two logged to the console and left the button looking idle, so
 * a user whose clipboard permission was denied got no feedback whatsoever.
 *
 * This module is that interaction, once. It owns the state machine and the timer;
 * the call site owns the chrome (icon, label, live region markup) and the
 * callbacks, because those legitimately differ — a labelled Button, a header
 * icon, a hover action bar.
 *
 * Call {@link createCopyState} during component initialisation: it registers an
 * `$effect` teardown so a pending revert timer can never fire into an unmounted
 * component, which is exactly the cleanup each call site used to repeat.
 *
 * Not a component and imports nothing from other component dirs, so it is exempt
 * from the cross-component import guard (imports-lint treats `internal/**` as the
 * extraction target) — which is the point: `CodeBlock` gets the shared behaviour
 * WITHOUT importing the public `CopyButton`, so no public-to-public edge is
 * created and no consumer bundle grows a `Button` it never asked for.
 */

/**
 * The button's copy phase: `'idle'` before a copy, `'copied'` after a successful
 * write, `'error'` on failure. `'error'` reverts on the same timer as `'copied'`.
 */
export type CopyPhase = 'idle' | 'copied' | 'error';

export interface CopyStateOptions {
  /**
   * Milliseconds before reverting to `idle`; `0` keeps the outcome pinned.
   * A getter, not a number, for the same reason the outcome is returned instead
   * of delivered by callback: the options object is built once at init, so a
   * plain `timeout` would freeze a reactive prop at its first value (the Svelte
   * compiler flags it as "only captures the initial value").
   * @default () => 2000
   */
  timeout?: () => number;
}

/**
 * Outcome of one copy attempt, returned rather than delivered through
 * callbacks. Callbacks would have to be captured when the state is created —
 * i.e. once, at component init — which silently pins whatever handler the
 * consumer passed on the first render (the Svelte compiler flags exactly this as
 * "only captures the initial value"). Returning the result lets each call site
 * read its own live props at the moment of the click.
 */
export type CopyResult = { ok: true } | { ok: false; error: unknown };

export interface CopyState {
  /** Current phase. Reactive — read it in `$derived` / markup. */
  readonly phase: CopyPhase;
  /** Write `value` to the clipboard and advance the phase. Never throws. */
  copy: (value: string) => Promise<CopyResult>;
}

export function createCopyState(options: CopyStateOptions = {}): CopyState {
  const readTimeout = options.timeout ?? (() => 2000);

  let phase = $state<CopyPhase>('idle');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function scheduleRevert() {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const ms = readTimeout();
    if (ms <= 0) return;
    timer = setTimeout(() => {
      phase = 'idle';
      timer = undefined;
    }, ms);
  }

  // Registered here rather than left to the call site: every previous copy of
  // this logic had to remember the same teardown, and a missed one leaks a timer
  // that fires into a torn-down component.
  $effect(() => () => {
    if (timer) clearTimeout(timer);
  });

  return {
    get phase() {
      return phase;
    },
    async copy(value: string): Promise<CopyResult> {
      let result: CopyResult;
      try {
        // Optional-chained on purpose: a non-secure context has no
        // `navigator.clipboard` at all, and reading `.writeText` off undefined
        // would throw a TypeError instead of reaching the error phase.
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
        await navigator.clipboard.writeText(value);
        phase = 'copied';
        result = { ok: true };
      } catch (error) {
        phase = 'error';
        result = { ok: false, error };
      }
      // The phase is settled and the revert armed BEFORE the caller runs its
      // callback, so a throwing consumer handler cannot leave the button stuck.
      scheduleRevert();
      return result;
    }
  };
}
