import type { ToastData, ToastInput, ToastPromiseOptions, ToastShorthandOpts } from './index';
import type { ToastPlacement } from './toast.variants';

let counter = 0;
function uid() {
  return `toast-${++counter}-${Date.now()}`;
}

/**
 * Per-toast auto-dismiss bookkeeping. Instead of a bare `setTimeout` handle we
 * track how much time is left and when the current leg started, so the whole
 * stack can be frozen on hover/focus and later resumed *from the remaining
 * time* (Sonner-style) rather than restarted.
 */
interface ToastTimer {
  /** Active `setTimeout` handle, or `undefined` while frozen (paused, or armed during a pause). */
  handle: ReturnType<typeof setTimeout> | undefined;
  /** Milliseconds left to run when the current leg started — or the banked remainder while paused. */
  remaining: number;
  /** `Date.now()` when the running leg began; only meaningful while `handle` is set. */
  startedAt: number;
}

/**
 * Reactive store that manages the global toast queue.
 * Import the singleton `toaster` and call its methods from anywhere in the app.
 *
 * @example
 * ```typescript
 * import { toaster } from '@urbicon-ui/blocks';
 *
 * toaster.success('Saved!', { description: 'All changes applied.' });
 * ```
 */
class ToastStore {
  toasts = $state<ToastData[]>([]);
  placement = $state<ToastPlacement>('bottom-right');
  /**
   * Whether the whole visible stack is currently frozen because the pointer or
   * keyboard focus is inside the toaster region. Drives each progress bar's
   * `animation-play-state`; the auto-dismiss timers freeze together with it. Set
   * by `<Toaster>` via {@link pause} / {@link resume}.
   */
  paused = $state(false);

  private timers = new Map<string, ToastTimer>();
  private subscriberCount = 0;
  private hasWarnedNoSubscriber = false;

  /**
   * Called by `<Toaster>` on mount. Increments the active-subscriber count so
   * the store knows whether a renderer is present. Returns an unsubscribe fn.
   */
  registerSubscriber(): () => void {
    this.subscriberCount += 1;
    if (this.subscriberCount > 0) this.hasWarnedNoSubscriber = false;
    return () => {
      this.subscriberCount = Math.max(0, this.subscriberCount - 1);
    };
  }

  /**
   * Arm the auto-dismiss timer for `id` — or, if the stack is currently paused,
   * pre-register it frozen so it starts counting when the stack resumes.
   * Persistent toasts (`duration <= 0` or non-finite, e.g. `Infinity`, and the
   * loading leg of a promise toast) get no timer at all.
   */
  private armTimer(id: string, duration: number) {
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (this.paused) {
      // A toast that arrives while the user is hovering the stack starts frozen;
      // resume() lights its timer once the pointer/focus leaves.
      this.timers.set(id, { handle: undefined, remaining: duration, startedAt: 0 });
      return;
    }
    this.timers.set(id, {
      handle: setTimeout(() => this.dismiss(id), duration),
      remaining: duration,
      startedAt: Date.now()
    });
  }

  /** Cancel and forget the timer for `id` (if any). */
  private clearTimer(id: string) {
    const entry = this.timers.get(id);
    if (entry?.handle !== undefined) clearTimeout(entry.handle);
    this.timers.delete(id);
  }

  /** Create a toast with full control over all options. Returns the toast ID for programmatic dismissal. */
  add(input: ToastInput): string {
    if (
      this.subscriberCount === 0 &&
      !this.hasWarnedNoSubscriber &&
      typeof window !== 'undefined' &&
      import.meta.env?.DEV
    ) {
      this.hasWarnedNoSubscriber = true;
      console.warn(
        '[urbicon-ui] toaster.add() was called but no <Toaster /> is mounted. ' +
          'Toasts are queued in the store but never rendered. Mount <Toaster /> once ' +
          'in your root layout (e.g. +layout.svelte). This warning is shown only once per session.'
      );
    }

    const id = uid();
    const toast: ToastData = {
      id,
      intent: input.intent ?? 'neutral',
      title: input.title,
      description: input.description,
      duration: input.duration ?? 5000,
      dismissible: input.dismissible ?? true,
      showProgress: input.showProgress ?? true,
      action: input.action,
      cancel: input.cancel,
      loading: input.loading ?? false
    };
    this.toasts = [...this.toasts, toast];

    this.armTimer(id, toast.duration);

    return id;
  }

  /**
   * Merge new fields into an existing toast in place — same id, same stack
   * position — and reset its auto-dismiss timer to the new `duration`. No-op if
   * the toast is gone. Backs `promise()`, which flips a pending toast to
   * success/error without it sliding out and a new one flying in.
   */
  update(id: string, input: ToastInput) {
    const idx = this.toasts.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next: ToastData = { ...this.toasts[idx], ...input };
    this.toasts = [...this.toasts.slice(0, idx), next, ...this.toasts.slice(idx + 1)];

    // Reset the auto-dismiss clock to the new duration (respecting a current pause).
    this.clearTimer(id);
    this.armTimer(id, next.duration);
  }

