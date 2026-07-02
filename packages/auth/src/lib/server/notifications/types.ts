export interface NotificationTypeDefinition {
  key: string;
  title: string | ((data: Record<string, unknown>) => string);
  body?: string | ((data: Record<string, unknown>) => string);
  url?: string | ((data: Record<string, unknown>) => string);
  icon?: string;
  /**
   * Who receives the notification:
   * - `'online'`: every user with an open SSE stream **in this process** at
   *   send time. Presence-based, not account-based — offline users get
   *   nothing (no DB row, no push). Renamed from the misleading `'all'`,
   *   which never reached offline accounts; `send()` throws a migration
   *   error on the old value. For a true all-accounts broadcast, use the
   *   function form and resolve the IDs yourself.
   * - `'admins'`: resolved via the `resolveAdminRecipients` seam on
   *   `createNotificationService` (which throws when the seam is unwired).
   * - `string[]` / function form: explicit user ids (the function receives
   *   the `send()` data payload).
   */
  recipients:
    | 'online'
    | 'admins'
    | string[]
    | ((data: Record<string, unknown>) => Promise<string[]>);
  /**
   * Delivery channels, default `['sse', 'push']`. There is deliberately no
   * `'email'` channel: it was a declared-but-never-implemented contract end
   * (review R6) — `send()` had no email branch, so declaring it silently
   * degraded to DB-persistence only. The `email` flag on
   * `NotificationPreference` remains as a reserved column for a future
   * implementation.
   */
  channels?: ('sse' | 'push')[];
}
