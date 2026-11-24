/**
 * The dispatcher — MCP 2026-07-28 around a tool list, a call and the view
 * catalog, HTTP in and out. The status table and the header checks are
 * pinned here; that the answers are what a 2026 client takes, the SDK's own
 * client says at the end, and the conformance suite in CI
 * (`bun run test:conformance`).
 */
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR
} from '../jsonrpc.ts';
import {
  CLIENT_CAPABILITIES_KEY,
  encodeHeaderValue,
  HEADER_MISMATCH,
  MCP_PROTOCOL_VERSION,
  PROTOCOL_VERSION_KEY,
  requestHeaders,
  SERVER_INFO_KEY,
  UI_EXTENSION,
  UNSUPPORTED_PROTOCOL_VERSION
} from '../mcp.ts';
import { createViewCatalog, type Outcome } from './catalog.ts';
import { createDispatcher, type DispatcherOptions, NO_CACHE } from './dispatcher.ts';

interface Caller {
  userId: string;
}

const CALLER: Caller = { userId: 'u1' };
const SECRET = 'password=hunter2';
const NOTE_HTML = '<!doctype html><html><body>note</body></html>';
const INFO = { name: 'notes', version: '1.0.0' };
const URL_ = 'http://notes.test/mcp';

const views = createViewCatalog({
  server: 'notes',
  views: { note: { title: 'Note', description: 'One note, as a card.' } },
  html: () => NOTE_HTML
});

const TOOLS = [
  {
    name: 'show_note',
    description: 'Shows a note.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    _meta: views.toolMeta({ view: 'note' })
  },
  {
    name: 'fail',
    description: 'Throws.',
    inputSchema: { type: 'object' },
    _meta: views.toolMeta()
  }
];

const text = (value: string) => [{ type: 'text', text: value }];

/** As `JSON.parse` delivers them — `1e300` and `2^53` are integers to JavaScript, not safe ones. */
const UNUSABLE_IDS: [label: string, id: unknown][] = [
  ['null', null],
  ['an object', { x: 1 }],
  ['an array', [1]],
  ['a fraction', 1.5],
  ['true', true],
  ['2^53', JSON.parse('9007199254740992')],
  ['−2^53', JSON.parse('-9007199254740992')],
  ['1e300', JSON.parse('1e300')]
];

/** What every request of a 2026 client carries in `params._meta`. */
const ENVELOPE = { [PROTOCOL_VERSION_KEY]: MCP_PROTOCOL_VERSION, [CLIENT_CAPABILITIES_KEY]: {} };

/** The added fields of a result that is not cacheable. */
const STAMP = { resultType: 'complete', _meta: { [SERVER_INFO_KEY]: INFO } };
/** … and of one that is, with the default hint. */
const CACHED = { ...STAMP, ...NO_CACHE };

interface Answer {
  status: number;
  headers: Headers;
  body: any;
}

async function read(response: Response): Promise<Answer> {
  const raw = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: raw === '' ? null : JSON.parse(raw)
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}

interface AskOptions {
  id?: unknown;
  /** Replaces the derived headers; `undefined` as a value leaves one out. */
  headers?: Record<string, string | undefined>;
  /** The `_meta` of the request; `null` sends none. */
  meta?: Record<string, unknown> | null;
}

