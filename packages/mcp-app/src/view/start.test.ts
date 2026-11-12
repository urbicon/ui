/**
 * `startView` over a fake host and a fake environment (`runView`) — the
 * lifecycle a view goes through, the props it is mounted with, and the
 * contradictions that must stop it before it mounts.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fakeHost } from './__fixtures__/fake-host.ts';
import { type Bridge, PROTOCOL_VERSION, type ToolCaller } from './bridge.ts';
import { OUT_OF_REACH, type ViewProps } from './props.ts';
import { runView, type StartViewOptions, type ViewState } from './start.ts';
import { toolCaller } from './tools.ts';

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function newState(): ViewState {
  return { phase: 'connecting', input: null, result: null, problem: null, context: {} };
}

const MESSAGES = {
  cancelled: (reason: string | undefined) => (reason ? `Cancelled: ${reason}` : 'Cancelled.'),
  hostSilent: 'The host does not answer.',
  failed: 'That did not work.'
};

function setup() {
  const host = fakeHost();
  const root = { style: { colorScheme: 'light dark' } };
  const resize = { started: 0, stopped: 0, fail: null as Error | null };
  const env = {
    transport: host.transport,
    root,
    resize: (_bridge: Bridge) => {
      if (resize.fail) throw resize.fail;
      resize.started++;
      return () => {
        resize.stopped++;
      };
    }
  };
  const state = newState();
  const mounted: unknown[] = [];
  const base = {
    appInfo: { name: 'notes', version: '0.0.0' },
    state,
    messages: MESSAGES
  };
  /** Answers the handshake the way a host does. */
  const handshake = (hostContext: Record<string, unknown> = { theme: 'dark' }) => {
    const init = host.sent.find((m) => m.method === 'ui/initialize')!;
    host.deliver({
      jsonrpc: '2.0',
      id: init.id,
      result: { protocolVersion: PROTOCOL_VERSION, hostContext }
    });
  };
  const notify = (method: string, params: unknown) =>
    host.deliver({ jsonrpc: '2.0', method, params });
  return { host, root, resize, env, state, mounted, base, handshake, notify };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startView — the lifecycle', () => {
  test('mount first, then the handshake; after it waiting, resize on, theme applied', async () => {
    const s = setup();
    runView(
      {
        ...s.base,
        callsTools: false,
        mount(props) {
          // At mount time nothing is on the wire yet.
          s.mounted.push({ props, sentBefore: s.host.sent.length });
        }
      },
      s.env
    );
    expect(s.mounted).toEqual([expect.objectContaining({ sentBefore: 0 })]);
    expect(s.host.sent.map((m) => m.method)).toEqual(['ui/initialize']);
    expect(s.state.phase).toBe('connecting');

    s.handshake();
    await tick();
    expect(s.state.phase).toBe('waiting');
    expect(s.state.context).toEqual({ theme: 'dark' });
    expect(s.root.style.colorScheme).toBe('dark');
    expect(s.resize.started).toBe(1);
  });

  test('tool-input, tool-result: input and result in the state, phase ready', async () => {
    const s = setup();
    runView({ ...s.base, callsTools: false, mount() {} }, s.env);
    s.handshake();
    await tick();
    s.notify('ui/notifications/tool-input', { arguments: { id: 'n1' } });
    expect(s.state.input).toEqual({ id: 'n1' });
    const result = { content: [{ type: 'text', text: '{}' }], structuredContent: { id: 'n1' } };
    s.notify('ui/notifications/tool-result', result);
    expect(s.state.phase).toBe('ready');
    expect(s.state.result).toEqual(result);
    expect(s.state.problem).toBeNull();
  });

  test('an error result: failed, with its first sentence — or the fallback', async () => {
    const s = setup();
    runView({ ...s.base, callsTools: false, mount() {} }, s.env);
    s.handshake();
    await tick();
    s.notify('ui/notifications/tool-result', {
      content: [
        { type: 'text', text: '  Note n9 does not exist. ' },
        { type: 'text', text: 'Hint for the model: list_notes.' }
      ],
      isError: true
    });
    expect(s.state.phase).toBe('failed');
    expect(s.state.problem).toBe('Note n9 does not exist.');
    s.notify('ui/notifications/tool-result', { content: [], isError: true });
    expect(s.state.problem).toBe(MESSAGES.failed);
  });

  test('tool-cancelled: cancelled, with the host’s reason in the view’s sentence', async () => {
    const s = setup();
    runView({ ...s.base, callsTools: false, mount() {} }, s.env);
    s.handshake();
    await tick();
    s.notify('ui/notifications/tool-cancelled', { reason: 'user' });
    expect(s.state.phase).toBe('cancelled');
    expect(s.state.problem).toBe('Cancelled: user');
  });

  test('a failed handshake: failed, with hostSilent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = setup();
    runView({ ...s.base, callsTools: false, mount() {} }, s.env);
    const init = s.host.sent[0]!;
    s.host.deliver({ jsonrpc: '2.0', id: init.id, error: { code: -32603, message: 'no' } });
    await tick();
    expect(s.state.phase).toBe('failed');
    expect(s.state.problem).toBe(MESSAGES.hostSilent);
    expect(s.resize.started).toBe(0);
  });

  test('teardown stops the size report', async () => {
    const s = setup();
    runView({ ...s.base, callsTools: false, mount() {} }, s.env);
    s.handshake();
    await tick();
    s.host.deliver({ jsonrpc: '2.0', id: 'td', method: 'ui/resource-teardown', params: {} });
    await tick();
    expect(s.resize.stopped).toBe(1);
    expect(s.host.sent.at(-1)).toEqual({ jsonrpc: '2.0', id: 'td', result: {} });
  });
});

