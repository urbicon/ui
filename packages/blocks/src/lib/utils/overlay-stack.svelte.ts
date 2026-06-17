import { untrack } from 'svelte';

/**
 * Central registry for open modal overlays (Dialog, Drawer, Sidebar).
 *
 * The browser already handles top-layer stacking and ESC-to-close for native
 * `<dialog>` elements. This stack adds three things on top of that:
 *
 * 1. **Programmatic close-all** — useful on logout, route changes, or auth
 *    expiry, where leaving stacked modals open creates UX confusion.
 * 2. **Inspection** — `depth` and `topId` for tests, debug overlays, or
 *    conditional UI logic (e.g. "hide the help-tooltip while a Drawer is
 *    open").
 * 3. **Stack-aware close-top** — `closeTop()` resolves the most recently
 *    registered overlay regardless of which component owns it.
 *
 * Each overlay registers itself on open with a `close` callback and
 * deregisters on close. Registration is keyed by an opaque ID — typically
 * generated via `crypto.randomUUID()` so multiple instances of the same
 * component type can coexist in the stack.
 *
 * @example
 * ```ts
 * // Inside a Drawer / Dialog / Sidebar component:
 * $effect(() => {
 *   if (!open) return;
 *   const id = crypto.randomUUID();
 *   return overlayStack.register(id, () => { open = false; });
 * });
 * ```
 *
 * @example
 * ```ts
 * // App-level: close everything on logout
 * import { overlayStack } from '@urbicon-ui/blocks';
 *
 * function logout() {
 *   overlayStack.closeAll();
 *   goto('/login');
 * }
 * ```
 */
class OverlayStack {
  /** Internal entry list. Reactive so consumers can derive UI from `depth`. */
  private entries = $state<Array<{ id: string; close: () => void }>>([]);

  /**
   * Register an open overlay. Returns an unregister function — store it as
   * the cleanup of an `$effect` so the entry is removed when the overlay
   * closes or the component unmounts.
   *
   * Reads of `entries` are wrapped in `untrack` so callers calling this from
   * within an `$effect` don't accidentally subscribe to the entries list —
   * otherwise the write below would re-trigger the calling effect on every
   * registration, producing `effect_update_depth_exceeded`.
   */
  register(id: string, close: () => void): () => void {
    this.entries = [...untrack(() => this.entries), { id, close }];
    return () => this.unregister(id);
  }

  /** Remove an overlay from the stack without invoking its close callback. */
  unregister(id: string): void {
    this.entries = untrack(() => this.entries).filter((e) => e.id !== id);
  }

  /**
   * Invoke the close callback of every registered overlay, top-down. Each
   * callback is responsible for unregistering itself (typically by setting
   * `open = false` and letting the `$effect`-cleanup run).
   */
  closeAll(): void {
    // Snapshot in case callbacks mutate the stack.
    const snapshot = [...this.entries].reverse();
    for (const entry of snapshot) entry.close();
  }

  /** Close only the topmost overlay. No-op if the stack is empty. */
  closeTop(): void {
    const top = this.entries[this.entries.length - 1];
    top?.close();
  }

  /** Number of currently open overlays. */
  get depth(): number {
    return this.entries.length;
  }

  /** ID of the topmost overlay, or `null` if the stack is empty. */
  get topId(): string | null {
    return this.entries[this.entries.length - 1]?.id ?? null;
  }

  /** True if the given ID is the topmost overlay. */
  isTop(id: string): boolean {
    return this.topId === id;
  }
}

/** Singleton overlay stack. Import and use directly. */
export const overlayStack = new OverlayStack();
