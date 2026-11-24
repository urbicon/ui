/**
 * MCP 2026-07-28 as the server and the test host share it: the revision, the
 * per-request `_meta` envelope, the error codes beyond JSON-RPC and the
 * standard request headers. One table for both sides, so the host builds
 * exactly what the server checks.
 *
 * Values and functions only, no Node API.
 */

/** The one MCP revision this package speaks: stateless, no `initialize`. */
export const MCP_PROTOCOL_VERSION = '2026-07-28';

/** The reserved `_meta` keys of a request and of a result. */
export const PROTOCOL_VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';
export const CLIENT_CAPABILITIES_KEY = 'io.modelcontextprotocol/clientCapabilities';
export const CLIENT_INFO_KEY = 'io.modelcontextprotocol/clientInfo';
export const SERVER_INFO_KEY = 'io.modelcontextprotocol/serverInfo';

/** The extension identifier of MCP Apps, a key of `capabilities.extensions`. */
export const UI_EXTENSION = 'io.modelcontextprotocol/ui';

/** The `mimeType` the MCP Apps spec requires of a view ("MUST"). */
export const RESOURCE_MIME_TYPE = 'text/html;profile=mcp-app';

/** A header disagrees with the body, or a required one is missing (HTTP 400). */
export const HEADER_MISMATCH = -32020;
/** The request names no revision the server speaks (HTTP 400); `data` lists them. */
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

/** Which `params` field the `Mcp-Name` header mirrors, by method. */
export const MCP_NAME_SOURCE: Readonly<Record<string, string>> = {
  'tools/call': 'name',
  'resources/read': 'uri',
  'prompts/get': 'name'
};

/** The sentinel's frame; what stands inside must be base64, or the value says nothing. */
const SENTINEL = /^=\?base64\?(.*)\?=$/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Printable ASCII without leading or trailing space: what a header carries as it is. */
const PLAIN_HEADER = /^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/;

/**
 * A header value for `value`: itself when it is printable ASCII, otherwise
 * the spec's sentinel `=?base64?…?=` over its UTF-8 bytes.
 */
export function encodeHeaderValue(value: string): string {
  if (PLAIN_HEADER.test(value)) return value;
  let binary = '';
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return `=?base64?${btoa(binary)}?=`;
}

/**
 * What a header value says: trimmed, the sentinel decoded. `undefined` for a
 * sentinel that is no base64 or no UTF-8 — a value nobody can compare.
 */
export function decodeHeaderValue(value: string): string | undefined {
  const trimmed = value.trim();
  const sentinel = SENTINEL.exec(trimmed);
  if (!sentinel) return trimmed;
  const encoded = sentinel[1] ?? '';
  if (!BASE64.test(encoded)) return undefined;
  try {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * The `MCP-Protocol-Version`, `Mcp-Method` and — where the method has one —
 * `Mcp-Name` headers of a request, derived from its body.
 */
export function requestHeaders(method: string, params: unknown): Record<string, string> {
  const headers: Record<string, string> = {
    'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    'mcp-method': method
  };
  const field = MCP_NAME_SOURCE[method];
  const name =
    field !== undefined && typeof params === 'object' && params !== null
      ? (params as Record<string, unknown>)[field]
      : undefined;
  if (typeof name === 'string') headers['mcp-name'] = encodeHeaderValue(name);
  return headers;
}

/** What {@link clientRequest} sends besides the method and its params. */
export interface ClientRequestOptions {
  /** The JSON-RPC id; default `1`. */
  id?: string | number;
  /** Added to the derived headers, and winning over them — a bearer token, for instance. */
  headers?: Record<string, string>;
  /** `_meta["io.modelcontextprotocol/clientCapabilities"]`; default: MCP Apps declared. */
  capabilities?: Record<string, unknown>;
  /** `_meta["io.modelcontextprotocol/clientInfo"]`; default `mcp-app-client` 1.0.0. */
  clientInfo?: { name: string; version: string };
}

/**
 * A request as an MCP 2026-07-28 client sends it: one `POST` with the
 * envelope in `params._meta` (a `_meta` of `params` keeps its own keys) and
 * the standard headers derived from the body. For a test or a script that
 * talks to a dispatcher, in process (`dispatcher.handle(clientRequest(…))`)
 * or with `fetch`.
 */
export function clientRequest(
  url: string | URL,
  method: string,
  params?: Record<string, unknown>,
  options: ClientRequestOptions = {}
): Request {
  const meta = params?._meta as Record<string, unknown> | undefined;
  const body = {
    ...params,
    _meta: {
      ...meta,
      [PROTOCOL_VERSION_KEY]: MCP_PROTOCOL_VERSION,
      [CLIENT_CAPABILITIES_KEY]: options.capabilities ?? {
        extensions: { [UI_EXTENSION]: { mimeTypes: [RESOURCE_MIME_TYPE] } }
      },
      [CLIENT_INFO_KEY]: options.clientInfo ?? { name: 'mcp-app-client', version: '1.0.0' }
    }
  };
  return new Request(url, {
    method: 'POST',
    headers: {
      ...requestHeaders(method, body),
      // Both, as the MCP transport asks of a client.
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...options.headers
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: options.id ?? 1, method, params: body })
  });
}
