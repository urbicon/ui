export interface SSEManager {
  addConnection(userId: string, controller: ReadableStreamDefaultController): void;
  removeConnection(userId: string, controller: ReadableStreamDefaultController): void;
  /** Number of live connections for a user (used to enforce a per-user cap). */
  connectionCount(userId: string): number;
  notifyUser(userId: string, data: unknown): void;
  notifyAll(data: unknown): void;
  isOnline(userId: string): boolean;
  getOnlineUserIds(): string[];
}

/**
 * In-process SSE connection registry. **Process-local by design** — presence
 * (`isOnline`, `getOnlineUserIds`) only sees connections owned by this
 * process, and there is no cross-instance seam. On multi-instance or
 * serverless deployments that means:
 *
 * - `isOnline` false-negatives for users whose stream lives on another
 *   instance: the service skips their live SSE event and falls back to push
 *   (delivery still happens, via the heavier channel, provided they have a
 *   push subscription).
 * - `recipients: 'online'` broadcasts only reach the users connected to the
 *   instance that runs `send()`.
 *
 * Treat the notification system as single-instance until a shared presence
 * backend exists — the same assumption the in-memory rate-limit store and the
 * forgot-password serverless note document. See docs/AUTH.md → Known
 * Limitations & Security Gaps.
 */
export function createSSEManager(): SSEManager {
  const connections = new Map<string, Set<ReadableStreamDefaultController>>();

  function removeConnection(userId: string, controller: ReadableStreamDefaultController): void {
    const set = connections.get(userId);
    if (set) {
      set.delete(controller);
      if (set.size === 0) {
        connections.delete(userId);
      }
    }
  }

  // Enqueue to one controller. Returns false when the underlying stream is
  // already closed/errored — the caller then prunes the dead controller so it
  // can't accumulate and drift `isOnline` (which would suppress push delivery
  // to users the manager wrongly believes are online).
  function send(controller: ReadableStreamDefaultController, data: unknown): boolean {
    try {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      return true;
    } catch {
      return false;
    }
  }

  function sendOrPrune(
    userId: string,
    controller: ReadableStreamDefaultController,
    data: unknown
  ): void {
    if (!send(controller, data)) removeConnection(userId, controller);
  }

  return {
    addConnection(userId, controller) {
      let set = connections.get(userId);
      if (!set) {
        set = new Set();
        connections.set(userId, set);
      }
      set.add(controller);
    },

    removeConnection,

    connectionCount(userId) {
      return connections.get(userId)?.size ?? 0;
    },

    notifyUser(userId, data) {
      const set = connections.get(userId);
      if (!set) return;
      // Iterate a copy — sendOrPrune may delete from the live set.
      for (const controller of [...set]) sendOrPrune(userId, controller, data);
    },

    notifyAll(data) {
      for (const [userId, set] of [...connections]) {
        for (const controller of [...set]) sendOrPrune(userId, controller, data);
      }
    },

    isOnline(userId) {
      const set = connections.get(userId);
      return !!set && set.size > 0;
    },

    getOnlineUserIds() {
      return Array.from(connections.keys());
    }
  };
}