/** The app's half: a tool list, a call, and what each received. */
function appOf(overrides: Partial<DispatcherOptions<Caller>> = {}) {
  const calls: { name: string; args: unknown; caller: Caller }[] = [];
  const listed: Caller[] = [];
  const dispatcher = createDispatcher<Caller>({
    serverInfo: INFO,
    instructions: 'Notes of one person.',
    views,
    tools(caller) {
      listed.push(caller);
      return TOOLS;
    },
    async call(name, args, caller): Promise<Outcome> {
      calls.push({ name, args, caller });
      switch (name) {
        case 'show_note': {
          const id = (args as { id?: unknown } | undefined)?.id;
          if (typeof id !== 'string') {
            return { error: { code: INVALID_PARAMS, message: 'show_note needs a string id.' } };
          }
          return { result: { content: text(`Note ${id}`), structuredContent: { id } } };
        }
        case 'domain':
          return { result: { content: text('No note n9.'), isError: true } };
        case 'fail':
          throw new Error(SECRET);
        case 'broken':
          return {} as Outcome;
        default:
          return { error: { code: INVALID_PARAMS, message: `Unknown tool: ${name}` } };
      }
    },
    ...overrides
  });
  const send = async (request: Request) => read(await dispatcher.handle(request, CALLER));
  /** A request as a 2026 client sends it — envelope and headers derived — unless told otherwise. */
  async function ask(method: string, params?: Record<string, unknown>, o: AskOptions = {}) {
    const meta = o.meta === undefined ? ENVELOPE : o.meta;
    const full = meta === null ? params : { ...params, _meta: meta };
    const derived: Record<string, string | undefined> = {
      ...requestHeaders(method, full),
      ...o.headers
    };
    const headers = Object.fromEntries(
      Object.entries(derived).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    const id = 'id' in o ? o.id : 1;
    return send(post({ jsonrpc: '2.0', id, method, ...(full ? { params: full } : {}) }, headers));
  }
  return { calls, listed, ask, send, dispatcher };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('server/discover', () => {
  test('the one revision, tools beside the views’ capabilities, instructions, the identity', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('server/discover');
    expect(status).toBe(200);
    expect(body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        ...CACHED,
        supportedVersions: [MCP_PROTOCOL_VERSION],
        capabilities: { tools: {}, resources: {}, extensions: { [UI_EXTENSION]: {} } },
        instructions: 'Notes of one person.'
      }
    });
  });

  test('without views and instructions: tools only, no instructions key', async () => {
    const { ask } = appOf({ views: undefined, instructions: undefined });
    const { result } = (await ask('server/discover')).body;
    expect(result.capabilities).toEqual({ tools: {} });
    expect('instructions' in result).toBe(false);
  });
});

describe('tools/list', () => {
  test('hands the caller to tools() and answers { tools }, stamped', async () => {
    const { ask, listed } = appOf();
    expect((await ask('tools/list')).body.result).toEqual({ ...CACHED, tools: TOOLS });
    expect(listed).toEqual([CALLER]);
  });

  test('tools() may answer asynchronously', async () => {
    const { ask } = appOf({ tools: async () => TOOLS.slice(0, 1) });
    expect((await ask('tools/list')).body.result.tools).toEqual(TOOLS.slice(0, 1));
  });
});

describe('cache', () => {
  test('a hint per method; the ones left out keep NO_CACHE', async () => {
    const { ask } = appOf({
      cache: {
        'resources/read': { ttlMs: 86_400_000, cacheScope: 'public' },
        'tools/list': { ttlMs: 60_000, cacheScope: 'private' }
      }
    });
    const hint = async (method: string, params?: Record<string, unknown>) => {
      const { ttlMs, cacheScope } = (await ask(method, params)).body.result;
      return { ttlMs, cacheScope };
    };
    expect(await hint('resources/read', { uri: views.uri('note') })).toEqual({
      ttlMs: 86_400_000,
      cacheScope: 'public'
    });
    expect(await hint('tools/list')).toEqual({ ttlMs: 60_000, cacheScope: 'private' });
    expect(await hint('server/discover')).toEqual(NO_CACHE);
    expect(await hint('resources/list')).toEqual(NO_CACHE);
    expect(await hint('resources/templates/list')).toEqual(NO_CACHE);
  });

  test('tools/call is not cacheable and carries no hint', async () => {
    const { ask } = appOf({ cache: { 'tools/list': { ttlMs: 5, cacheScope: 'public' } } });
    const { result } = (await ask('tools/call', { name: 'domain' })).body;
    expect('ttlMs' in result || 'cacheScope' in result).toBe(false);
  });

  test.each([-1, 1.5, Number.NaN, '60' as unknown as number])(
    'a ttlMs of %s is a loud stop at creation',
    (ttlMs) => {
      expect(() => appOf({ cache: { 'tools/list': { ttlMs, cacheScope: 'private' } } })).toThrow(
        'cache["tools/list"].ttlMs must be an integer ≥ 0'
      );
    }
  );

  test('a cacheScope other than public or private is a loud stop at creation', () => {
    const cacheScope = 'shared' as 'public';
    expect(() => appOf({ cache: { 'tools/list': { ttlMs: 5, cacheScope } } })).toThrow(
      `cache["tools/list"].cacheScope must be 'public' or 'private', not "shared"`
    );
  });

  test('a method that is not cacheable is a loud stop at creation', () => {
    const cache = { 'tools/call': NO_CACHE } as DispatcherOptions<Caller>['cache'];
    expect(() => appOf({ cache })).toThrow('cache["tools/call"]: not a cacheable method');
  });
});

