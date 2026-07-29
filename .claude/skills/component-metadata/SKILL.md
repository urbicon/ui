---
name: component-metadata
description: JSDoc contract for *Props interfaces in index.ts — the single source of truth feeding the MCP server, llm.txt and the docs site. Use when adding or changing a component's props/index.ts, or when catalog/docs output looks stale or wrong.
---

# Component metadata via JSDoc

Every `*Props` interface in `index.ts` MUST have JSDoc tags — this is the single source of truth for the MCP server, `llm.txt`, and the documentation site:

- `@summary` (required) — **one** sentence, ≤ 120 characters, no backticks/braces/version numbers. What a human reads under the component's name on the landing page and in the index. Gated by `bun run summary:lint`.
- `@description` (required) — the long form: the contract an agent reads out of `llm.txt` and the MCP catalog. May name edge cases, subsets and failure modes; length is not capped here.
- `@tag` (one or more) — category tags: `form`, `action`, `overlay`, `feedback`, `layout`, `navigation`, `display`, `data`, `ai` (the chat/agent family: conversation surfaces, streaming markdown, agent parts)
- `@related` (zero or more) — related component names
- `@stability` (optional, default `stable`) — `experimental | beta | stable | deprecated`; drives the Editorial stability badge in the doc-page header
- `@standalone` (optional, multi-component `index.ts` only) — opt-in: this export gets its own MCP-catalog entry + `llm.txt` (e.g. the seven Guide surfaces). Without it, additional exports count as compound subcomponents (TabItem, MenuItem) and stay folded into the directory component's entry. Requires a matching `export { default as X } from './X.svelte'` in the same file.

The two description tags are **not** interchangeable. They were one field until 2026-07-27; the median ran 259 characters over more than one sentence, so the landing page truncated it mid-clause while agents got no more detail for it.

```ts
/**
 * @summary Type to filter, then pick — a searchable list for when the options are many.
 * @description Searchable menu (autocomplete) combining a text input with a filterable
 * option list. Implements the ARIA combobox pattern with keyboard navigation…
 * @tag form
 * @related Input
 * @related Select
 * @stability stable
 */
export interface ComboboxProps { ... }
```

## `@summary` on a prop — optional, and for one reader

The same split, one level down. A prop's own JSDoc is the contract; an optional `@summary` on it is the line a person reads **beside the knob** in a playground:

```ts
  /**
   * BCP 47 locale used for formatting (`Intl.NumberFormat`). Controls the
   * grouping separator … resolved once on the server so hydration cannot
   * disagree; `currency` is never auto-detected from it.
   * @default 'de-DE'
   * @summary Which conventions the number follows — separators, symbol placement, spacing.
   */
  locale?: string;
```

- **Optional by design.** Most props say all they need in one sentence and get no summary; `extractPlaygroundDocs` reads `summary ?? description`, so leaving it out changes nothing. A required second field would mean hundreds of copies of the first.
- **Required past 120 characters when the prop is a playground knob** — gated by `bun run playgrounds:lint`, which reports the component, the knob and the character count. The budget is measured: the hint column is 336 px at `text-xs`, which fits 57 characters on a line in the best case and ~38 with real word breaking, so 120 is three lines. Past that a hint is a wall beside a switch.
- **Only *direct* props carry a hint.** A tv() axis gets the "V" badge and no hint line at all, so its generated description ("Determines the component's visual treatment. Available options: …") never reaches a reader and needs no summary. The first version of the gate missed this and reported 56 knobs that show nothing to anyone.
- The API table on the docs page keeps showing the **description** — that is where the contract belongs. Measured on Dialog: 53 characters beside the knob, 375 in the table, same prop.

## Regeneration is two-step — run `docs:gen:all`, not `docs:gen:<target>`

`docs:gen:<target>` only writes `apps/docs/static/<group>/_catalog.json` + per-component `llm.txt`; the `MCPCatalogAssembler` (runs only in `docs:gen:all` / `build`) globs every `_catalog.json` into `apps/docs/static/mcp/component-catalog.json` — the file the MCP server actually loads for `find_components`/`suggest_implementation`. Editing `*Props` JSDoc and running only `docs:gen:<target>` leaves that file **stale**. All three artifacts are git-ignored (CI rebuilds them on `build`).

## Name the real server factory

For a component with a server counterpart (auth handler, SSE/stream endpoint), the `@description` MUST reference the shipped factory (e.g. `createInvitationHandlers`, `createStreamHandler`), cross-checked against the package's `server/index.ts` exports — never "create the CRUD/SSE endpoint yourself", which steers consumers into reimplementing a handler that already ships.

## Related

New components also need a bundle-size baseline entry — see `bun run size --update-baseline`.

`@stability` reaches the MCP catalog (and with it the landing page's status column) since 2026-07-27 — before that it was extracted and dropped, and the landing page carried a hand-written list naming four of the thirty-eight non-stable components. Set it truthfully.
