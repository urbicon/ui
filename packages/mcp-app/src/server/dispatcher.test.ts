/**
 * The dispatcher — the JSON-RPC envelope around a tool list, a call and the
 * view catalog. Every answer goes through `wireProblem`, the SDK's schemas a
 * host validates with; the id rules are pinned against them, not against
 * this package's own reading of the spec.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR
} from '../jsonrpc.ts';
import { wireProblem } from '../testing/wire.ts';
import { createViewCatalog, type Outcome, RESOURCE_NOT_FOUND } from './catalog.ts';
import {
  bodyTooLargeResponse,
  createDispatcher,
  type DispatcherOptions,
  type JsonRpcResponse,
  MAX_BATCH,
  MCP_PROTOCOL_VERSIONS,
  parseErrorResponse
} from './dispatcher.ts';

interface Caller {
  userId: string;
}

const CALLER: Caller = { userId: 'u1' };
const SECRET = 'password=hunter2';
const NOTE_HTML = '<!doctype html><html><body>note</body></html>';

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

/** The app's half: a tool list, a call, and what each received. */
function appOf(overrides: Partial<DispatcherOptions<Caller>> = {}) {
  const calls: { name: string; args: unknown; caller: Caller }[] = [];
  const listed: Caller[] = [];
  const dispatcher = createDispatcher<Caller>({
    serverInfo: { name: 'notes', version: '1.0.0' },
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
  return {
    calls,
    listed,
    ask: (payload: unknown) => dispatcher.dispatch(payload, CALLER)
  };
}

const request = (id: unknown, method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id,
  method,
  ...(params === undefined ? {} : { params })
});
const notification = (method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  method,
  ...(params === undefined ? {} : { params })
});

function single(answer: JsonRpcResponse | JsonRpcResponse[] | null): JsonRpcResponse {
  if (answer === null || Array.isArray(answer)) {
    throw new Error(`One answer was expected: ${JSON.stringify(answer)}`);
  }
  return answer;
}

function resultOf(answer: JsonRpcResponse | JsonRpcResponse[] | null): Record<string, unknown> {
  const one = single(answer);
  if ('error' in one) throw new Error(`Error ${one.error.code}: ${one.error.message}`);
  return one.result;
}

function errorOf(answer: JsonRpcResponse | JsonRpcResponse[] | null) {
  const one = single(answer);
  if (!('error' in one)) throw new Error(`An error was expected: ${JSON.stringify(one)}`);
  return one.error;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initialize', () => {
  test.each(MCP_PROTOCOL_VERSIONS)('agrees to %s when the client asks for it', async (version) => {
    const { ask } = appOf();
    const result = resultOf(await ask(request(1, 'initialize', { protocolVersion: version })));
    expect(result.protocolVersion).toBe(version);
  });

  test.each([
    ['an unknown version', { protocolVersion: '1999-01-01' }],
    ['a version that is no string', { protocolVersion: 20250618 }],
    ['no version', {}],
    ['params that are no object', 'x'],
    ['no params', undefined]
  ])('answers with the preferred version for %s', async (_label, params) => {
    const { ask } = appOf();
    const result = resultOf(await ask(request(1, 'initialize', params)));
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSIONS[0]);
  });

  test('serverInfo, instructions, and tools beside the views’ capabilities', async () => {
    const { ask } = appOf();
    expect(resultOf(await ask(request(1, 'initialize', {})))).toEqual({
      protocolVersion: MCP_PROTOCOL_VERSIONS[0],
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: 'notes', version: '1.0.0' },
      instructions: 'Notes of one person.'
    });
  });

  test('without views and instructions: tools only, no instructions key', async () => {
    const { ask } = appOf({ views: undefined, instructions: undefined });
    const result = resultOf(await ask(request(1, 'initialize', {})));
    expect(result.capabilities).toEqual({ tools: {} });
    expect('instructions' in result).toBe(false);
  });

  test('protocolVersions: the first is preferred, the rest agreed to', async () => {
    const { ask } = appOf({ protocolVersions: ['2025-11-25', '2025-06-18'] });
    const asked = async (protocolVersion: string) =>
      resultOf(await ask(request(1, 'initialize', { protocolVersion }))).protocolVersion;
    expect(await asked('2025-06-18')).toBe('2025-06-18');
    expect(await asked('2025-11-25')).toBe('2025-11-25');
    expect(await asked('2024-11-05')).toBe('2025-11-25');
  });

  test('an empty protocolVersions is a loud stop at creation', () => {
    expect(() => appOf({ protocolVersions: [] })).toThrow('at least one version');
  });
});