describe('tools/call', () => {
  test('hands name, arguments and caller to call() and answers its result, stamped', async () => {
    const { ask, calls } = appOf();
    const { status, body } = await ask('tools/call', {
      name: 'show_note',
      arguments: { id: 'n1' }
    });
    expect(status).toBe(200);
    expect(body.result).toEqual({
      ...STAMP,
      content: text('Note n1'),
      structuredContent: { id: 'n1' }
    });
    expect(calls).toEqual([{ name: 'show_note', args: { id: 'n1' }, caller: CALLER }]);
  });

  test('the result’s own _meta stays, the identity joins it', async () => {
    const { ask } = appOf({ call: () => ({ result: { content: [], _meta: { mine: 1 } } }) });
    expect((await ask('tools/call', { name: 'x' })).body.result._meta).toEqual({
      mine: 1,
      [SERVER_INFO_KEY]: INFO
    });
  });

  test('an identity the result sets itself wins', async () => {
    const own = { name: 'proxied', version: '9' };
    const { ask } = appOf({
      call: () => ({ result: { content: [], _meta: { [SERVER_INFO_KEY]: own } } })
    });
    expect((await ask('tools/call', { name: 'x' })).body.result._meta[SERVER_INFO_KEY]).toEqual(
      own
    );
  });

  test('arguments arrive as they came — undefined when absent', async () => {
    const { ask, calls } = appOf();
    await ask('tools/call', { name: 'other' });
    await ask('tools/call', { name: 'other', arguments: [1] });
    expect(calls.map((c) => c.args)).toEqual([undefined, [1]]);
  });

  test('a result with isError stays a result', async () => {
    const { ask } = appOf();
    expect((await ask('tools/call', { name: 'domain' })).body.result).toEqual({
      ...STAMP,
      content: text('No note n9.'),
      isError: true
    });
  });

  test('a protocol error from call() is the error under the request’s id, HTTP 200', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/call', { name: 'show_note' });
    expect(status).toBe(200);
    expect(body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: INVALID_PARAMS, message: 'show_note needs a string id.' }
    });
  });

  test.each([
    ['no params', undefined],
    ['no name', { arguments: {} }]
  ])('%s: -32602, and call() does not run', async (_label, params) => {
    const { ask, calls } = appOf();
    const { status, body } = await ask('tools/call', params);
    expect(status).toBe(200);
    expect(body.error).toEqual({ code: INVALID_PARAMS, message: 'tools/call needs params.name.' });
    expect(calls).toEqual([]);
  });

  test('a throw is -32603 with a general sentence — the error goes to the log only', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf();
    const { status, body } = await ask('tools/call', { name: 'fail' });
    expect(status).toBe(200);
    expect(body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: INTERNAL_ERROR, message: 'tools/call fail failed on the server.' }
    });
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[1])).toContain(SECRET);
  });

  test('a log that throws costs no answer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('printing failed');
    });
    const { ask } = appOf();
    expect((await ask('tools/call', { name: 'fail' })).body.error.code).toBe(INTERNAL_ERROR);
  });

  test('an outcome that is neither result nor error is -32603, not a broken answer', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf();
    expect((await ask('tools/call', { name: 'broken' })).body.error.code).toBe(INTERNAL_ERROR);
    expect(log).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['an Error in place of the error object', { error: new Error(SECRET) }],
    ['a database error, its code text', { error: { code: '23505', message: `dup ${SECRET}` } }],
    ['a code that is no integer', { error: { code: 1.5, message: SECRET } }],
    ['no message', { error: { code: INVALID_PARAMS } }]
  ])(
    'an error outcome with %s is -32603, and the outcome goes to the log only',
    async (_label, outcome) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { ask } = appOf({ call: () => outcome as unknown as Outcome });
      const { body } = await ask('tools/call', { name: 'db' });
      expect(body).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: { code: INTERNAL_ERROR, message: 'tools/call db failed on the server.' }
      });
      expect(JSON.stringify(body)).not.toContain(SECRET);
      expect(log).toHaveBeenCalledTimes(1);
      const logged = log.mock.calls[0]?.[1] as Error | undefined;
      expect(logged?.cause).toBe(outcome);
    }
  );

  test('an error outcome keeps its data', async () => {
    const { ask } = appOf({
      call: () => ({ error: { code: INVALID_PARAMS, message: 'x', data: { field: 'id' } } })
    });
    expect((await ask('tools/call', { name: 'x' })).body.error).toEqual({
      code: INVALID_PARAMS,
      message: 'x',
      data: { field: 'id' }
    });
  });

  test('a throwing tools() is -32603 as well', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf({
      tools: () => {
        throw new Error(SECRET);
      }
    });
    const { body } = await ask('tools/list');
    expect(body.error).toEqual({
      code: INTERNAL_ERROR,
      message: 'tools/list failed on the server.'
    });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});

