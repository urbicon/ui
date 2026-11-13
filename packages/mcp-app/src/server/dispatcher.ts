/**
 * The JSON-RPC envelope of a stateless MCP tool server: the body as one
 * message or a batch, the ids, notifications, the error forms, the protocol
 * version, `initialize` and `ping` — around the three things only the app
 * knows: its tools for a caller, the call, and (optionally) its views.
 *
 * Stateless: no session, no stream, every request stands alone. What reaches
 * `dispatch` is the parsed body; reading it, the HTTP status and the caller's
 * credentials stay with the app's route.
 *
 * Web standards only — no Node API, no dependency; the `node:crypto` of the
 * same entry point is the catalog's.
 */
import type { Outcome, ViewCatalog } from './catalog.ts';
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR
} from './jsonrpc.ts';

/**
 * An id an answer may stand under: text, or an integer within ±(2^53 − 1).
 * MCP forbids `null`. Beyond the safe range the SDK's `RequestIdSchema`
 * rejects the number ("Too big"), and `JSON.parse` may already have rounded
 * it — 9007199254740993 arrives as …992.
 */
export type RequestId = string | number;

/** An answer with a `result`. */
export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: RequestId;
  result: Record<string, unknown>;
}

/**
 * An answer with an `error` — **without `id`** where the request carried no
 * usable one (broken JSON, a body too large, an empty or oversized batch, no
 * id or an unusable id).
 * JSON-RPC 2.0 writes `null` there; MCP forbids `null` as an id, the SDK's
 * schemas a host validates with accept the omission and not `null`, and from
 * 2025-11-25 on the spec types the field as optional (`JSONRPCErrorResponse`).
 */
export interface JsonRpcFailure {
  jsonrpc: '2.0';
  id?: RequestId;
  error: { code: number; message: string };
}

/** One answer of the dispatcher, with `result` or `error`. */
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

/**
 * The protocol versions `initialize` agrees to by default — `initialize`,
 * `ping`, `tools/*` and `resources/*` exist in all three. The first is the
 * preferred one, and the answer to a client that asks for none or another.
 */
export const PROTOCOL_VERSIONS: readonly string[] = ['2025-06-18', '2025-03-26', '2024-11-05'];

/**
 * How many messages one batch may carry. Without a cap only the body size
 * limits a batch, and every `tools/call` in it may hold a database
 * transaction of its own.
 */
export const MAX_BATCH = 50;

/** `serverInfo` of `initialize` (MCP's `Implementation`). */
export interface ServerInfo {
  name: string;
  version: string;
  title?: string;
}

/** What only the app knows; `C` is the context of a call. */
export interface DispatcherOptions<C> {
  serverInfo: ServerInfo;
  /** `instructions` of `initialize` — what the model should know before it touches a tool. */
  instructions?: string;
  /**
   * `tools/list`: the tool descriptions this caller may see, as the wire
   * carries them (`name`, `description`, `inputSchema`, `_meta`, …).
   */
  tools(
    context: C
  ): readonly Record<string, unknown>[] | Promise<readonly Record<string, unknown>[]>;
  /**
   * `tools/call` with a string `name`. `args` is `params.arguments` as it
   * came — `undefined` included; the tool's schema decides.
   *
   * The answer is an {@link Outcome}: `{ result }` is the tool's result
   * (`content`, `structuredContent`, `isError`), `{ error: { code, message } }`
   * a protocol error such as `-32602` for an unknown tool or arguments the
   * schema rejects. Whatever `call` throws becomes `-32603` with a general
   * sentence; the thrown error goes to `console.error`, not to the client.
   */
  call(name: string, args: unknown, context: C): Outcome | Promise<Outcome>;
  /**
   * The view catalog (`createViewCatalog`): its `capabilities` join
   * `initialize`, and `resources/*` go to its `handle()`. Without it those
   * methods are `-32601`. A catalog whose origin depends on the request goes
   * to a dispatcher created per request — it holds nothing but its options.
   */
  views?: Pick<ViewCatalog<string>, 'handle' | 'capabilities'>;
  /** The versions `initialize` agrees to, preferred first. Default {@link PROTOCOL_VERSIONS}. */
  protocolVersions?: readonly string[];
}