describe('ping and tools/list', () => {
  test('ping answers {}', async () => {
    const { ask } = appOf();
    expect(resultOf(await ask(request('p', 'ping')))).toEqual({});
  });

  test('tools/list hands the caller to tools() and answers { tools }', async () => {
    const { ask, listed } = appOf();
    expect(resultOf(await ask(request(2, 'tools/list')))).toEqual({ tools: TOOLS });
    expect(listed).toEqual([CALLER]);
  });

  test('tools() may answer asynchronously', async () => {
    const { ask } = appOf({ tools: async () => TOOLS.slice(0, 1) });
    expect(resultOf(await ask(request(2, 'tools/list')))).toEqual({ tools: TOOLS.slice(0, 1) });
  });
});

describe('tools/call', () => {
  test('hands name, arguments and caller to call() and answers its result', async () => {
    const { ask, calls } = appOf();
    const result = resultOf(
      await ask(request(3, 'tools/call', { name: 'show_note', arguments: { id: 'n1' } }))
    );
    expect(result).toEqual({ content: text('Note n1'), structuredContent: { id: 'n1' } });
    expect(calls).toEqual([{ name: 'show_note', args: { id: 'n1' }, caller: CALLER }]);
  });

  test('arguments arrive as they came — undefined when absent', async () => {
    const { ask, calls } = appOf();
    await ask(request(3, 'tools/call', { name: 'other' }));
    await ask(request(3, 'tools/call', { name: 'other', arguments: [1] }));
    expect(calls.map((c) => c.args)).toEqual([undefined, [1]]);
  });

  test('a result with isError stays a result', async () => {
    const { ask } = appOf();
    expect(resultOf(await ask(request(3, 'tools/call', { name: 'domain' })))).toEqual({
      content: text('No note n9.'),
      isError: true
    });
  });

  test('a protocol error from call() is the error under the request’s id', async () => {
    const { ask } = appOf();
    const answer = single(await ask(request(3, 'tools/call', { name: 'show_note' })));
    expect(answer).toEqual({
      jsonrpc: '2.0',
      id: 3,
      error: { code: INVALID_PARAMS, message: 'show_note needs a string id.' }
    });
  });

  test.each([
    ['no params', undefined],
    ['params that are no object', [1]],
    ['no name', { arguments: {} }],
    ['a name that is no string', { name: 5 }]
  ])('%s: -32602, and call() does not run', async (_label, params) => {
    const { ask, calls } = appOf();
    expect(errorOf(await ask(request(3, 'tools/call', params)))).toEqual({
      code: INVALID_PARAMS,
      message: 'tools/call needs params.name.'
    });
    expect(calls).toEqual([]);
  });

  test('a throw is -32603 with a general sentence — the error goes to the log only', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf();
    const answer = single(await ask(request(3, 'tools/call', { name: 'fail' })));
    expect(answer).toEqual({
      jsonrpc: '2.0',
      id: 3,
      error: { code: INTERNAL_ERROR, message: 'tools/call fail failed on the server.' }
    });
    expect(JSON.stringify(answer)).not.toContain(SECRET);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[1])).toContain(SECRET);
  });

  test('an outcome that is neither result nor error is -32603, not a broken answer', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf();
    expect(errorOf(await ask(request(3, 'tools/call', { name: 'broken' }))).code).toBe(
      INTERNAL_ERROR
    );
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
      const answer = single(await ask(request(3, 'tools/call', { name: 'db' })));
      expect(answer).toEqual({
        jsonrpc: '2.0',
        id: 3,
        error: { code: INTERNAL_ERROR, message: 'tools/call db failed on the server.' }
      });
      expect(JSON.stringify(answer)).not.toContain(SECRET);
      expect(log).toHaveBeenCalledTimes(1);
      const logged = log.mock.calls[0]?.[1] as Error | undefined;
      expect(logged?.cause).toBe(outcome);
    }
  );

  test('a throwing tools() is -32603 as well', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf({
      tools: () => {
        throw new Error(SECRET);
      }
    });
    const answer = await ask(request(2, 'tools/list'));
    expect(errorOf(answer)).toEqual({
      code: INTERNAL_ERROR,
      message: 'tools/list failed on the server.'
    });
    expect(JSON.stringify(answer)).not.toContain(SECRET);
  });
});