describe('resources/* go to the catalog', () => {
  test('list, templates and read answer what the catalog answers, stamped', async () => {
    const { ask } = appOf();
    for (const [method, params] of [
      ['resources/list', undefined],
      ['resources/templates/list', undefined],
      ['resources/read', { uri: views.uri('note') }],
      ['resources/read', { uri: 'ui://notes/gone' }],
      ['resources/read', {}]
    ] as const) {
      const expected = views.handle(method, params);
      if (expected === null) throw new Error(`The catalog does not answer ${method}.`);
      const { status, body } = await ask(method, params);
      expect(status, method).toBe(200);
      expect(body, method).toEqual(
        'error' in expected
          ? { jsonrpc: '2.0', id: 1, error: expected.error }
          : { jsonrpc: '2.0', id: 1, result: { ...CACHED, ...expected.result } }
      );
    }
  });

  test('an unknown URI is -32602 with the URI in data', async () => {
    const { ask } = appOf();
    expect((await ask('resources/read', { uri: 'ui://x/y' })).body.error).toEqual({
      code: INVALID_PARAMS,
      message: 'Resource not found: ui://x/y',
      data: { uri: 'ui://x/y' }
    });
  });

  test('a view whose html() throws is -32603, not a thrown handle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = createViewCatalog({
      server: 'notes',
      views: { note: { title: 'Note', description: 'x' } },
      html: () => {
        throw new Error(SECRET);
      }
    });
    const { ask } = appOf({ views: throwing });
    const { body } = await ask('resources/list');
    expect(body.error.code).toBe(INTERNAL_ERROR);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  test('without views, resources/* do not exist: 404', async () => {
    const { ask } = appOf({ views: undefined });
    const { status, body } = await ask('resources/list');
    expect(status).toBe(404);
    expect(body.error.code).toBe(METHOD_NOT_FOUND);
  });
});

describe('methods the revision does not have', () => {
  test.each(['prompts/list', 'ping', 'initialize', 'logging/setLevel', 'resources/subscribe'])(
    '%s: 404, -32601 under the id',
    async (method) => {
      const { ask } = appOf();
      const { status, body } = await ask(method, {}, { id: 5 });
      expect(status).toBe(404);
      expect(body).toEqual({
        jsonrpc: '2.0',
        id: 5,
        error: { code: METHOD_NOT_FOUND, message: `Method not found: ${method}` }
      });
    }
  );
});

