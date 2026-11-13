/**
 * JSON-RPC 2.0 as the view, the server and the wire check share it: the id
 * and the error codes (https://www.jsonrpc.org/specification#error_object).
 * Values and types only, no Node API — the view's bundle imports this module.
 */

/** A JSON-RPC id: text or a number. MCP forbids `null`. */
export type JsonRpcId = string | number;

/** The body is not JSON. */
export const PARSE_ERROR = -32700;
/**
 * Not a request the server takes: no object, no string `method`, an unusable
 * `id`, an empty or oversized batch, a body too large to read.
 */
export const INVALID_REQUEST = -32600;
/** No such method. */
export const METHOD_NOT_FOUND = -32601;
/** MCP's code for an unknown tool and for arguments the tool's schema rejects, too. */
export const INVALID_PARAMS = -32602;
/** The server failed on a request it took. */
export const INTERNAL_ERROR = -32603;
