// Test fixture: the mock server and mount plumbing every component suite in
// this package shares. Each suite states its own server through the
// component's injected `fetcher`, so no global fetch is ever touched. Not part
// of the published package (package.json `files` excludes `__fixtures__`).
import { type Component, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, vi } from 'vitest';

/** A JSON `Response` — the body goes through `JSON.stringify`, so `null` and `[]` are legal bodies. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/** A fetch that answers each call from the queue, in order, and fails loudly once it runs dry. */
export function fetcherReturning(...responses: Array<Response | Error>): typeof globalThis.fetch {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('fetcher queue exhausted');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof globalThis.fetch;
}

/** A fetch that answers every call the same way. */
export function fetcherAnswering(status: number, body: unknown): typeof globalThis.fetch {
  return vi.fn(async () => jsonResponse(status, body)) as unknown as typeof globalThis.fetch;
}

/**
 * Let a request round-trip finish. A macrotask, not two microtasks: parsing a
 * real `Response` body takes an unspecified number of microtask turns, so
 * counting them is how a component test starts asserting against a DOM that
 * has not caught up yet.
 */
export async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
}

/**
 * A `mount()` into `document.body` that unmounts and clears the body after
 * each test. Call once at suite scope — it registers the `afterEach` — and use
 * the returned function inside the tests.
 */
export function mounter() {
  let dispose: (() => void) | undefined;
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.replaceChildren();
  });
  // `any`, not `unknown`: an interface has no implicit index signature, so a
  // component's `*Props` is assignable to `Record<string, any>` (svelte's own
  // `Component` constraint) but not to `Record<string, unknown>`.
  // biome-ignore lint/suspicious/noExplicitAny: mirrors svelte's Component constraint
  return <P extends Record<string, any>>(component: Component<P>, props: P): void => {
    dispose?.();
    const instance = mount(component, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
  };
}