describe('the options', () => {
  const INFO = { name: 'notes', version: '1.0.0' };
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
    expect(resultOf(await dispatcher.dispatch(request(1, 'tools/list'), CALLER))).toEqual({
      tools: [{ name: 'notes', inputSchema: { type: 'object' } }]
    });
    expect(
      resultOf(await dispatcher.dispatch(request(2, 'tools/call', { name: 'x' }), CALLER))
    ).toEqual({ content: text('notes/x/u1') });
  });

  test('without a context, dispatch takes the payload alone', async () => {
    const dispatcher = createDispatcher({ serverInfo: INFO, tools: () => [], call });
    expect(single(await dispatcher.dispatch(request(1, 'ping')))).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {}
    });
  });

  test('with a context, dispatch needs it', async () => {
    const dispatcher = createDispatcher({ serverInfo: INFO, tools: (_: Caller) => [], call });
    // @ts-expect-error — the context is missing
    expect(await dispatcher.dispatch(request(1, 'ping'))).not.toBeNull();
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

describe('resources/* go to the catalog', () => {
  test('list, templates and read answer what the catalog answers', async () => {
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
      const answer = single(await ask(request(4, method, params)));
      expect(answer, method).toEqual(
        'error' in expected
          ? { jsonrpc: '2.0', id: 4, error: expected.error }
          : { jsonrpc: '2.0', id: 4, result: expected.result }
      );
    }
    expect(errorOf(await ask(request(4, 'resources/read', { uri: 'ui://x/y' }))).code).toBe(
      RESOURCE_NOT_FOUND
    );
  });

  test('a view whose html() throws is -32603, not a thrown dispatch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = createViewCatalog({
      server: 'notes',
      views: { note: { title: 'Note', description: 'x' } },
      html: () => {
        throw new Error(SECRET);
      }
    });
    const { ask } = appOf({ views: throwing });
    const answer = await ask(request(4, 'resources/list'));
    expect(errorOf(answer).code).toBe(INTERNAL_ERROR);
    expect(JSON.stringify(answer)).not.toContain(SECRET);
  });

  test('without views, resources/* do not exist', async () => {
    const { ask } = appOf({ views: undefined });
    expect(errorOf(await ask(request(4, 'resources/list'))).code).toBe(METHOD_NOT_FOUND);
  });
});

describe('methods and messages', () => {
  test('an unknown method is -32601 under the id', async () => {
    const { ask } = appOf();
    expect(single(await ask(request(5, 'prompts/list')))).toEqual({
      jsonrpc: '2.0',
      id: 5,
      error: { code: METHOD_NOT_FOUND, message: 'Method not found: prompts/list' }
    });
  });

  test.each([
    ['a method that is no string', { jsonrpc: '2.0', id: 5, method: 5 }],
    ['no method', { jsonrpc: '2.0', id: 5 }]
  ])('%s, with a usable id: -32600 under that id', async (_label, message) => {
    const { ask } = appOf();
    const answer = single(await ask(message));
    expect(answer.id).toBe(5);
    expect(errorOf(answer).code).toBe(INVALID_REQUEST);
  });

  test('a notification gets no answer', async () => {
    const { ask } = appOf();
    expect(await ask(notification('notifications/initialized'))).toBeNull();
    expect(await ask(notification('no/such/method'))).toBeNull();
  });

  test('a tools/call without id does not run', async () => {
    const { ask, calls } = appOf();
    expect(await ask(notification('tools/call', { name: 'show_note' }))).toBeNull();
    expect(calls).toEqual([]);
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
    expect(single(await ask(request(id, 'ping')))).toEqual({ jsonrpc: '2.0', id, result: {} });
  });

  test.each(UNUSABLE_IDS)('%s: -32600 without id', async (_label, id) => {
    const { ask } = appOf();
    const answer = single(await ask(request(id, 'ping')));
    expect(answer).toEqual({
      jsonrpc: '2.0',
      error: {
        code: INVALID_REQUEST,
        message: 'The id must be a string or an integer within ±(2^53 − 1).'
      }
    });
    expect('id' in answer).toBe(false);
  });

  test('a tools/call under an unusable id does not run', async () => {
    const { ask, calls } = appOf();
    await ask(request(null, 'tools/call', { name: 'show_note', arguments: { id: 'n1' } }));
    expect(calls).toEqual([]);
  });

  test.each([
    ['text', 'kaputt'],
    ['a number', 5],
    ['null', null],
    ['no method and no id', { jsonrpc: '2.0' }],
    ['no method and id null', { jsonrpc: '2.0', id: null }]
  ])('not a request (%s): -32600 without id', async (_label, message) => {
    const { ask } = appOf();
    const answer = single(await ask(message));
    expect(errorOf(answer).code).toBe(INVALID_REQUEST);
    expect('id' in answer).toBe(false);
  });
});

