/**
 * The endpoint of a stateless MCP tool server — MCP 2026-07-28, and only
 * that: one POST carries one JSON-RPC request or notification, the answer is
 * JSON. Around the three things only the app knows: its tools for a caller,
 * the call, and (optionally) its views.
 *
 * The revision makes the HTTP layer part of the protocol — the status a
 * rejection carries, the `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name`
 * headers checked against the body. So `handle` takes the `Request` and
 * returns the `Response`; the caller's credentials stay with the app's route,
 * which runs before it.
 *
 * Web standards only — no Node API, no dependency; the `node:crypto` of the
 * same entry point is the catalog's.
 */
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  type JsonRpcId,
  METHOD_NOT_FOUND,
  PARSE_ERROR
} from '../jsonrpc.ts';
import {
  CLIENT_CAPABILITIES_KEY,
  decodeHeaderValue,
  HEADER_MISMATCH,
  MCP_PROTOCOL_VERSION,
  mcpName,
  mcpNameField,
  PROTOCOL_VERSION_KEY,
  SERVER_INFO_KEY,
  UNSUPPORTED_PROTOCOL_VERSION
} from '../mcp.ts';
import type { Outcome, ViewCatalog } from './catalog.ts';

/**
 * An answer with a `result`, under the request's id — which the dispatcher
 * takes only as text or as an integer within ±(2^53 − 1). Beyond the safe
 * range the SDK's `RequestIdSchema` rejects the number ("Too big"), and
 * `JSON.parse` may already have rounded it — 9007199254740993 arrives as …992.
 */
export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: Record<string, unknown>;
}

/**
 * An answer with an `error` — **without `id`** where the request carried no
 * usable one (broken JSON, a body too large, no id or an unusable id).
 * JSON-RPC 2.0 writes `null` there; MCP forbids `null` as an id, and the spec
 * types the field as optional (`JSONRPCErrorResponse`).
 */
export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
}

/** One answer of the dispatcher, with `result` or `error`. */
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

/** `_meta["io.modelcontextprotocol/serverInfo"]` of every result (MCP's `Implementation`). */
export interface ServerInfo {
  name: string;
  version: string;
  title?: string;
}

/**
 * One entry of `tools/list` (MCP's `Tool`): `name` and `inputSchema` at least —
 * a host rejects the whole list over one tool without them.
 */
export interface Tool {
  name: string;
  /** `object`, not a record: an interface such as `JSONSchema7` has no index signature. */
  inputSchema: object;
  [key: string]: unknown;
}

/** The results a client may cache, and that therefore carry `ttlMs` and `cacheScope`. */
export type CacheableMethod =
  | 'server/discover'
  | 'tools/list'
  | 'resources/list'
  | 'resources/templates/list'
  | 'resources/read';

/**
 * How long a client may reuse a result, and whether across callers.
 * `'public'` lets a cache hand the result to another authorization context —
 * only for what every caller sees alike.
 */
export interface CacheHint {
  ttlMs: number;
  cacheScope: 'public' | 'private';
}

/**
 * The hint of a method the app names none for: stale at once, never shared —
 * what a client assumes of a result without the fields, so never wrong.
 */
export const NO_CACHE: CacheHint = { ttlMs: 0, cacheScope: 'private' };

const CACHEABLE: readonly string[] = [
  'server/discover',
  'tools/list',
  'resources/list',
  'resources/templates/list',
  'resources/read'
] satisfies readonly CacheableMethod[];

/**
 * What only the app knows; `C` is the context of a call. `tools` and `call`
 * are called as methods of this object, so `this` holds.
 */
