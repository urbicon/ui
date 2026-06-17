import type { ToastData, ToastInput, ToastShorthandOpts } from './index';
import type { ToastPlacement } from './toast.variants';

let counter = 0;
function uid() {
  return `toast-${++counter}-${Date.now()}`;
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

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
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
      showProgress: input.showProgress ?? true
    };
    this.toasts = [...this.toasts, toast];

    if (toast.duration > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), toast.duration)
      );
    }

    return id;
  }

  /** Remove a single toast by ID. Clears its auto-dismiss timer. */
  dismiss(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  /** Remove all toasts and cancel their timers. */
  clear() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toasts = [];
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