describe('the transport', () => {
  test.each(['GET', 'DELETE', 'PUT'])('%s: 405, Allow: POST', async (method) => {
    const { send } = appOf();
    const { status, headers, body } = await send(new Request(URL_, { method }));
    expect(status).toBe(405);
    expect(headers.get('allow')).toBe('POST');
    expect('id' in body).toBe(false);
  });

  test('a body that is not JSON: 400, -32700 without id', async () => {
    const { send } = appOf();
    const { status, body } = await send(post('{kaputt'));
    expect(status).toBe(400);
    expect(body).toEqual({
      jsonrpc: '2.0',
      error: { code: PARSE_ERROR, message: 'The body is not JSON.' }
    });
  });

  test('a batch: 400, -32600 without id, and nothing in it runs', async () => {
    const { send, calls } = appOf();
    const { status, body } = await send(
      post([
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'x', _meta: ENVELOPE } }
      ])
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe(INVALID_REQUEST);
    expect('id' in body).toBe(false);
    expect(calls).toEqual([]);
  });

  test.each([
    ['a method that is no string', { jsonrpc: '2.0', id: 5, method: 5 }, 5],
    ['no method', { jsonrpc: '2.0', id: 5 }, 5],
    ['text', 'kaputt', undefined],
    ['a number', 5, undefined],
    ['null', null, undefined],
    ['no method and id null', { jsonrpc: '2.0', id: null }, undefined]
  ])('not a request (%s): 400, -32600, the id where usable', async (_label, message, id) => {
    const { send } = appOf();
    const { status, body } = await send(post(JSON.stringify(message)));
    expect(status).toBe(400);
    expect(body.error.code).toBe(INVALID_REQUEST);
    expect(body.id).toBe(id);
  });

  test('a notification: 202 without body, and a tools/call without id does not run', async () => {
    const { send, calls } = appOf();
    for (const method of ['notifications/cancelled', 'tools/call', 'no/such/method']) {
      const answer = await send(
        post({ jsonrpc: '2.0', method, params: { name: 'show_note', _meta: ENVELOPE } })
      );
      expect(answer.status, method).toBe(202);
      expect(answer.body, method).toBeNull();
    }
    expect(calls).toEqual([]);
  });

  test('a body too large to read (adapter-node’s 413): 413, the limit and a way out', async () => {
    const { dispatcher } = appOf();
    const tooLarge = Object.assign(
      new Error('Content-length of 600992 exceeds limit of 524288 bytes.'),
      { status: 413 }
    );
    const request = post('{}');
    vi.spyOn(request, 'text').mockRejectedValue(tooLarge);
    const { status, body } = await read(await dispatcher.handle(request, CALLER));
    expect(status).toBe(413);
    expect('id' in body).toBe(false);
    expect(body.error.code).toBe(INVALID_REQUEST);
    expect(body.error.message).toContain(
      '(Content-length of 600992 exceeds limit of 524288 bytes)'
    );
    expect(body.error.message).toContain('Send it shorter');
    expect(body.error.message).not.toContain('JSON');
  });

  test('any other failure to read the body is thrown, not answered', async () => {
    const { dispatcher } = appOf();
    const request = post('{}');
    vi.spyOn(request, 'text').mockRejectedValue(new Error('aborted'));
    await expect(dispatcher.handle(request, CALLER)).rejects.toThrow('aborted');
  });
});

describe('the id', () => {
  test.each([
    ['text', 'p'],
    ['empty text', ''],
    ['0', 0],
    ['a negative integer', -7],
    ['2^53 − 1', Number.MAX_SAFE_INTEGER],
    ['−(2^53 − 1)', Number.MIN_SAFE_INTEGER]
  ])('%s: the answer stands under it', async (_label, id) => {
    const { ask } = appOf();
    expect((await ask('tools/list', undefined, { id })).body.id).toBe(id);
  });

  test.each(UNUSABLE_IDS)('%s: 400, -32600 without id', async (_label, id) => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/list', undefined, { id });
    expect(status).toBe(400);
    expect(body).toEqual({
      jsonrpc: '2.0',
      error: {
        code: INVALID_REQUEST,
        message: 'The id must be a string or an integer within ±(2^53 − 1).'
      }
    });
  });

  test('a tools/call under an unusable id does not run', async () => {
    const { ask, calls } = appOf();
    await ask('tools/call', { name: 'show_note', arguments: { id: 'n1' } }, { id: null });
    expect(calls).toEqual([]);
  });
});

