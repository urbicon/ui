export interface NotificationTypeDefinition {
  key: string;
  title: string | ((data: Record<string, unknown>) => string);
  body?: string | ((data: Record<string, unknown>) => string);
  url?: string | ((data: Record<string, unknown>) => string);
  icon?: string;
  recipients: 'all' | 'admins' | string[] | ((data: Record<string, unknown>) => Promise<string[]>);
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
