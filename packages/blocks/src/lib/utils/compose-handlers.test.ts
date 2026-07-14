import { describe, expect, it, vi } from 'vitest';
import { composeHandlers } from './compose-handlers';

// Unit layer for the restProps handler composition. The contract these tests
// pin down (internal first + unconditional, consumer additive, preventDefault
// is not a veto) is asserted end-to-end through real components in
// Dialog.svelte.test.ts / Drawer.svelte.test.ts; here it is checked in
// isolation, where ordering and the throwing-consumer edge are cheap to drive.

// The composed handler is typed against DOM event handlers; these unit tests
// only need the call/order semantics, so a bare Event is enough.
const evt = () => new Event('click') as Event & { currentTarget: EventTarget & Element };

describe('composeHandlers', () => {
  it('runs the internal handler before the consumer handler', () => {
    const calls: string[] = [];
    const composed = composeHandlers(
      () => calls.push('internal'),
      () => calls.push('consumer')
    );

    composed(evt());

    expect(calls).toEqual(['internal', 'consumer']);
  });

  it('passes the same event object to both handlers', () => {
    const internal = vi.fn();
    const consumer = vi.fn();
    const composed = composeHandlers(internal, consumer);
    const event = evt();

    composed(event);

    expect(internal).toHaveBeenCalledWith(event);
    expect(consumer).toHaveBeenCalledWith(event);
  });

  it('is a no-op wrapper when the consumer handler is undefined or null', () => {
    const internal = vi.fn();

    expect(() => composeHandlers(internal, undefined)(evt())).not.toThrow();
    expect(() => composeHandlers(internal, null)(evt())).not.toThrow();
    expect(internal).toHaveBeenCalledTimes(2);
  });

  it('still runs the internal handler when the consumer handler throws', () => {
    // The ordering guarantee is what makes "internal wins" true for a
    // behavioural path: a broken consumer handler cannot cancel dismissal,
    // it can only fail after the component already reacted.
    const internal = vi.fn();
    const composed = composeHandlers(internal, () => {
      throw new Error('consumer blew up');
    });

    expect(() => composed(evt())).toThrow('consumer blew up');
    expect(internal).toHaveBeenCalledOnce();
  });
});
