import type { JsonRpcMessage, Transport } from '../bridge.ts';

/**
 * The transport a real host would be over `postMessage`: `sent` holds what the
 * view sent, `deliver` hands a host message in.
 */
export function fakeHost() {
  const sent: JsonRpcMessage[] = [];
  let handler: ((data: unknown) => void) | null = null;
  let broken: Error | null = null;
  const transport: Transport = {
    send: (message) => {
      if (broken) throw broken;
      sent.push(message);
    },
    listen: (h) => {
      handler = h;
      return () => {
        handler = null;
      };
    }
  };
  return {
    transport,
    sent,
    deliver: (data: unknown) => handler?.(data),
    listening: () => handler !== null,
    /** From now on every `send` throws — like `postMessage` with a `DataCloneError`. */
    breakWire: (error: Error) => {
      broken = error;
    }
  };
}