  /**
   * Drive a toast through a promise's lifecycle (Sonner-style). Shows a
   * persistent, non-dismissible spinner toast while pending, then flips it in
   * place to success on resolve or danger on reject. `success`/`error` may be a
   * plain title, a full {@link ToastInput}, or a function of the resolved value
   * / rejection reason. Returns the toast id.
   *
   * @example
   * ```ts
   * toaster.promise(saveDraft(), {
   *   loading: 'Saving…',
   *   success: (draft) => `Saved “${draft.title}”`,
   *   error: (e) => `Could not save: ${e.message}`
   * });
   * ```
   */
  promise<T>(promise: Promise<T>, opts: ToastPromiseOptions<T>): string {
    const loadingInput: ToastInput =
      typeof opts.loading === 'string' ? { title: opts.loading } : opts.loading;
    const id = this.add({
      intent: 'neutral',
      ...loadingInput,
      loading: true,
      duration: 0,
      dismissible: false,
      showProgress: false
    });

    // Shared settle fields: leave the spinner/persistent/non-dismissible state
    // and become a normal auto-dismissing toast. `description: undefined` clears
    // the loading description unless the success/error config sets its own.
    const settled = {
      loading: false,
      duration: 5000,
      dismissible: true,
      showProgress: true
    } as const;
    // A throwing user formatter must not turn into an unhandled rejection on the
    // internal `.then`; fall back to a bare settled toast (still flips out of the
    // loading state) and dev-warn instead.
    const resolveMessage = <A>(
      fn: string | ToastInput | ((arg: A) => string | ToastInput),
      arg: A,
      label: string
    ): ToastInput | undefined => {
      let out: string | ToastInput | undefined;
      try {
        out = typeof fn === 'function' ? fn(arg) : fn;
      } catch (err) {
        if (import.meta.env?.DEV) console.warn(`[Toast] promise ${label} formatter threw:`, err);
      }
      return typeof out === 'string' ? { title: out } : out;
    };
    promise.then(
      (value) => {
        this.update(id, {
          intent: 'success',
          description: undefined,
          ...settled,
          ...resolveMessage(opts.success, value, 'success')
        });
      },
      (reason) => {
        this.update(id, {
          intent: 'danger',
          description: undefined,
          ...settled,
          ...resolveMessage(opts.error, reason, 'error')
        });
      }
    );

    return id;
  }

  /** Remove a single toast by ID. Clears its auto-dismiss timer. */
  dismiss(id: string) {
    this.clearTimer(id);
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  /** Remove all toasts, cancel their timers, and un-freeze the stack. */
  clear() {
    for (const entry of this.timers.values()) {
      if (entry.handle !== undefined) clearTimeout(entry.handle);
    }
    this.timers.clear();
    this.toasts = [];
    this.paused = false;
  }

  /**
   * Freeze the whole visible stack (Sonner-style hover-to-pause): cancel every
   * running auto-dismiss timer, banking the time each has left, and flag
   * {@link paused} so the progress bars stop. Idempotent — `<Toaster>` calls it
   * on pointer-enter / focus-in of the region. Persistent toasts and a promise's
   * loading leg have no timer and are untouched; the banked remainders are
   * restarted by {@link resume}.
   */
  pause() {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    for (const entry of this.timers.values()) {
      if (entry.handle === undefined) continue;
      clearTimeout(entry.handle);
      entry.remaining = Math.max(0, entry.remaining - (now - entry.startedAt));
      entry.handle = undefined;
    }
  }

  /**
   * Resume the stack: restart every frozen timer from its banked remaining time
   * (not from the full duration) and clear {@link paused} so the progress bars
   * run again. Idempotent — called on pointer-leave / focus-out of the region.
   */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    const now = Date.now();
    for (const [id, entry] of this.timers) {
      if (entry.handle !== undefined) continue;
      entry.startedAt = now;
      entry.handle = setTimeout(() => this.dismiss(id), entry.remaining);
    }
  }

  /** Shorthand for `add()` with `intent: 'info'`. Shows an info icon. */
  info(title: string, opts?: ToastShorthandOpts) {
    return this.add({ ...opts, title, intent: 'info' });
  }

  /** Shorthand for `add()` with `intent: 'success'`. Shows a check icon. */
  success(title: string, opts?: ToastShorthandOpts) {
    return this.add({ ...opts, title, intent: 'success' });
  }

  /** Shorthand for `add()` with `intent: 'warning'`. Shows a warning icon. */
  warning(title: string, opts?: ToastShorthandOpts) {
    return this.add({ ...opts, title, intent: 'warning' });
  }

  /** Shorthand for `add()` with `intent: 'danger'`. Shows an error icon. */
  danger(title: string, opts?: ToastShorthandOpts) {
    return this.add({ ...opts, title, intent: 'danger' });
  }
}

export const toaster = new ToastStore();
