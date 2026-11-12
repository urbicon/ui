/**
 * Calling tools from a view — **the one module of this package that writes
 * `tools/call`**, and the only export of `@urbicon-ui/mcp-app/view/tools`.
 *
 * The spec grants a tool's `"app"` visibility to **every** view of the server,
 * including one that shows what the model wrote. That a view without
 * `callsTools` changes nothing therefore cannot rest on the host; it rests on
 * the view's code:
 *
 * - the bridge has no `callTool`, and `startView` hands the view and its
 *   caller only the `ViewBridge`, which has no free request;
 * - a {@link ToolCaller} reaches only a view that declares `callsTools`
 *   (`propsFor`, `startView`);
 * - this module is a subpath of its own, so an app can forbid its one
 *   specifier everywhere except in the entry of such a view — no other module
 *   of the package writes the method name (`tools-boundary.test.ts`).
 *
 * The last is a heuristic, not a guarantee: `createBridge` keeps a free
 * `request`, so an app also scans its view code for the literal — and a name
 * put together (`'tools' + '/call'`) passes both.
 */
import type { Bridge, CallToolResult, ToolCaller } from './bridge.ts';

export function toolCaller(bridge: Bridge): ToolCaller {
  return {
    callTool: (name, args = {}) =>
      bridge.request<CallToolResult>('tools/call', { name, arguments: args })
  };
}
