/**
 * The bridge without a browser — a host made of two lists (`fakeHost`). Every
 * test checks a message on the wire, not a method of the bridge — the same
 * shape a host sees.
 */
import { describe, expect, test } from 'vitest';
import { wireProblem } from '../testing/wire.ts';
import { fakeHost } from './__fixtures__/fake-host.ts';
import {
  applyTheme,
  BridgeError,
  createBridge,
  createSizeReporter,
  IMPLEMENTATION_ERROR,
  type JsonRpcMessage,
  METHOD_NOT_FOUND,
  PROTOCOL_VERSION,
  REQUEST_TIMEOUT,
  viewBridge,
  type WindowLike,
  windowTransport
} from './bridge.ts';
import { toolCaller } from './tools.ts';

const APP_INFO = { name: 'mcp-app-test', version: '0.0.0' };

/** A connected bridge with its host — the handshake once, correctly. */
async function connected(options: Partial<Parameters<typeof createBridge>[1]> = {}) {
  const host = fakeHost();
  const errors: Error[] = [];
  const bridge = createBridge(host.transport, {
    appInfo: APP_INFO,
    onError: (error) => errors.push(error),
    ...options
  });
  const done = bridge.connect();
  const init = host.sent[0]!;
  host.deliver({
    jsonrpc: '2.0',
    id: init.id,
    result: {
      protocolVersion: PROTOCOL_VERSION,
      hostInfo: { name: 'probe', version: '1' },
      hostCapabilities: {},
      hostContext: { theme: 'light', displayMode: 'inline' }
    }
  });
  await done;
  host.sent.length = 0;
  return { host, bridge, errors };
}

