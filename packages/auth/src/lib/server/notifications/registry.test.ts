import { describe, expect, it } from 'vitest';
import { createNotificationRegistry } from './registry.js';

describe('createNotificationRegistry', () => {
  it('should register and retrieve a type', () => {
    const registry = createNotificationRegistry();
    registry.register({
      key: 'test',
      title: 'Test Notification',
      recipients: 'all'
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
    registry.register({ key: 'a', title: 'A', recipients: 'all' });
    registry.register({ key: 'b', title: 'B', recipients: 'admins' });

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.key)).toEqual(['a', 'b']);
  });

  it('should overwrite existing type with same key', () => {
    const registry = createNotificationRegistry();
    registry.register({ key: 'test', title: 'Old', recipients: 'all' });
    registry.register({ key: 'test', title: 'New', recipients: 'all' });

    expect(registry.get('test')?.title).toBe('New');
    expect(registry.list()).toHaveLength(1);
  });
});
