/** The JSON-RPC 2.0 error codes (https://www.jsonrpc.org/specification#error_object). */

/** The body is not JSON. */
export const PARSE_ERROR = -32700;
/** Not a request: no object, no string `method`, an unusable `id`, an empty batch. */
export const INVALID_REQUEST = -32600;
/** No such method on this server. */
export const METHOD_NOT_FOUND = -32601;
/** MCP's code for an unknown tool and for arguments the tool's schema rejects, too. */
export const INVALID_PARAMS = -32602;
/** The server failed; the sentence on the wire names no cause. */
export const INTERNAL_ERROR = -32603;