export interface DispatcherOptions<C = void> {
  serverInfo: ServerInfo;
  /** `instructions` of `server/discover` — what the model should know before it touches a tool. */
  instructions?: string;
  /**
   * `tools/list`: the tool descriptions this caller may see, as the wire
   * carries them (`name`, `description`, `inputSchema`, `_meta`, …).
   */
  tools(context: C): readonly Tool[] | Promise<readonly Tool[]>;
  /**
   * `tools/call` with a string `name`. `args` is `params.arguments` as it
   * came — `undefined` included; the tool's schema decides.
   *
   * `call` receives every name a client sends; the dispatcher does not check
   * it against `tools(context)`. A tool hidden from this caller must be
   * refused here too (`INVALID_PARAMS`).
   *
   * The answer is an {@link Outcome}: `{ result }` is the tool's result
   * (`content`, `structuredContent`, `isError`), `{ error: { code, message } }`
   * a protocol error such as `-32602` for an unknown tool or `arguments` that
   * are present but no JSON object (`null`, an array, a string, a number).
   * Absent `arguments` are valid; the tool's schema decides, and arguments it
   * rejects are a result with `isError`: MCP 2026-07-28 counts input
   * validation errors among tool execution errors. Whatever `call` throws becomes `-32603` with a general
   * sentence; the thrown error goes to `console.error`, not to the client. So
   * does an `Outcome` of another shape — an `error` needs a safe integer `code`
   * and a string `message`.
   */
  call(name: string, args: unknown, context: C): Outcome | Promise<Outcome>;
  /**
   * The view catalog (`createViewCatalog`): its `capabilities` join
   * `server/discover`, and `resources/*` go to its `handle()`. Without it
   * those methods are `-32601`. A catalog whose origin depends on the request
   * goes to a dispatcher created per request — it holds nothing but its
   * options.
   */
  views?: Pick<ViewCatalog<string>, 'handle' | 'capabilities'>;
  /**
   * `ttlMs` and `cacheScope` per cacheable method; {@link NO_CACHE} for every
   * method left out. `tools/list` may differ by caller (`tools(context)`), so
   * it stays `'private'` unless every caller sees the same list.
   *
   * @throws At creation, for a `ttlMs` that is no integer ≥ 0.
   */
  cache?: Partial<Record<CacheableMethod, CacheHint>>;
}