describe('the version and the envelope', () => {
  test('a client of 2025 (initialize, no envelope): 400, -32022 naming the revision', async () => {
    const { ask } = appOf();
    const { status, body } = await ask(
      'initialize',
      { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'c', version: '1' } },
      { meta: null, headers: { 'mcp-protocol-version': undefined, 'mcp-method': undefined } }
    );
    expect(status).toBe(400);
    expect(body.id).toBe(1);
    expect(body.error.code).toBe(UNSUPPORTED_PROTOCOL_VERSION);
    expect(body.error.data).toEqual({ supported: [MCP_PROTOCOL_VERSION], requested: '2025-11-25' });
    expect(body.error.message).toContain(MCP_PROTOCOL_VERSION);
  });

  test('a request of 2025 after the handshake (its header, no envelope): -32022', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/list', undefined, {
      meta: null,
      headers: { 'mcp-protocol-version': '2025-06-18' }
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe(UNSUPPORTED_PROTOCOL_VERSION);
    expect(body.error.data).toEqual({ supported: [MCP_PROTOCOL_VERSION], requested: '2025-06-18' });
  });

  test('no envelope, but the 2026 header: 400, -32602 naming the key', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/list', undefined, { meta: null });
    expect(status).toBe(400);
    expect(body.error.code).toBe(INVALID_PARAMS);
    expect(body.error.message).toContain(PROTOCOL_VERSION_KEY);
  });

  test('an unknown revision in the envelope and the header: 400, -32022', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/list', undefined, {
      meta: { ...ENVELOPE, [PROTOCOL_VERSION_KEY]: '2099-01-01' },
      headers: { 'mcp-protocol-version': '2099-01-01' }
    });
    expect(status).toBe(400);
    expect(body.error.data).toEqual({ supported: [MCP_PROTOCOL_VERSION], requested: '2099-01-01' });
  });

  test('a version that is no string: 400, -32602', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/list', undefined, {
      meta: { ...ENVELOPE, [PROTOCOL_VERSION_KEY]: 20260728 }
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe(INVALID_PARAMS);
  });

  test.each([undefined, 'all', ['x']])(
    'clientCapabilities of %j: 400, -32602 naming the key',
    async (capabilities) => {
      const { ask } = appOf();
      const { status, body } = await ask('tools/list', undefined, {
        meta: {
          [PROTOCOL_VERSION_KEY]: MCP_PROTOCOL_VERSION,
          [CLIENT_CAPABILITIES_KEY]: capabilities
        }
      });
      expect(status).toBe(400);
      expect(body.error.code).toBe(INVALID_PARAMS);
      expect(body.error.message).toContain(CLIENT_CAPABILITIES_KEY);
    }
  );

  test('clientInfo is optional; other keys in _meta pass', async () => {
    const { ask } = appOf();
    const { status } = await ask('tools/list', undefined, { meta: { ...ENVELOPE, mine: true } });
    expect(status).toBe(200);
  });
});