describe('startView — errors are loud', () => {
  test('an error goes to the console, to the host log and to onError', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = setup();
    const seen: Error[] = [];
    runView(
      { ...s.base, callsTools: false, mount() {}, onError: (error) => seen.push(error) },
      s.env
    );
    s.handshake();
    await tick();
    s.host.deliver({ jsonrpc: '2.0', id: 404, result: {} });
    expect(seen.map((e) => e.message)).toEqual(['Answer to an unknown request (id 404).']);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(s.host.sent.at(-1)).toEqual({
      jsonrpc: '2.0',
      method: 'notifications/message',
      params: { level: 'error', logger: 'notes', data: 'Answer to an unknown request (id 404).' }
    });
  });

  test('a size report that fails to start is an error — not a silent host', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = setup();
    s.resize.fail = new Error('ResizeObserver is not defined');
    const seen: Error[] = [];
    runView(
      { ...s.base, callsTools: false, mount() {}, onError: (error) => seen.push(error) },
      s.env
    );
    s.handshake();
    await tick();
    expect(seen.map((e) => e.message)).toEqual(['ResizeObserver is not defined']);
    expect(s.state.phase).toBe('waiting');
    expect(s.state.problem).toBeNull();
  });
});

describe('startView — the props', () => {
  test('without callsTools: state and ViewBridge, no tools', () => {
    const s = setup();
    let seen: ViewProps<ViewState, false> | undefined;
    runView(
      {
        ...s.base,
        callsTools: false,
        mount(props) {
          seen = props;
        }
      },
      s.env
    );
    expect(Object.keys(seen!).sort()).toEqual(['bridge', 'state']);
    expect(seen!.state).toBe(s.state);
    expect(OUT_OF_REACH.filter((name) => name in seen!.bridge)).toEqual([]);
  });

  test('with callsTools: the ToolCaller from the factory, over the same bridge', async () => {
    const s = setup();
    let tools: ToolCaller | undefined;
    const { bridge } = runView(
      {
        ...s.base,
        callsTools: true,
        tools: toolCaller,
        mount(props) {
          // Typed without `?`: `callsTools: true` guarantees the prop.
          tools = props.tools;
        }
      },
      s.env
    );
    s.handshake();
    await tick();
    void tools!.callTool('get_note', { id: 'n1' });
    expect(s.host.sent.at(-1)).toMatchObject({
      method: 'tools/call',
      params: { name: 'get_note', arguments: { id: 'n1' } }
    });
    expect(bridge.connected).toBe(true);
  });

  test('a contradiction is loud — and stops the view before it mounts', () => {
    const s = setup();
    const mount = vi.fn();
    const missing = { ...s.base, callsTools: true as const, mount };
    // @ts-expect-error — `callsTools: true` requires `tools`.
    const withoutTools: StartViewOptions<ViewState, true> = missing;
    expect(() => runView(withoutTools, s.env)).toThrow(
      'The view notes declares callsTools: true, but no ToolCaller factory was passed.'
    );
    const extra = { ...s.base, callsTools: false as const, tools: toolCaller, mount };
    // @ts-expect-error — `callsTools: false` forbids `tools`.
    const withTools: StartViewOptions<ViewState, false> = extra;
    expect(() => runView(withTools, s.env)).toThrow(
      'The view notes declares callsTools: false, but a ToolCaller factory was passed.'
    );
    expect(mount).not.toHaveBeenCalled();
  });
});