/** Until the microtasks are through (an async handler does not answer synchronously). */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('handshake', () => {
  test('ui/initialize with appInfo and version, then initialized', async () => {
    const host = fakeHost();
    const contexts: unknown[] = [];
    const bridge = createBridge(host.transport, {
      appInfo: APP_INFO,
      appCapabilities: { availableDisplayModes: ['inline'] },
      on: { hostContextChanged: (context) => contexts.push(context) }
    });
    const done = bridge.connect();

    // Before the answer exactly one message is on the wire.
    expect(host.sent).toHaveLength(1);
    const init = host.sent[0]!;
    expect(init.method).toBe('ui/initialize');
    expect(init.params).toEqual({
      appInfo: APP_INFO,
      appCapabilities: { availableDisplayModes: ['inline'] },
      protocolVersion: '2026-01-26'
    });
    expect(bridge.connected).toBe(false);

    host.deliver({
      jsonrpc: '2.0',
      id: init.id,
      result: { protocolVersion: '2026-01-26', hostContext: { theme: 'dark' } }
    });
    const result = await done;

    expect(result.protocolVersion).toBe('2026-01-26');
    expect(host.sent[1]).toEqual({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
    expect(bridge.connected).toBe(true);
    expect(bridge.hostContext.theme).toBe('dark');
    // The initial context goes to the same handler as every change.
    expect(contexts).toEqual([{ theme: 'dark' }]);
  });

  test('a result without protocolVersion is no handshake', async () => {
    const host = fakeHost();
    const bridge = createBridge(host.transport, { appInfo: APP_INFO });
    const done = bridge.connect();
    host.deliver({ jsonrpc: '2.0', id: host.sent[0]!.id, result: {} });
    await expect(done).rejects.toThrow('protocolVersion');
    // … no initialized follows, and the bridge does not count as connected.
    expect(host.sent).toHaveLength(1);
    expect(bridge.connected).toBe(false);
    await expect(bridge.ping()).rejects.toThrow('connect() first');
    expect(host.sent).toHaveLength(1);
  });

  test('no requests before the handshake', async () => {
    const host = fakeHost();
    const bridge = createBridge(host.transport, { appInfo: APP_INFO });
    await expect(toolCaller(bridge).callTool('get_note', {})).rejects.toThrow('connect() first');
    expect(host.sent).toHaveLength(0);
  });
});

describe('requests and answers', () => {
  test('tools/call carries id, name and arguments — the answer resolves', async () => {
    const { host, bridge } = await connected();
    const call = toolCaller(bridge).callTool('get_note', { id: 'n1' });
    const sent = host.sent[0]!;
    expect(sent.method).toBe('tools/call');
    expect(sent.params).toEqual({ name: 'get_note', arguments: { id: 'n1' } });

    host.deliver({ jsonrpc: '2.0', id: sent.id, result: { content: [], isError: false } });
    expect(await call).toEqual({ content: [], isError: false });
  });

  test('every request has its own id, and the answers find their way back', async () => {
    const { host, bridge } = await connected();
    const a = bridge.ping();
    const b = bridge.readResource('ui://notes/note');
    const [first, second] = host.sent;
    expect(first!.id).not.toBe(second!.id);
    // Reverse order — the id decides, not the arrival.
    host.deliver({ jsonrpc: '2.0', id: second!.id, result: { contents: ['b'] } });
    host.deliver({ jsonrpc: '2.0', id: first!.id, result: {} });
    expect(await b).toEqual({ contents: ['b'] });
    expect(await a).toEqual({});
  });

  test('an error answer rejects — with code and sentence', async () => {
    const { host, bridge } = await connected();
    const link = bridge.openLink('https://example.com');
    host.deliver({
      jsonrpc: '2.0',
      id: host.sent[0]!.id,
      error: { code: -32000, message: 'Link opening denied by user' }
    });
    const error = await link.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BridgeError);
    expect((error as BridgeError).code).toBe(-32000);
    expect((error as BridgeError).message).toBe('ui/open-link: Link opening denied by user');
    // The host's sentence alone — the one the view shows a person.
    expect((error as BridgeError).reason).toBe('Link opening denied by user');
  });

  test('a request without an answer times out instead of waiting forever', async () => {
    const { bridge } = await connected({ timeoutMs: 5 });
    const error = await bridge.ping().catch((e: unknown) => e);
    expect((error as BridgeError).code).toBe(REQUEST_TIMEOUT);
  });

  test('the remaining requests stand on the wire as in the SDK', async () => {
    const { host, bridge } = await connected();
    const open = [
      bridge.sendMessage('Show me the note.'),
      bridge.updateModelContext({ structuredContent: { noteId: 'n1' } }),
      bridge.requestDisplayMode('fullscreen')
    ];
    expect(host.sent.map((m) => [m.method, m.params])).toEqual([
      ['ui/message', { role: 'user', content: [{ type: 'text', text: 'Show me the note.' }] }],
      ['ui/update-model-context', { structuredContent: { noteId: 'n1' } }],
      ['ui/request-display-mode', { mode: 'fullscreen' }]
    ]);
    bridge.close();
    // Closed unanswered: each of the three is rejected, none stays pending.
    const settled = await Promise.allSettled(open);
    expect(settled.every((s) => s.status === 'rejected')).toBe(true);
  });

  test('log carries the logger — appInfo.name by default, or the one given', async () => {
    const byDefault = await connected();
    byDefault.bridge.log('info', 'x');
    expect(byDefault.host.sent[0]?.params).toEqual({
      level: 'info',
      logger: 'mcp-app-test',
      data: 'x'
    });
    const named = await connected({ logger: 'notes-view' });
    named.bridge.log('info', 'x');
    expect(named.host.sent[0]?.params).toMatchObject({ logger: 'notes-view' });
  });
});

describe('errors are loud', () => {
  test('an answer to an unknown id goes to onError', async () => {
    const { host, errors } = await connected();
    host.deliver({ jsonrpc: '2.0', id: 999, result: {} });
    expect(errors.map((e) => e.message)).toEqual(['Answer to an unknown request (id 999).']);
  });

  test('broken JSON-RPC goes to onError — foreign messages are ignored', async () => {
    const { host, errors } = await connected();
    host.deliver({ jsonrpc: '2.0', id: 3 });
    expect(errors).toHaveLength(1);
    // What is not JSON-RPC is not ours: developer tools talk over postMessage too.
    host.deliver({ source: 'react-devtools', payload: {} });
    host.deliver('hello');
    expect(errors).toHaveLength(1);
  });

  test('a tool-result without content is no result', async () => {
    const results: unknown[] = [];
    const { host, errors } = await connected({ on: { toolResult: (r) => results.push(r) } });
    host.deliver({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: {} });
    expect(results).toHaveLength(0);
    expect(errors[0]?.message).toContain('CallToolResult');
  });

  test('when the wire throws while answering the host, that goes to onError', async () => {
    const { host, errors } = await connected();
    host.breakWire(new Error('wire cut'));
    host.deliver({ jsonrpc: '2.0', id: 'p2', method: 'ping' });
    host.deliver({ jsonrpc: '2.0', id: 'x2', method: 'ui/does-not-exist' });
    await tick();
    expect(errors.map((e) => e.message)).toEqual(['wire cut', 'wire cut']);
  });

  test('a throwing handler does not stop the reception', async () => {
    const { host, errors } = await connected({
      on: {
        toolInput: () => {
          throw new Error('broken');
        }
      }
    });
    host.deliver({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: {} });
    host.deliver({ jsonrpc: '2.0', id: 77, result: {} });
    expect(errors.map((e) => e.message)).toEqual([
      'broken',
      'Answer to an unknown request (id 77).'
    ]);
  });
});

describe('messages of the host', () => {
  test('tool-input, tool-input-partial, tool-result and tool-cancelled', async () => {
    const seen: [string, unknown][] = [];
    const { host } = await connected({
      on: {
        toolInputPartial: (args) => seen.push(['partial', args]),
        toolInput: (args) => seen.push(['input', args]),
        toolResult: (result) => seen.push(['result', result.structuredContent]),
        toolCancelled: (reason) => seen.push(['cancelled', reason])
      }
    });
    const n = (method: string, params: unknown) => host.deliver({ jsonrpc: '2.0', method, params });
    n('ui/notifications/tool-input-partial', { arguments: { id: 'n' } });
    n('ui/notifications/tool-input', { arguments: { id: 'n1' } });
    n('ui/notifications/tool-result', { content: [], structuredContent: { note: { year: 1955 } } });
    n('ui/notifications/tool-cancelled', { reason: 'user' });
    expect(seen).toEqual([
      ['partial', { id: 'n' }],
      ['input', { id: 'n1' }],
      ['result', { note: { year: 1955 } }],
      ['cancelled', 'user']
    ]);
  });

  test('host-context-changed merges instead of replacing', async () => {
    const contexts: unknown[] = [];
    const { host, bridge } = await connected({
      on: { hostContextChanged: (context) => contexts.push({ ...context }) }
    });
    host.deliver({
      jsonrpc: '2.0',
      method: 'ui/notifications/host-context-changed',
      params: { theme: 'dark' }
    });
    // displayMode comes from the handshake and stays.
    expect(bridge.hostContext).toEqual({ theme: 'dark', displayMode: 'inline' });
    expect(contexts.at(-1)).toEqual({ theme: 'dark', displayMode: 'inline' });
  });

  test('an unknown notification is no error', async () => {
    const { host, errors } = await connected();
    host.deliver({ jsonrpc: '2.0', method: 'ui/notifications/something-new', params: {} });
    expect(errors).toHaveLength(0);
    expect(host.sent).toHaveLength(0);
  });

  test('the host’s ping gets {} — an unknown request -32601', async () => {
    const { host } = await connected();
    host.deliver({ jsonrpc: '2.0', id: 'p1', method: 'ping' });
    host.deliver({ jsonrpc: '2.0', id: 'x1', method: 'ui/does-not-exist' });
    await tick();
    expect(host.sent[0]).toEqual({ jsonrpc: '2.0', id: 'p1', result: {} });
    expect(host.sent[1]?.id).toBe('x1');
    expect(host.sent[1]?.error?.code).toBe(METHOD_NOT_FOUND);
  });
});

describe('teardown', () => {
  test('the handler runs to its end, then {} — afterwards the bridge is closed', async () => {
    const order: string[] = [];
    const { host, bridge } = await connected({
      on: {
        teardown: async (reason) => {
          order.push(`teardown:${reason}`);
          await tick();
          order.push('saved');
        }
      }
    });
    host.deliver({
      jsonrpc: '2.0',
      id: 41,
      method: 'ui/resource-teardown',
      params: { reason: 'navigation' }
    });
    // No answer yet: the handler is waiting.
    expect(host.sent).toHaveLength(0);
    await tick();
    await tick();
    expect(order).toEqual(['teardown:navigation', 'saved']);
    expect(host.sent).toEqual([{ jsonrpc: '2.0', id: 41, result: {} }]);
    expect(bridge.connected).toBe(false);
    expect(host.listening()).toBe(false);
    await expect(bridge.ping()).rejects.toThrow();
  });

  test('a failing teardown answers with an error and is loud', async () => {
    const { host, errors } = await connected({
      on: {
        teardown: () => {
          throw new Error('not saved');
        }
      }
    });
    host.deliver({ jsonrpc: '2.0', id: 42, method: 'ui/resource-teardown', params: {} });
    await tick();
    expect(host.sent[0]?.error).toEqual({
      code: IMPLEMENTATION_ERROR,
      message: 'Teardown error: not saved'
    });
    expect(errors.map((e) => e.message)).toEqual(['not saved']);
  });

  test('when the teardown answer does not go out, that is loud — and the bridge closed', async () => {
    const { host, bridge, errors } = await connected();
    host.breakWire(new Error('wire cut'));
    host.deliver({ jsonrpc: '2.0', id: 43, method: 'ui/resource-teardown', params: {} });
    await tick();
    expect(errors.map((e) => e.message)).toEqual(['wire cut']);
    expect(bridge.connected).toBe(false);
    expect(host.listening()).toBe(false);
  });

  test('open requests are rejected on close', async () => {
    const { bridge } = await connected();
    const call = toolCaller(bridge).callTool('get_note', {});
    bridge.close();
    await expect(call).rejects.toThrow('closed');
  });
});

describe('what a view gets of the bridge', () => {
  test('the ViewBridge has no free request and no callTool — at runtime either', async () => {
    // The spec grants a tool's "app" visibility to every view of the server;
    // a view without `callsTools` must therefore have no path to tools/call at
    // all. A narrower type alone would leave `request` on the object.
    const { bridge } = await connected();
    const forView = viewBridge(bridge) as unknown as Record<string, unknown>;
    for (const name of ['request', 'notify', 'callTool', 'readResource', 'close', 'connect']) {
      expect(forView[name], name).toBeUndefined();
    }
  });

  test('… and sends what it may send, under fixed names, through the same bridge', async () => {
    const { host, bridge } = await connected();
    const forView = viewBridge(bridge);
    void forView.sendMessage('[ui-action] {}');
    void forView.openLink('https://example.com/note/1');
    void forView.updateModelContext({ content: [{ type: 'text', text: 'x' }] });
    expect(host.sent.map((message) => message.method)).toEqual([
      'ui/message',
      'ui/open-link',
      'ui/update-model-context'
    ]);
    expect(forView.connected).toBe(true);
  });
});

describe('the wire over window.parent', () => {
  function fakeWindow() {
    const posted: [unknown, string][] = [];
    const parent = {
      postMessage: (message: unknown, origin: string) => posted.push([message, origin])
    };
    let listener: ((event: { source: unknown; data: unknown }) => void) | null = null;
    const win: WindowLike = {
      parent,
      addEventListener: (_type, l) => {
        listener = l;
      },
      removeEventListener: () => {
        listener = null;
      }
    };
    return {
      win,
      parent,
      posted,
      dispatch: (event: { source: unknown; data: unknown }) => listener?.(event)
    };
  }

  test('only the parent window is heard — by event.source, not by origin', () => {
    const { win, parent, dispatch } = fakeWindow();
    const heard: unknown[] = [];
    const stop = windowTransport(win).listen((data) => heard.push(data));
    dispatch({ source: parent, data: 'from the host' });
    // Another window — a second iframe of the same page, say — does not take
    // part, even when its message looks like ours.
    dispatch({ source: { postMessage() {} }, data: 'from next door' });
    dispatch({ source: null, data: 'from nobody' });
    expect(heard).toEqual(['from the host']);
    stop();
    dispatch({ source: parent, data: 'after the end' });
    expect(heard).toEqual(['from the host']);
  });

  test('sent to window.parent', () => {
    const { win, posted } = fakeWindow();
    windowTransport(win).send({ jsonrpc: '2.0', method: 'ping', id: 1 });
    expect(posted).toEqual([[{ jsonrpc: '2.0', method: 'ping', id: 1 }, '*']]);
  });
});

describe('size-changed', () => {
  function reporter(sizes: { width: number; height: number }[]) {
    const queue: (() => void)[] = [];
    const sent: unknown[] = [];
    let measured = 0;
    const r = createSizeReporter({
      measure: () => sizes[Math.min(measured++, sizes.length - 1)]!,
      schedule: (callback) => queue.push(callback),
      send: (size) => sent.push(size)
    });
    const flush = () => {
      for (const callback of queue.splice(0)) callback();
    };
    return { r, sent, flush, measures: () => measured };
  }

  test('debounced: three changes in one frame measure once', () => {
    const { r, sent, flush, measures } = reporter([{ width: 400, height: 120 }]);
    r.changed();
    r.changed();
    r.changed();
    flush();
    expect(measures()).toBe(1);
    expect(sent).toEqual([{ width: 400, height: 120 }]);
  });

  test('only a real change is reported', () => {
    const { r, sent, flush } = reporter([
      { width: 400, height: 120 },
      { width: 400, height: 120 },
      { width: 400, height: 168 }
    ]);
    r.changed();
    flush();
    r.changed();
    flush();
    r.changed();
    flush();
    expect(sent).toEqual([
      { width: 400, height: 120 },
      { width: 400, height: 168 }
    ]);
  });
});

describe('the theme', () => {
  test('theme sets color-scheme on the root — without one it stays', () => {
    const root = { style: { colorScheme: 'light dark' } };
    applyTheme(root, {});
    expect(root.style.colorScheme).toBe('light dark');
    applyTheme(root, { theme: 'dark' });
    expect(root.style.colorScheme).toBe('dark');
    applyTheme(root, { theme: 'light' });
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('the wire by the SDK schemas', () => {
  /**
   * What a host would object to in the bridge's messages (`wireProblem`). An
   * answer carries no method — that is in the host's request with the same id.
   */
  function problemsOf(sent: JsonRpcMessage[], asked: Map<unknown, string>): string[] {
    return sent.flatMap((message) => {
      const problem = wireProblem(message, asked.get(message.id));
      return problem ? [`${JSON.stringify(message)} → ${problem}`] : [];
    });
  }

  test('every message the bridge can send passes', async () => {
    const host = fakeHost();
    const bridge = createBridge(host.transport, {
      appInfo: APP_INFO,
      appCapabilities: { availableDisplayModes: ['inline'] }
    });
    const done = bridge.connect();
    host.deliver({
      jsonrpc: '2.0',
      id: host.sent[0]!.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        hostInfo: { name: 'probe', version: '1' },
        hostCapabilities: {},
        hostContext: { theme: 'light', displayMode: 'inline' }
      }
    });
    await done;
    const forView = viewBridge(bridge);
    // Unanswered: the teardown below rejects them.
    const open = [
      forView.sendMessage('[ui-action] {}'),
      forView.updateModelContext({ content: [{ type: 'text', text: 'Priority 1' }] }),
      forView.updateModelContext({ structuredContent: { noteId: 'n1' } }),
      forView.openLink('https://example.com/note/1'),
      forView.requestDisplayMode('inline'),
      bridge.ping(),
      bridge.readResource('ui://notes/note'),
      toolCaller(bridge).callTool('get_note', { id: 'n1' })
    ];
    bridge.log('warning', { what: 'x' });
    bridge.sizeChanged({ width: 700, height: 420 });
    // The view's two answers: refused (the view registers no tools) and teardown.
    const asked = new Map<unknown, string>([
      [7, 'tools/call'],
      [8, 'ui/resource-teardown']
    ]);
    host.deliver({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'x', arguments: {} }
    });
    host.deliver({
      jsonrpc: '2.0',
      id: 8,
      method: 'ui/resource-teardown',
      params: { reason: 'e2e' }
    });
    await Promise.allSettled(open);
    expect(host.sent.map((message) => message.method ?? `answer to ${message.id}`)).toEqual([
      'ui/initialize',
      'ui/notifications/initialized',
      'ui/message',
      'ui/update-model-context',
      'ui/update-model-context',
      'ui/open-link',
      'ui/request-display-mode',
      'ping',
      'resources/read',
      'tools/call',
      'notifications/message',
      'ui/notifications/size-changed',
      'answer to 7',
      'answer to 8'
    ]);
    expect(problemsOf(host.sent, asked)).toEqual([]);
  });
});