describe('the standard headers', () => {
  const rejected = async (
    method: string,
    params: Record<string, unknown> | undefined,
    headers: Record<string, string | undefined>
  ) => {
    const { ask, calls } = appOf();
    const { status, body } = await ask(method, params, { headers });
    expect(calls).toEqual([]);
    return { status, code: body.error?.code };
  };
  const MISMATCH = { status: 400, code: HEADER_MISMATCH };

  test('MCP-Protocol-Version missing, or another than the envelope’s: -32020', async () => {
    expect(await rejected('tools/list', undefined, { 'mcp-protocol-version': undefined })).toEqual(
      MISMATCH
    );
    expect(
      await rejected('tools/list', undefined, { 'mcp-protocol-version': '2025-11-25' })
    ).toEqual(MISMATCH);
  });

  test('a disagreement outranks an unknown version: -32020, not -32022', async () => {
    const { ask } = appOf();
    const { body } = await ask('tools/list', undefined, {
      meta: { ...ENVELOPE, [PROTOCOL_VERSION_KEY]: '2025-11-25' },
      headers: { 'mcp-protocol-version': MCP_PROTOCOL_VERSION }
    });
    expect(body.error.code).toBe(HEADER_MISMATCH);
  });

  test('Mcp-Method missing, another, or in another case: -32020', async () => {
    for (const value of [undefined, 'tools/list', 'TOOLS/CALL']) {
      expect(
        await rejected('tools/call', { name: 'show_note' }, { 'mcp-method': value }),
        String(value)
      ).toEqual(MISMATCH);
    }
  });

  test('Mcp-Name missing or another for tools/call and resources/read: -32020', async () => {
    expect(await rejected('tools/call', { name: 'show_note' }, { 'mcp-name': undefined })).toEqual(
      MISMATCH
    );
    expect(await rejected('tools/call', { name: 'show_note' }, { 'mcp-name': 'fail' })).toEqual(
      MISMATCH
    );
    expect(
      await rejected('resources/read', { uri: views.uri('note') }, { 'mcp-name': 'ui://notes/x' })
    ).toEqual(MISMATCH);
  });

  test('a name that is no text is no name a header mirrors: the method answers, -32602 in-band', async () => {
    for (const [method, params] of [
      ['tools/call', { name: 5 }],
      ['resources/read', { uri: 5 }]
    ] as const) {
      const { ask } = appOf();
      const { status, body } = await ask(method, params);
      expect(status, method).toBe(200);
      expect(body.error.code, method).toBe(INVALID_PARAMS);
    }
  });

  test('an own key only: a method named constructor has no name to mirror, and is 404', async () => {
    const { ask } = appOf();
    const { status } = await ask('constructor', {}, { headers: { 'mcp-name': 'x' } });
    expect(status).toBe(404);
  });

  test('the sentinel is lowercase and canonical: an uppercase frame is literal, unpadded is no base64', async () => {
    // `size` needs padding (c2l6ZQ==), so the unpadded form differs from the canonical one.
    expect(btoa('size')).toMatch(/==$/);
    for (const value of [
      `=?BASE64?${btoa('size')}?=`,
      `=?base64?${btoa('size').replace(/=+$/, '')}?=`
    ]) {
      expect(await rejected('tools/call', { name: 'size' }, { 'mcp-name': value }), value).toEqual(
        MISMATCH
      );
    }
  });

  test('a sentinel that is no base64 or no UTF-8: -32020', async () => {
    for (const value of ['=?base64?!!!?=', `=?base64?${btoa('\xff\xfe')}?=`]) {
      expect(await rejected('tools/call', { name: 'show_note' }, { 'mcp-name': value })).toEqual(
        MISMATCH
      );
    }
  });

  test('header names in any case, values with whitespace around, a name as sentinel', async () => {
    const { ask, calls } = appOf();
    const { status } = await ask(
      'tools/call',
      { name: 'show_note', arguments: { id: 'n1' } },
      {
        headers: {
          'mcp-protocol-version': undefined,
          'mcp-method': undefined,
          'mcp-name': undefined,
          'MCP-PROTOCOL-VERSION': ` ${MCP_PROTOCOL_VERSION} `,
          'Mcp-Method': ' tools/call',
          'MCP-NAME': `=?base64?${btoa('show_note')}?=`
        }
      }
    );
    expect(status).toBe(200);
    expect(calls).toHaveLength(1);
  });

  test('a name outside printable ASCII travels as sentinel and is matched decoded', async () => {
    expect(encodeHeaderValue('größe')).toMatch(/^=\?base64\?.+\?=$/);
    const { ask, calls } = appOf();
    const { status } = await ask('tools/call', { name: 'größe' });
    expect(status).toBe(200);
    expect(calls.map((c) => c.name)).toEqual(['größe']);
  });

  test('a tools/call without name and without Mcp-Name reaches the method: -32602 in-band', async () => {
    const { ask } = appOf();
    const { status, body } = await ask('tools/call', {});
    expect(status).toBe(200);
    expect(body.error.code).toBe(INVALID_PARAMS);
  });
});

