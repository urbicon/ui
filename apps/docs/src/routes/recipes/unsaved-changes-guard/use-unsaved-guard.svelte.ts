import { beforeNavigate, goto } from '$app/navigation';

export interface UnsavedGuardOptions {
  /** Reactive read of the dirty state, e.g. () => dirty. */
  isDirty: () => boolean;
  /**
   * Opens your dialog and resolves true to proceed. Clear the dirty state
   * before resolving true, or the retried navigation lands back here.
   */
  confirm: () => Promise<boolean>;
}

/**
 * Call once during component init. While isDirty() returns true, every
 * navigation waits for confirm(); closing or reloading the tab gets the
 * browser's own prompt.
 */
export function useUnsavedGuard(opts: UnsavedGuardOptions): void {
  beforeNavigate(async (nav) => {
    if (!opts.isDirty()) return;

    // cancel() must run before the first await: SvelteKit does not wait for
    // this callback. It stops an in-app navigation outright; on a 'leave'
    // navigation (tab close, reload) it arms the browser's generic prompt
    // instead — the only UI allowed at that point — so bail before the
    // dialog can open underneath it.
    nav.cancel();
    if (nav.type === 'leave') return;

    const proceed = await opts.confirm();
    if (!proceed || !nav.to) return;

    // The dialog cleared the dirty state before resolving true, so this
    // second attempt passes the guard. goto() only handles routes the
    // client-side router owns; an external target unloads the document.
    if (nav.willUnload) window.location.href = nav.to.url.href;
    else goto(nav.to.url);
  });
}
