import type { NotificationTypeDefinition } from './types.js';

export interface NotificationRegistry {
  register(type: NotificationTypeDefinition): void;
  get(key: string): NotificationTypeDefinition | undefined;
  list(): NotificationTypeDefinition[];
}

export function createNotificationRegistry(): NotificationRegistry {
  const types = new Map<string, NotificationTypeDefinition>();

  return {
    register(type) {
      types.set(type.key, type);
    },

    get(key) {
      return types.get(key);
    },

    list() {
      return Array.from(types.values());
    }
  };
}
