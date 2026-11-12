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

/**
 * The props of the view `name`, checked against its declaration `spec` — at
 * runtime and loudly, because a JavaScript caller or a cast gets past the
 * type of `startView`.
 */
export function propsFor<S>(
  name: string,
  spec: { callsTools: boolean },
  state: S,
  bridge: Bridge,
  makeTools?: (bridge: Bridge) => ToolCaller
): { state: S; bridge: ViewBridge; tools?: ToolCaller } {
  if (Boolean(makeTools) !== spec.callsTools) {
    throw new Error(
      spec.callsTools
        ? `The view ${name} declares callsTools: true, but no ToolCaller factory was passed.`
        : `The view ${name} declares callsTools: false, but a ToolCaller factory was passed.`
    );
  }
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
