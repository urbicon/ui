import { describe, expect, it } from 'vitest';
import { createNotificationRegistry } from './registry.js';

describe('createNotificationRegistry', () => {
  it('should register and retrieve a type', () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'test',
      title: 'Test Notification',
      recipients: 'online'
    });

    expect(registry.get('test')).toBeDefined();
    expect(registry.get('test')?.title).toBe('Test Notification');
  });

  it('should return undefined for unknown type', () => {
    const registry = createNotificationRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('should list all registered types', () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'a', title: 'A', recipients: 'online' });
    registry.register({ key: 'b', title: 'B', recipients: 'admins' });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.key)).toEqual(['a', 'b']);
  });

  it('rejects a duplicate key instead of silently replacing the earlier definition', () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'test', title: 'Old', recipients: 'online' });

    // A silent overwrite would let a later registration redirect
    // recipients/channels of an existing (possibly security-alert) type.
    expect(() => registry.register({ key: 'test', title: 'New', recipients: 'online' })).toThrow(
      /already registered/
    );
    expect(registry.get('test')?.title, 'earlier definition untouched').toBe('Old');
    expect(registry.list()).toHaveLength(1);
  });
});