/** What `createDispatcher` returns. */
export interface Dispatcher<C> {
  /**
   * A parsed body: one message or a batch. `null` when there is nothing to
   * answer — only notifications; Streamable HTTP answers that with `202` and
   * no body. A batch is answered as an array, in the order of its requests.
   */
  dispatch(payload: unknown, context: C): Promise<JsonRpcResponse | JsonRpcResponse[] | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The id of a request when an answer may stand under it — otherwise `undefined`. */
function requestId(value: unknown): RequestId | undefined {
  return typeof value === 'string' || Number.isSafeInteger(value)
    ? (value as RequestId)
    : undefined;
}

function failure(id: RequestId | undefined, code: number, message: string): JsonRpcFailure {
  return { jsonrpc: '2.0', ...(id === undefined ? {} : { id }), error: { code, message } };
}

function answer(id: RequestId, outcome: Outcome): JsonRpcResponse {
  if ('error' in outcome) return failure(id, outcome.error.code, outcome.error.message);
  if (!isRecord(outcome.result)) {
    throw new Error('The answer is neither { result: {…} } nor { error: { code, message } }.');
  }
  return { jsonrpc: '2.0', id, result: outcome.result };
}

/** The answer to a body that is not JSON: `-32700`, without id — nobody can read one. */
export function parseErrorResponse(): JsonRpcFailure {
  return failure(undefined, PARSE_ERROR, 'The body is not JSON.');
}

const FINAL_PERIOD = /\.$/;

/**
 * The answer to a body the server does not read because it is too large:
 * `-32600`, without id. Long texts in a tool's arguments reach it; the model
 * needs the limit and a way out, not "not JSON".
 *
 * @param detail The server's sentence about the limit, e.g. "Content-length of 600992 exceeds limit of 524288 bytes."
 */
export function bodyTooLargeResponse(detail?: string): JsonRpcFailure {
  const limit = detail ? ` (${detail.replace(FINAL_PERIOD, '')})` : '';
  return failure(
    undefined,
    INVALID_REQUEST,
    `The request is too large for this server and was not read${limit}. ` +
      'Send it shorter: fewer and shorter texts in the arguments, or spread them over several calls.'
  );
}

/**
 * The dispatcher of a stateless MCP tool server, generic over the context of
 * a call — the caller, a registry, a clock: whatever the route resolves.
 *
 * Answered here: `initialize` (the version, `tools` and the views'
 * capabilities, `serverInfo`, `instructions`), `ping`, `tools/list`,
 * `tools/call`, and `resources/*` through `views`. Every other method is
 * `-32601`. A message without `id` is a notification and gets no answer — a
 * `tools/call` without `id` does not run.
 *
 * @throws When `protocolVersions` is empty.
 */
export function createDispatcher<C>(options: DispatcherOptions<C>): Dispatcher<C> {
  const { serverInfo, instructions, tools, call, views } = options;
  const versions = options.protocolVersions ?? PROTOCOL_VERSIONS;
  const first = versions[0];
  if (first === undefined) throw new Error('protocolVersions must name at least one version.');
  const preferred: string = first;

  function negotiate(params: unknown): string {
    const requested = isRecord(params) ? params.protocolVersion : undefined;
    return typeof requested === 'string' && versions.includes(requested) ? requested : preferred;
  }

  async function outcomeOf(method: string, params: unknown, context: C): Promise<Outcome> {
    switch (method) {
      case 'initialize':
        return {
          result: {
            protocolVersion: negotiate(params),
            capabilities: { tools: {}, ...views?.capabilities },
            serverInfo,
            ...(instructions === undefined ? {} : { instructions })
          }
        };
      case 'ping':
        return { result: {} };
      case 'tools/list':
        return { result: { tools: await tools(context) } };
      case 'tools/call': {
        const name = isRecord(params) ? params.name : undefined;
        if (typeof name !== 'string') {
          return { error: { code: INVALID_PARAMS, message: 'tools/call needs params.name.' } };
        }
        return call(name, (params as Record<string, unknown>).arguments, context);
      }
      default:
        return (
          views?.handle(method, params) ?? {
            error: { code: METHOD_NOT_FOUND, message: `Method not found: ${method}` }
          }
        );
    }
  }

  async function message(entry: unknown, context: C): Promise<JsonRpcResponse | null> {
    if (!isRecord(entry) || typeof entry.method !== 'string') {
      return failure(
        isRecord(entry) ? requestId(entry.id) : undefined,
        INVALID_REQUEST,
        'Not a JSON-RPC request: an object with a string method.'
      );
    }
    if (entry.id === undefined) return null;
    const id = requestId(entry.id);
    if (id === undefined) {
      return failure(
        undefined,
        INVALID_REQUEST,
        'The id must be a string or an integer within ±(2^53 − 1).'
      );
    }
    const { method, params } = entry;
    const what =
      method === 'tools/call' && isRecord(params) && typeof params.name === 'string'
        ? `tools/call ${params.name}`
        : method;
    try {
      return answer(id, await outcomeOf(method, params, context));
    } catch (error) {
      // MCP clients run headless: what is not in the server's log is nowhere.
      console.error(`[mcp-app] ${what} failed:`, error);
      return failure(id, INTERNAL_ERROR, `${what} failed on the server.`);
    }
  }

  return {
    async dispatch(payload, context) {
      if (!Array.isArray(payload)) return message(payload, context);
      // Answered under every version: 2025-03-26 has batches, later versions
      // dropped them, and a stateless server never learns which one the
      // client agreed to.
      if (payload.length === 0) return failure(undefined, INVALID_REQUEST, 'The batch is empty.');
      if (payload.length > MAX_BATCH) {
        return failure(
          undefined,
          INVALID_REQUEST,
          `A batch carries at most ${MAX_BATCH} messages, not ${payload.length}.`
        );
      }
      // One after another, so a batch holds at most one of the app's
      // resources (a transaction, a pooled connection) at a time.
      const answers: JsonRpcResponse[] = [];
      for (const entry of payload) {
        const reply = await message(entry, context);
        if (reply !== null) answers.push(reply);
      }
      return answers.length > 0 ? answers : null;
    }
  };
}