describe('the options', () => {
  const call = (): Outcome => ({ result: {} });

  test('tools and call run as methods of the options, so `this` holds', async () => {
    const dispatcher = createDispatcher<Caller>({
      serverInfo: INFO,
      tools() {
        return [{ name: this.serverInfo.name, inputSchema: { type: 'object' } }];
      },
      call(name, _args, caller) {
        return { result: { content: text(`${this.serverInfo.name}/${name}/${caller.userId}`) } };
      }
    });
    const list = post(
      { jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: ENVELOPE } },
      requestHeaders('tools/list', {})
    );
    expect((await read(await dispatcher.handle(list, CALLER))).body.result.tools).toEqual([
      { name: 'notes', inputSchema: { type: 'object' } }
    ]);
    const params = { name: 'x', _meta: ENVELOPE };
    const called = post(
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params },
      requestHeaders('tools/call', params)
    );
    expect((await read(await dispatcher.handle(called, CALLER))).body.result.content).toEqual(
      text('notes/x/u1')
    );
  });

  test('without a context, handle takes the request alone', async () => {
    const dispatcher = createDispatcher({ serverInfo: INFO, tools: () => [], call });
    expect((await dispatcher.handle(new Request(URL_))).status).toBe(405);
  });

  test('with a context, handle needs it', async () => {
    const dispatcher = createDispatcher({ serverInfo: INFO, tools: (_: Caller) => [], call });
    // @ts-expect-error — the context is missing
    expect((await dispatcher.handle(new Request(URL_))).status).toBe(405);
  });

  test('a tool needs a string name and an inputSchema — the compiler says so', () => {
    const schema = { type: 'object' } as const;
    createDispatcher({
      serverInfo: INFO,
      tools: () => [{ name: 'ok', inputSchema: schema }],
      call
    });
    // A schema typed by an interface, as `JSONSchema7` is: no index signature, still a schema.
    interface ObjectSchema {
      type: 'object';
    }
    const typed: ObjectSchema = { type: 'object' };
    createDispatcher({
      serverInfo: INFO,
      tools: () => [{ name: 'typed', inputSchema: typed }],
      call
    });
    // @ts-expect-error — without inputSchema a host rejects the whole tools/list
    createDispatcher({ serverInfo: INFO, tools: () => [{ name: 'no_schema' }], call });
    // @ts-expect-error — a name that is no text
    createDispatcher({ serverInfo: INFO, tools: () => [{ name: 42, inputSchema: schema }], call });
    createDispatcher({
      serverInfo: INFO,
      // @ts-expect-error — a schema that is no object
      tools: () => [{ name: 's', inputSchema: 'object' }],
      call
    });
  });
});

/**
 * The SDK's client, pinned to 2026-07-28 — no fallback to `initialize` — on a
 * `fetch` that goes straight into `handle`. It validates every result
 * against its schemas for the revision; the control below shows it does.
 */
describe('the SDK’s 2026-07-28 client speaks to it', () => {
  async function connect(rewrite?: (body: Record<string, unknown>) => void) {
    const { dispatcher } = appOf();
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const response = await dispatcher.handle(new Request(input, init), CALLER);
      if (!rewrite || response.status !== 200) return response;
      const body = await response.json();
      rewrite(body);
      return Response.json(body, { status: response.status });
    };
    const client = new Client(
      { name: 'sdk-client', version: '0.0.0' },
      { versionNegotiation: { mode: { pin: MCP_PROTOCOL_VERSION } } }
    );
    await client.connect(new StreamableHTTPClientTransport(new URL(URL_), { fetch }));
    return client;
  }

  test('discover, tools, a call, the views, and an unknown URI as -32602', async () => {
    const client = await connect();
    expect(client.getServerVersion()).toEqual(INFO);
    expect(client.getInstructions()).toBe('Notes of one person.');
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['show_note', 'fail']);
    const called = await client.callTool({ name: 'show_note', arguments: { id: 'n1' } });
    expect(called.structuredContent).toEqual({ id: 'n1' });
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual([views.uri('note')]);
    const { contents } = await client.readResource({ uri: views.uri('note') });
    expect(contents[0]).toMatchObject({ text: NOTE_HTML });
    await expect(client.readResource({ uri: 'ui://notes/gone' })).rejects.toMatchObject({
      code: INVALID_PARAMS
    });
    await client.close();
  });

  test('positive control: without ttlMs and cacheScope it rejects tools/list', async () => {
    const client = await connect((body) => {
      const result = body.result as Record<string, unknown> | undefined;
      if (result && 'tools' in result) {
        delete result.ttlMs;
        delete result.cacheScope;
      }
    });
    await expect(client.listTools()).rejects.toThrow();
    await client.close();
  });
});
