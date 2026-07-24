---
name: component-metadata
description: JSDoc contract for *Props interfaces in index.ts — the single source of truth feeding the MCP server, llm.txt and the docs site. Use when adding or changing a component's props/index.ts, or when catalog/docs output looks stale or wrong.
---

# Component metadata via JSDoc

Every `*Props` interface in `index.ts` MUST have JSDoc tags — this is the single source of truth for the MCP server, `llm.txt`, and the documentation site:

- `@description` (required) — short, informative description
- `@tag` (one or more) — category tags: `form`, `action`, `overlay`, `feedback`, `layout`, `navigation`, `display`, `data`, `ai` (the chat/agent family: conversation surfaces, streaming markdown, agent parts)
- `@related` (zero or more) — related component names
- `@stability` (optional, default `stable`) — `experimental | beta | stable | deprecated`; drives the Editorial stability badge in the doc-page header
- `@standalone` (optional, multi-component `index.ts` only) — opt-in: this export gets its own MCP-catalog entry + `llm.txt` (e.g. the seven Guide surfaces). Without it, additional exports count as compound subcomponents (TabItem, MenuItem) and stay folded into the directory component's entry. Requires a matching `export { default as X } from './X.svelte'` in the same file.

```ts
/**
 * @description Short, informative description of what this component does.
 * @tag form
 * @related Input
 * @related Select
 * @stability stable
 */
export interface ComboboxProps { ... }
```

## Regeneration is two-step — run `docs:gen:all`, not `docs:gen:<target>`

`docs:gen:<target>` only writes `apps/docs/static/<group>/_catalog.json` + per-component `llm.txt`; the `MCPCatalogAssembler` (runs only in `docs:gen:all` / `build`) globs every `_catalog.json` into `apps/docs/static/mcp/component-catalog.json` — the file the MCP server actually loads for `find_components`/`suggest_implementation`. Editing `*Props` JSDoc and running only `docs:gen:<target>` leaves that file **stale**. All three artifacts are git-ignored (CI rebuilds them on `build`).

## Name the real server factory

For a component with a server counterpart (auth handler, SSE/stream endpoint), the `@description` MUST reference the shipped factory (e.g. `createInvitationHandlers`, `createStreamHandler`), cross-checked against the package's `server/index.ts` exports — never "create the CRUD/SSE endpoint yourself", which steers consumers into reimplementing a handler that already ships.

## Related

New components also need a bundle-size baseline entry — see `bun run size:blocks --update-baseline`.
