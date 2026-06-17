import { describe, expect, it, vi } from 'vitest';
import { createSSEManager } from './sse.js';

function createMockController() {
  return {
    enqueue: vi.fn(),
    close: vi.fn(),
    error: vi.fn(),
    desiredSize: 1
  } as unknown as ReadableStreamDefaultController;
}

function createDeadController() {
  return {
    enqueue: vi.fn(() => {
      throw new TypeError('Controller is already closed');
    }),
    close: vi.fn(),
    error: vi.fn(),
    desiredSize: null
  } as unknown as ReadableStreamDefaultController;
}

describe('createSSEManager', () => {
  it('should track online status', () => {
    const sse = createSSEManager();
    const ctrl = createMockController();

    expect(sse.isOnline('user-1')).toBe(false);
    sse.addConnection('user-1', ctrl);
    expect(sse.isOnline('user-1')).toBe(true);
    sse.removeConnection('user-1', ctrl);
    expect(sse.isOnline('user-1')).toBe(false);
  });

  it('should send data to specific user', () => {
    const sse = createSSEManager();
    const ctrl1 = createMockController();
    const ctrl2 = createMockController();

    sse.addConnection('user-1', ctrl1);
    sse.addConnection('user-2', ctrl2);

    sse.notifyUser('user-1', { type: 'test' });

    expect(ctrl1.enqueue).toHaveBeenCalled();
    expect(ctrl2.enqueue).not.toHaveBeenCalled();
  });

  it('should send data to all users', () => {
    const sse = createSSEManager();
    const ctrl1 = createMockController();
    const ctrl2 = createMockController();

    sse.addConnection('user-1', ctrl1);
    sse.addConnection('user-2', ctrl2);

    sse.notifyAll({ type: 'broadcast' });

    expect(ctrl1.enqueue).toHaveBeenCalled();
    expect(ctrl2.enqueue).toHaveBeenCalled();
  });

  it('should support multiple connections per user', () => {
    const sse = createSSEManager();
    const ctrl1 = createMockController();
    const ctrl2 = createMockController();

    sse.addConnection('user-1', ctrl1);
    sse.addConnection('user-1', ctrl2);

    sse.notifyUser('user-1', { type: 'test' });

    expect(ctrl1.enqueue).toHaveBeenCalled();
    expect(ctrl2.enqueue).toHaveBeenCalled();
  });

  it('should return online user ids', () => {
    const sse = createSSEManager();
    sse.addConnection('user-1', createMockController());
    sse.addConnection('user-2', createMockController());

    const ids = sse.getOnlineUserIds();
    expect(ids).toContain('user-1');
    expect(ids).toContain('user-2');
  });

  it('should notify by role', () => {
    const sse = createSSEManager();
    const ctrl1 = createMockController();
    const ctrl2 = createMockController();

    sse.addConnection('user-1', ctrl1);
    sse.addConnection('user-2', ctrl2);

    const getRoles: Record<string, string> = { 'user-1': 'admin', 'user-2': 'user' };
    sse.notifyRole('admin', { type: 'admin-event' }, (id) => getRoles[id]);

    expect(ctrl1.enqueue).toHaveBeenCalled();
    expect(ctrl2.enqueue).not.toHaveBeenCalled();
  });

  // Cluster C.1: a controller whose enqueue throws (closed socket) must be
  // pruned on send, otherwise it accumulates and drifts isOnline — which would
  // suppress push delivery to users wrongly believed to be online.
  it('prunes a dead controller on notify, keeping the live one', () => {
    const sse = createSSEManager();
    const live = createMockController();
    const dead = createDeadController();

    sse.addConnection('user-1', live);
    sse.addConnection('user-1', dead);
    expect(sse.connectionCount('user-1')).toBe(2);

    sse.notifyUser('user-1', { type: 'test' });

    expect(sse.connectionCount('user-1')).toBe(1);
    expect(live.enqueue).toHaveBeenCalled();
  });

  it('reports isOnline false once the only connection is pruned as dead', () => {
    const sse = createSSEManager();
    sse.addConnection('user-1', createDeadController());
    expect(sse.isOnline('user-1')).toBe(true);

    sse.notifyUser('user-1', { type: 'test' });

    expect(sse.isOnline('user-1')).toBe(false);
  });

  it('prunes dead controllers across notifyAll too', () => {
    const sse = createSSEManager();
    sse.addConnection('user-1', createDeadController());
    sse.addConnection('user-2', createMockController());

    sse.notifyAll({ type: 'broadcast' });

    expect(sse.isOnline('user-1')).toBe(false);
    expect(sse.isOnline('user-2')).toBe(true);
  });

  it('connectionCount tracks add/remove and reports 0 for unknown users', () => {
    const sse = createSSEManager();
    expect(sse.connectionCount('nobody')).toBe(0);
    const c1 = createMockController();
    const c2 = createMockController();
    sse.addConnection('u', c1);
    sse.addConnection('u', c2);
    expect(sse.connectionCount('u')).toBe(2);
    sse.removeConnection('u', c1);
    expect(sse.connectionCount('u')).toBe(1);
  });
});
