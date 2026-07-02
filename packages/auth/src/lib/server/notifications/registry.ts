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
      // Duplicate keys are a wiring bug, not an update mechanism: silently
      // replacing the earlier definition would let a later (or third-party)
      // registration redirect recipients/channels of an existing type —
      // security-relevant for admin-alert types — with no indication at all.
      if (types.has(type.key)) {
        throw new Error(
          `[auth] notification type "${type.key}" is already registered. Registering a key ` +
            `twice would silently replace the earlier definition (recipients/channels drift); ` +
            `register each type exactly once.`
        );
      }
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