/** What `createDispatcher` returns. */
export interface Dispatcher<C = void> {
  /**
   * The MCP endpoint: `POST` with one JSON-RPC message in, the answer out. A
   * notification is `202` without body; every rejection the revision gives a
   * status (`400`, `404`, `405`, `413`) carries it, every answer from a method
   * — errors of a tool or a resource included — is `200`.
   */
  handle(request: Request, context: C): Promise<Response>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The id of a request when an answer may stand under it — otherwise `undefined`. */
function requestId(value: unknown): JsonRpcId | undefined {
  return typeof value === 'string' || Number.isSafeInteger(value)
    ? (value as JsonRpcId)
    : undefined;
}

function failure(
  id: JsonRpcId | undefined,
  code: number,
  message: string,
  data?: unknown
): JsonRpcFailure {
  return {
    jsonrpc: '2.0',
    ...(id === undefined ? {} : { id }),
    error: { code, message, ...(data === undefined ? {} : { data }) }
  };
}

function reply(status: number, body: JsonRpcResponse, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

const FINAL_PERIOD = /\.$/;

/**
 * Whether reading the body failed because it is too large — SvelteKit's
 * adapter-node throws an error with `status` 413 when `BODY_SIZE_LIMIT` is
 * exceeded, and `Content-length of 600992 exceeds limit of 524288 bytes.` as
 * its message.
 */
function tooLarge(error: unknown): error is Error {
  return error instanceof Error && (error as { status?: unknown }).status === 413;
}

/**
 * The answer to a body too large to read: `-32600`, without id. Long texts in
 * a tool's arguments reach it; the model needs the limit and a way out, not
 * "not JSON".
 */
function bodyTooLarge(detail: string): JsonRpcFailure {
  const limit = detail ? ` (${detail.replace(FINAL_PERIOD, '')})` : '';
  return failure(
    undefined,
    INVALID_REQUEST,
    `The request is too large for this server and was not read${limit}. ` +
      'Send it shorter: fewer and shorter texts in the arguments, or spread them over several calls.'
  );
}

/** A header, trimmed — `undefined` when absent. */
function header(request: Request, name: string): string | undefined {
  const value = request.headers.get(name);
  return value === null ? undefined : value.trim();
}

/**
 * The dispatcher of a stateless MCP tool server, generic over the context of
 * a call — the caller, a registry, a clock: whatever the route resolves.
 *
 * Answered: `server/discover`, `tools/list`, `tools/call`, and `resources/*`
 * through `views`. Every other method is `404` with `-32601`, `ping` included,
 * which 2026-07-28 removed. The `initialize` of a 2025 client carries no
 * envelope, so it is told the revision this server speaks (`400`, `-32022`).
 *
 * @throws When `cache` names a method that is not cacheable, or a hint whose
 *   `ttlMs` is no integer ≥ 0 or whose `cacheScope` is neither `'public'` nor
 *   `'private'` — each would make every answer of the method invalid on the wire.
 */
export function createDispatcher<C = void>(options: DispatcherOptions<C>): Dispatcher<C> {
  const { serverInfo, instructions, views } = options;
  for (const [method, hint] of Object.entries(options.cache ?? {})) {
    if (!CACHEABLE.includes(method)) {
      throw new Error(`cache["${method}"]: not a cacheable method (${CACHEABLE.join(', ')}).`);
    }
    if (!Number.isSafeInteger(hint?.ttlMs) || (hint?.ttlMs ?? -1) < 0) {
      throw new Error(`cache["${method}"].ttlMs must be an integer ≥ 0, not ${hint?.ttlMs}.`);
    }
    if (hint.cacheScope !== 'public' && hint.cacheScope !== 'private') {
      throw new Error(
        `cache["${method}"].cacheScope must be 'public' or 'private', not ${JSON.stringify(hint.cacheScope)}.`
      );
    }
  }
  const supported = [MCP_PROTOCOL_VERSION];

  function unsupported(id: JsonRpcId | undefined, requested: unknown): Response {
    const named = typeof requested === 'string' ? requested : undefined;
    return reply(
      400,
      failure(
        id,
        UNSUPPORTED_PROTOCOL_VERSION,
        `This server speaks MCP ${supported.join(', ')} only, ${
          named === undefined ? 'and the request names no protocol version' : `not ${named}`
        }. The version goes into params._meta["${PROTOCOL_VERSION_KEY}"] of every request; there is no initialize.`,
        { supported, ...(named === undefined ? {} : { requested: named }) }
      )
    );
  }

  function mismatch(id: JsonRpcId, message: string): Response {
    return reply(400, failure(id, HEADER_MISMATCH, message));
  }

  /**
   * The revision's checks before a method runs: the version claim, the
   * envelope, the standard headers, in that order. The spec fixes no
   * precedence; a request that breaks two rules gets one of the two 400s.
   * `null` when all pass.
   */
  function rejection(
    request: Request,
    id: JsonRpcId,
    method: string,
    params: Record<string, unknown> | undefined
  ): Response | null {
    const meta = isRecord(params?._meta) ? params._meta : undefined;
    const claimed = meta?.[PROTOCOL_VERSION_KEY];
    const headerVersion = header(request, 'mcp-protocol-version');
    if (claimed === undefined) {
      // A client of 2026-07-28 that forgot the claim is told which key; any
      // other request — an `initialize` above all — which revision to speak.
      if (headerVersion !== undefined && supported.includes(headerVersion)) {
        return reply(
          400,
          failure(id, INVALID_PARAMS, `params._meta["${PROTOCOL_VERSION_KEY}"] is missing.`)
        );
      }
      return unsupported(id, method === 'initialize' ? params?.protocolVersion : headerVersion);
    }
    if (typeof claimed !== 'string') {
      return reply(
        400,
        failure(id, INVALID_PARAMS, `params._meta["${PROTOCOL_VERSION_KEY}"] must be a string.`)
      );
    }
    // A disagreement outranks the version itself: which of the two is meant is unknown.
    if (headerVersion !== undefined && headerVersion !== claimed) {
      return mismatch(
        id,
        `The MCP-Protocol-Version header (${headerVersion}) and params._meta (${claimed}) disagree.`
      );
    }
    if (!supported.includes(claimed)) return unsupported(id, claimed);
    if (!isRecord(meta?.[CLIENT_CAPABILITIES_KEY])) {
      return reply(
        400,
        failure(id, INVALID_PARAMS, `params._meta["${CLIENT_CAPABILITIES_KEY}"] must be an object.`)
      );
    }
    if (headerVersion === undefined)
      return mismatch(id, 'The MCP-Protocol-Version header is missing.');
    const headerMethod = header(request, 'mcp-method');
    if (headerMethod === undefined) return mismatch(id, 'The Mcp-Method header is missing.');
    if (headerMethod !== method) {
      return mismatch(
        id,
        `The Mcp-Method header (${headerMethod}) and the body (${method}) disagree.`
      );
    }
    const field = mcpNameField(method);
    if (field !== undefined) {
      // A field that is no text is no name a header mirrors: the method's own check answers it.
      const body = mcpName(method, params);
      const raw = header(request, 'mcp-name');
      if (raw === undefined) {
        if (body !== undefined) return mismatch(id, 'The Mcp-Name header is missing.');
      } else if (decodeHeaderValue(raw) !== body) {
        return mismatch(id, `The Mcp-Name header and params.${field} disagree.`);
      }
    }
    return null;
  }

  /** The method's answer — `null` for a method this server does not have. */
  async function outcomeOf(
    method: string,
    params: Record<string, unknown> | undefined,
    context: C
  ): Promise<Outcome | null> {
    switch (method) {
      case 'server/discover':
        return {
          result: {
            supportedVersions: supported,
            capabilities: { tools: {}, ...views?.capabilities },
            ...(instructions === undefined ? {} : { instructions })
          }
        };
      case 'tools/list':
        return { result: { tools: await options.tools(context) } };
      case 'tools/call': {
        const name = params?.name;
        if (typeof name !== 'string') {
          return { error: { code: INVALID_PARAMS, message: 'tools/call needs params.name.' } };
        }
        return options.call(name, params?.arguments, context);
      }
      default:
        return views?.handle(method, params) ?? null;
    }
  }

  /**
   * A `result` as the revision wants it: `resultType`, the server's identity
   * in `_meta`, the cache hint where the method is cacheable. What the result
   * sets itself wins, as it is set; `_meta` is merged key by key, and one
   * that is no object is replaced.
   */
  function complete(method: string, result: Record<string, unknown>): Record<string, unknown> {
    const meta = isRecord(result._meta) ? result._meta : {};
    const hint = CACHEABLE.includes(method)
      ? (options.cache?.[method as CacheableMethod] ?? NO_CACHE)
      : undefined;
    return {
      resultType: 'complete',
      ...hint,
      ...result,
      _meta: { [SERVER_INFO_KEY]: serverInfo, ...meta }
    };
  }

  /** Checked, not trusted: past a cast or from plain JS, `error` may be a database error. */
  function answer(id: JsonRpcId, method: string, outcome: Outcome): JsonRpcResponse {
    if ('error' in outcome) {
      const { code, message, data } = outcome.error;
      if (Number.isSafeInteger(code) && typeof message === 'string') {
        return failure(id, code, message, data);
      }
    } else if (isRecord(outcome.result)) {
      return { jsonrpc: '2.0', id, result: complete(method, outcome.result) };
    }
    throw new Error('The answer is neither { result: {…} } nor { error: { code, message } }.', {
      cause: outcome
    });
  }

  return {
    async handle(request, context) {
      if (request.method !== 'POST') {
        return reply(405, failure(undefined, -32000, 'Method not allowed: MCP takes POST only.'), {
          allow: 'POST'
        });
      }
      let text: string;
      try {
        text = await request.text();
      } catch (error) {
        if (tooLarge(error)) return reply(413, bodyTooLarge(error.message));
        throw error;
      }
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        return reply(400, failure(undefined, PARSE_ERROR, 'The body is not JSON.'));
      }
      if (Array.isArray(payload)) {
        return reply(
          400,
          failure(
            undefined,
            INVALID_REQUEST,
            'One JSON-RPC message per request — MCP has no batches.'
          )
        );
      }
      if (!isRecord(payload) || typeof payload.method !== 'string') {
        return reply(
          400,
          failure(
            isRecord(payload) ? requestId(payload.id) : undefined,
            INVALID_REQUEST,
            'Not a JSON-RPC request: an object with a string method.'
          )
        );
      }
      // A notification is taken and dropped: this server acts on none.
      if (!('id' in payload)) return new Response(null, { status: 202 });
      const id = requestId(payload.id);
      if (id === undefined) {
        return reply(
          400,
          failure(
            undefined,
            INVALID_REQUEST,
            'The id must be a string or an integer within ±(2^53 − 1).'
          )
        );
      }
      const { method } = payload;
      const params = isRecord(payload.params) ? payload.params : undefined;
      const rejected = rejection(request, id, method, params);
      if (rejected) return rejected;

      const what =
        method === 'tools/call' && typeof params?.name === 'string'
          ? `tools/call ${params.name}`
          : method;
      try {
        const outcome = await outcomeOf(method, params, context);
        if (outcome === null) {
          return reply(404, failure(id, METHOD_NOT_FOUND, `Method not found: ${method}`));
        }
        return reply(200, answer(id, method, outcome));
      } catch (error) {
        // MCP clients run headless: what is not in the server's log is nowhere. Printing runs the
        // value's own code (`inspect.custom`, a Proxy trap) and can throw; that must not cost the
        // answer.
        try {
          console.error(`[mcp-app] ${what} failed:`, error);
        } catch {
          // The answer below is all that is left to give.
        }
        return reply(200, failure(id, INTERNAL_ERROR, `${what} failed on the server.`));
      }
    }
  };
}
