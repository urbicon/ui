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
      // Fail at wiring time, not at first send: for a rarely-sent type (an
      // admin security alert, say) a send()-time throw would stay latent
      // until the very moment the alert mattered. send() keeps the same
      // check as a backstop for third-party registry implementations.
      if ((type.recipients as unknown) === 'all') {
        throw new Error(
          `[auth] notification type "${type.key}" uses recipients: 'all', which was renamed ` +
            `to 'online' (it only ever reached users with an open SSE stream in this ` +
            `process). Use 'online', or a recipients function for a true all-accounts ` +
            `broadcast.`
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
