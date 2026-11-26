# Migrating `@urbicon-ui/mcp-app`

Breaking changes to this package, newest first: what moved, what it costs you, and what to grep
for before you ship.

Entries are headed by the release that shipped the change — an 8.x minor until the launch is
announced, see
[VERSIONING.md § The pre-launch window](https://github.com/urbicon/ui/blob/main/docs/VERSIONING.md#the-pre-launch-window).

## 8.42.0

### The dispatcher speaks MCP 2026-07-28, and only that

MCP 2026-07-28 drops the `initialize` handshake: every request names the revision and the
client's capabilities in `params._meta`, and the HTTP layer is part of the protocol, with a
status per rejection and headers checked against the body. `createDispatcher` now owns that
layer, so it takes the `Request` instead of the parsed body:

```ts
// before
let payload: unknown;
try {
  payload = await request.json();
} catch {
  return Response.json(parseErrorResponse(), { status: 400 });
}
const answer = await dispatcher.dispatch(payload, caller);
return answer === null ? new Response(null, { status: 202 }) : Response.json(answer);

// after
return dispatcher.handle(request, caller);
```

The route keeps the caller's credentials, before `handle`. Reading the body, a body too large
to read (adapter-node's 413 past `BODY_SIZE_LIMIT`), the parse error and the `202` for a
notification move into `handle`.

Gone from `@urbicon-ui/mcp-app/server`:

- `parseErrorResponse` and `bodyTooLargeResponse`: `handle` answers both cases itself.
- `MCP_PROTOCOL_VERSIONS` and the `protocolVersions` option: the one revision is
  `MCP_PROTOCOL_VERSION`.
- `MAX_BATCH`: 2026-07-28 has no batches; a batch is `400`.
- `RESOURCE_NOT_FOUND` (`-32002`): a URI with no view is `INVALID_PARAMS` (`-32602`) with
  `data: { uri }`, as the revision has it.

A `views` object of your own, written to `ViewCatalog['capabilities']`, now needs
`extensions: { 'io.modelcontextprotocol/ui': {} }` beside `resources` to compile.

On the wire, `initialize` and `ping` are gone and `server/discover` is new; every result carries
`resultType`, the server's identity in `_meta["io.modelcontextprotocol/serverInfo"]`, and the
cacheable ones `ttlMs` and `cacheScope` (the new `cache` option, `NO_CACHE` by default). The
status of each case is in the
[dispatcher's reference](https://ui.urbicon.de/ai/mcp-apps/reference#server-the-dispatcher).

**Who it locks out:** a client that speaks only 2025-11-25 or older. Its `initialize` is answered
`400` with `-32022`, which names `2026-07-28` as the supported revision. That includes the MCP
SDK's 2.x clients in their default mode, `legacy`; in mode `auto` they ask `server/discover`
first and use 2026-07-28. It also includes the voice mode of claude.ai, which as of 26 November
2026 connects through a client of its own that sends `initialize` with 2025-11-25
([anthropics/claude-ai-mcp#1356](https://github.com/anthropics/claude-ai-mcp/issues/1356));
typed chats in claude.ai, Claude Desktop and Claude Code ask `server/discover`.

**Your `call`'s error line.** 2026-07-28 counts input validation errors among tool execution
errors: arguments a tool's schema rejects come back as a result with `isError: true` and a
sentence the model can correct the call from, not as `-32602`. `-32602` stays for an unknown
tool, one hidden from the caller, and `arguments` that are not an object. A `call` that
answered a schema rejection with `INVALID_PARAMS` should move it.

**The test host** speaks 2026-07-28 to your server as well: `mcpRequest` and `mcpResult` add the
envelope and the headers, `serverInfo(endpoint)` reads `server/discover`, and the
`version-unknown` check expects `-32602` with the URI in `data`. `mcpRequest` used to throw on
every status but 2xx; now it returns a JSON-RPC error whatever its status, and throws only on
an answer that is no JSON-RPC.

A unit test or a script that called `dispatch` with a message builds the request with
`clientRequest(url, method, params)` from `@urbicon-ui/mcp-app/testing` and reads the answer
from the `Response`: `await (await dispatcher.handle(clientRequest(…), context)).json()`.

Grep for `.dispatch(`, `parseErrorResponse`, `bodyTooLargeResponse`, `RESOURCE_NOT_FOUND`,
`-32002`, `MCP_PROTOCOL_VERSIONS` and `protocolVersions`, and for scripts and tests that post
JSON-RPC to your endpoint by hand: a `curl` or an end-to-end test without the envelope now gets
`400`.
