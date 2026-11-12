/**
 * What a view gets as props — pure and free of any UI framework, so it is
 * testable without a browser; `startView` builds the props with it and hands
 * them to the app's `mount`.
 *
 * This is where a view's path to `tools/call` is decided: it gets the
 * {@link ViewBridge} instead of the bridge, and a {@link ToolCaller} only when
 * it declares `callsTools: true`.
 */
import { type Bridge, type ToolCaller, type ViewBridge, viewBridge } from './bridge.ts';

/** What a view must not reach: every path to a freely chosen method name, and the wire itself. */
export const OUT_OF_REACH = [
  'request',
  'notify',
  'readResource',
  'callTool',
  'connect',
  'close'
] as const;

/**
 * The props of a view over the state `S`. **A `ToolCaller` exactly when
 * `CallsTools` is `true`**: a view without it that asked for a `tools` prop
 * would not fit `startView`.
 */
export type ViewProps<S, CallsTools extends boolean = boolean> = {
  state: S;
  bridge: ViewBridge;
} & (CallsTools extends true ? { tools: ToolCaller } : { tools?: never });

/** A value as a sentence names it — a string quoted, so `"true"` does not read as `true`. */
function shown(value: unknown): string {
  if (typeof value === 'function') return 'a function';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object' && value !== null) return 'an object';
  return String(value);
}

/**
 * Loud when `callsTools` and the `ToolCaller` factory disagree, naming both —
 * at runtime, because a JavaScript caller or a cast gets past the type of
 * `startView`.
 */
export function checkCallsTools(callsTools: unknown, makeTools: unknown): void {
  if (typeof callsTools !== 'boolean') {
    throw new Error(
      `callsTools must be true or false, but it is ${shown(callsTools)} (tools is ${shown(makeTools)}).`
    );
  }
  if (callsTools && typeof makeTools !== 'function') {
    throw new Error(
      `callsTools: true requires a ToolCaller factory in tools, but tools is ${shown(makeTools)}.`
    );
  }
  if (!callsTools && makeTools !== undefined) {
    throw new Error(`callsTools: false forbids tools, but tools is ${shown(makeTools)}.`);
  }
}

/** The props of a view, checked against its declaration `spec` ({@link checkCallsTools}). */
export function propsFor<S>(
  spec: { callsTools: boolean },
  state: S,
  bridge: Bridge,
  makeTools?: (bridge: Bridge) => ToolCaller
): { state: S; bridge: ViewBridge; tools?: ToolCaller } {
  checkCallsTools(spec.callsTools, makeTools);
  const forView = viewBridge(bridge);
  return makeTools
    ? { state, bridge: forView, tools: makeTools(bridge) }
    : { state, bridge: forView };
}

/**
 * Loud when the bridge in the props reaches more than a {@link ViewBridge}.
 * `startView` calls it with exactly the object it mounts: **the type does not
 * see a whole bridge there** — it is structurally a `ViewBridge` (a `Pick`),
 * and a spread over the props stays assignable in a generic entry, even with
 * a brand on the type.
 */
export function assertViewReach(props: { bridge: object }): void {
  const reached = OUT_OF_REACH.filter((name) => name in props.bridge);
  if (reached.length > 0) {
    throw new Error(
      `The view would get ${reached.join(', ')} — it gets the ViewBridge only (viewBridge()).`
    );
  }
}
