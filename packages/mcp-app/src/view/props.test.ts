/**
 * What a view gets as props — without a browser.
 *
 * `bridge.test.ts` checks that the `ViewBridge` has no free request; here, that
 * a view also gets it and not the whole bridge. With the whole bridge every
 * view would have `request('tools/call', …)` — and a tool's "app" visibility
 * holds for every view of the server.
 */
import { describe, expect, test } from 'vitest';
import { createBridge, type Transport } from './bridge.ts';
import { assertViewReach, OUT_OF_REACH, propsFor } from './props.ts';
import { toolCaller } from './tools.ts';

function reachable(bridge: object): string[] {
  return OUT_OF_REACH.filter((name) => name in bridge);
}

const SILENT: Transport = { send: () => {}, listen: () => () => {} };
const newBridge = () =>
  createBridge(SILENT, { appInfo: { name: 'mcp-app-test', version: '0.0.0' } });
/** `propsFor` hands the state through untouched. */
const STATE = { marker: 'state' };
const NO_TOOLS = { callsTools: false } as const;
const CALLS_TOOLS = { callsTools: true } as const;

describe('what a view gets as props', () => {
  test('without callsTools: the state and a ViewBridge — no free request, no tools', () => {
    const bridge = newBridge();
    const props = propsFor('plain', NO_TOOLS, STATE, bridge);
    expect(Object.keys(props).sort()).toEqual(['bridge', 'state']);
    expect(props.state).toBe(STATE);
    expect(props.bridge).not.toBe(bridge);
    expect(reachable(props.bridge)).toEqual([]);
  });

  test('with callsTools: the ToolCaller as well — and still only the ViewBridge', () => {
    const bridge = newBridge();
    const props = propsFor('caller', CALLS_TOOLS, STATE, bridge, toolCaller);
    expect(Object.keys(props).sort()).toEqual(['bridge', 'state', 'tools']);
    expect(typeof props.tools?.callTool).toBe('function');
    expect(props.bridge).not.toBe(bridge);
    expect(reachable(props.bridge)).toEqual([]);
  });

  test('a contradiction between declaration and factory is loud — both ways', () => {
    expect(() => propsFor('plain', NO_TOOLS, STATE, newBridge(), toolCaller)).toThrow(
      'The view plain declares callsTools: false, but a ToolCaller factory was passed.'
    );
    expect(() => propsFor('caller', CALLS_TOOLS, STATE, newBridge())).toThrow(
      'The view caller declares callsTools: true, but no ToolCaller factory was passed.'
    );
  });

  test('assertViewReach lets the props of propsFor through and throws on the whole bridge', () => {
    const bridge = newBridge();
    expect(() => assertViewReach(propsFor('plain', NO_TOOLS, STATE, bridge))).not.toThrow();
    expect(() =>
      assertViewReach(propsFor('caller', CALLS_TOOLS, STATE, bridge, toolCaller))
    ).not.toThrow();
    // The whole bridge laid over the props — as an entry could build them around propsFor.
    const bypass = { ...propsFor('caller', CALLS_TOOLS, STATE, bridge, toolCaller), bridge };
    expect(() => assertViewReach(bypass)).toThrow('request, notify, readResource, connect, close');
  });

  test('positive control: the whole bridge reaches that far', () => {
    expect(reachable(newBridge())).toEqual([
      'request',
      'notify',
      'readResource',
      'connect',
      'close'
    ]);
  });
});