describe('batch', () => {
  test('answers every request in order, leaves out notifications', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf();
    const answers = (await ask([
      request(1, 'ping'),
      notification('notifications/initialized'),
      request('b', 'tools/list'),
      request(null, 'ping'),
      7,
      request(9, 'tools/call', { name: 'fail' }),
      request(10, 'prompts/list')
    ])) as JsonRpcResponse[];
    expect(answers.map((answer) => ('id' in answer ? answer.id : '—'))).toEqual([
      1,
      'b',
      '—',
      '—',
      9,
      10
    ]);
    expect(answers.map((answer) => ('error' in answer ? answer.error.code : 'result'))).toEqual([
      'result',
      'result',
      INVALID_REQUEST,
      INVALID_REQUEST,
      INTERNAL_ERROR,
      METHOD_NOT_FOUND
    ]);
  });

  test('a log that throws costs no answer of the batch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('printing failed');
    });
    const { ask } = appOf();
    const answers = (await ask([
      request(1, 'tools/call', { name: 'fail' }),
      request(2, 'ping')
    ])) as JsonRpcResponse[];
    expect(answers.map((answer) => ('error' in answer ? answer.error.code : 'result'))).toEqual([
      INTERNAL_ERROR,
      'result'
    ]);
  });

  test('only notifications: no answer', async () => {
    const { ask } = appOf();
    expect(await ask([notification('notifications/initialized')])).toBeNull();
  });

  test('empty: -32600 without id, as one answer', async () => {
    const { ask } = appOf();
    const answer = single(await ask([]));
    expect(errorOf(answer)).toEqual({ code: INVALID_REQUEST, message: 'The batch is empty.' });
    expect('id' in answer).toBe(false);
  });

  test('a batch inside a batch is not a request: -32600 without id', async () => {
    const { ask } = appOf();
    const answers = (await ask([[request(1, 'ping')]])) as JsonRpcResponse[];
    expect(answers).toHaveLength(1);
    const [inner] = answers;
    expect(inner && 'error' in inner && inner.error.code).toBe(INVALID_REQUEST);
    expect(inner && 'id' in inner).toBe(false);
  });

  test(`MAX_BATCH (${MAX_BATCH}) messages pass, one more is -32600 without id`, async () => {
    const { ask } = appOf();
    const pings = (n: number) => Array.from({ length: n }, (_, i) => request(i + 1, 'ping'));
    expect(await ask(pings(MAX_BATCH))).toHaveLength(MAX_BATCH);
    const over = single(await ask(pings(MAX_BATCH + 1)));
    expect(errorOf(over).code).toBe(INVALID_REQUEST);
    expect('id' in over).toBe(false);
  });

  test('one call after another, never two at once', async () => {
    let running = 0;
    let most = 0;
    const { ask } = appOf({
      async call() {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 2));
        running -= 1;
        return { result: { content: text('done') } };
      }
    });
    const answers = await ask([1, 2, 3].map((id) => request(id, 'tools/call', { name: 'slow' })));
    expect(answers).toHaveLength(3);
    expect(most).toBe(1);
  });
});

describe('bodies the dispatcher never sees', () => {
  test('parseErrorResponse: -32700 without id', () => {
    const answer = parseErrorResponse();
    expect(answer).toEqual({
      jsonrpc: '2.0',
      error: { code: PARSE_ERROR, message: 'The body is not JSON.' }
    });
    expect('id' in answer).toBe(false);
  });

  test('bodyTooLargeResponse: the limit and a way out, not "not JSON"', () => {
    const answer = bodyTooLargeResponse('Content-length of 600992 exceeds limit of 524288 bytes.');
    expect('id' in answer).toBe(false);
    expect(answer.error.code).toBe(INVALID_REQUEST);
    expect(answer.error.message).toContain(
      '(Content-length of 600992 exceeds limit of 524288 bytes)'
    );
    expect(answer.error.message).toContain('Send it shorter');
    expect(answer.error.message).not.toContain('JSON');
    expect(bodyTooLargeResponse().error.message).toMatch(
      /^The request is too large for this server and was not read\. /
    );
  });
});

/**
 * Every answer of the dispatcher as a host checks it. An answer with a
 * `result` is checked against the result schema of its request's method.
 */
