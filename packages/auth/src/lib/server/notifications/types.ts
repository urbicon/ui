export interface NotificationTypeDefinition {
  key: string;
  title: string | ((data: Record<string, unknown>) => string);
  body?: string | ((data: Record<string, unknown>) => string);
  url?: string | ((data: Record<string, unknown>) => string);
  icon?: string;
  recipients: 'all' | 'admins' | string[] | ((data: Record<string, unknown>) => Promise<string[]>);
  channels?: ('sse' | 'push' | 'email')[];
}