describe('every answer passes the SDK’s schemas (wireProblem)', () => {
  const CORPUS: [label: string, payload: unknown][] = [
    ['initialize', request(1, 'initialize', { protocolVersion: '2025-06-18' })],
    ['initialize without params', request(1, 'initialize')],
    ['ping', request('p', 'ping')],
    ['ping under 0', request(0, 'ping')],
    ['ping under −7', request(-7, 'ping')],
    ['tools/list', request(2, 'tools/list')],
    [
      'tools/call with a result',
      request(3, 'tools/call', { name: 'show_note', arguments: { id: 'n1' } })
    ],
    ['tools/call with isError', request(3, 'tools/call', { name: 'domain' })],
    ['tools/call with a protocol error', request(3, 'tools/call', { name: 'show_note' })],
    ['tools/call that throws', request(3, 'tools/call', { name: 'fail' })],
    ['tools/call without name', request(3, 'tools/call', {})],
    ['tools/call of an unknown tool', request(3, 'tools/call', { name: 'nope' })],
    ['resources/list', request(4, 'resources/list')],
    ['resources/templates/list', request(4, 'resources/templates/list')],
    ['resources/read', request(4, 'resources/read', { uri: views.uri('note') })],
    ['resources/read of an unknown URI', request(4, 'resources/read', { uri: 'ui://x/y' })],
    ['an unknown method', request(5, 'prompts/list')],
    ['no method, with id', { jsonrpc: '2.0', id: 6 }],
    ['no method, without id', { jsonrpc: '2.0' }],
    ['not an object', 'kaputt'],
    ...UNUSABLE_IDS.map(([label, id]): [string, unknown] => [`id ${label}`, request(id, 'ping')]),
    ['an empty batch', []],
    ['a batch over MAX_BATCH', Array.from({ length: MAX_BATCH + 1 }, (_, i) => request(i, 'ping'))],
    [
      'a mixed batch',
      [request(1, 'ping'), request(null, 'ping'), 7, request(2, 'tools/list'), request(3, 'nope')]
    ]
  ];

  /** The method each answerable request asked for, by its id. */
  function methodsOf(payload: unknown): Map<unknown, string> {
    const methods = new Map<unknown, string>();
    for (const entry of Array.isArray(payload) ? payload : [payload]) {
      const { id, method } = (entry ?? {}) as { id?: unknown; method?: unknown };
      if (typeof method === 'string') methods.set(id, method);
    }
    return methods;
  }

  test.each(CORPUS)('%s', async (_label, payload) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ask } = appOf();
    const answer = await ask(payload);
    if (answer === null) throw new Error('No answer to check.');
    const methods = methodsOf(payload);
    for (const one of Array.isArray(answer) ? answer : [answer]) {
      const answers = 'result' in one ? methods.get(one.id) : undefined;
      expect(wireProblem(one, answers), JSON.stringify(one)).toBeNull();
    }
  });

  test('parseErrorResponse and bodyTooLargeResponse', () => {
    expect(wireProblem(parseErrorResponse())).toBeNull();
    expect(
      wireProblem(bodyTooLargeResponse('Content-length of 9 exceeds limit of 8 bytes.'))
    ).toBeNull();
  });

  /** The oracle sees what the id rules prevent — or the tests above would pass for nothing. */
  test('positive control: the schemas reject a null id and the ids the dispatcher refuses', () => {
    const error = { code: INVALID_REQUEST, message: 'x' };
    expect(wireProblem({ jsonrpc: '2.0', id: null, error })).not.toBeNull();
    for (const [, id] of UNUSABLE_IDS) {
      expect(
        wireProblem({ jsonrpc: '2.0', id, result: {} }, 'ping'),
        JSON.stringify(id)
      ).not.toBeNull();
    }
    // The sentence `JsonRpcSuccess` cites: beyond ±(2^53 − 1) the SDK says "Too big".
    expect(
      wireProblem({ jsonrpc: '2.0', id: Number.MAX_SAFE_INTEGER + 1, result: {} }, 'ping')?.message
    ).toContain('Too big');
  });

  test('the sentence `Tool` cites: one tool without inputSchema fails the whole tools/list', () => {
    const ok = { name: 'ok', inputSchema: { type: 'object' } };
    const list = (tools: unknown[]) => ({ jsonrpc: '2.0', id: 1, result: { tools } });
    expect(wireProblem(list([ok]), 'tools/list')).toBeNull();
    expect(wireProblem(list([ok, { name: 'no_schema' }]), 'tools/list')?.message).toContain(
      'inputSchema'
    );
  });
});
