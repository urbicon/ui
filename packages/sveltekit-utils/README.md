# @urbicon-ui/sveltekit-utils

Small, focused SvelteKit helpers that Urbicon apps share. Zero runtime dependencies.

Currently shipping:

- **URL-state runes** — reactive `useUrlParam` / `useUrlArrayParam` that keep component state in sync with `?query=` parameters
- **Table-query URL sync** — opt-in `?q=…&sort=…&page=…` mirroring for `@urbicon-ui/table` server mode, plus the pure serializers behind it
- **Cron runner** — interval-based background fetcher for scheduled server endpoints
- **SSE stream reader** — `streamSse`, a spec-correct async-generator client for one-shot POST `text/event-stream` endpoints (LLM relays)

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

Peer dependencies: `svelte` (^5), `@sveltejs/kit`.

## URL State (`url.svelte`)

Bind a typed, reactive value to a URL search param. When the value changes, the URL is updated (and vice versa) without a full navigation.

```svelte
<script lang="ts">
  import { useUrlParam, useUrlArrayParam } from '@urbicon-ui/sveltekit-utils/url.svelte';

  // Single string param, typed
  const [page, setPage] = useUrlParam<number>('page', {
    parse: (sp) => Number(sp.get('page') ?? '1'),
    serialize: (v) => new URLSearchParams({ page: String(v) }),
    initial: 1
  });

  // Repeated-key array param: ?tag=a&tag=b
  const [tags, setTags] = useUrlArrayParam('tag', { initial: [], strategy: 'repeat' });

  // CSV array param: ?tag=a,b
  const [categories, setCategories] = useUrlArrayParam('cat', { initial: [], strategy: 'csv' });
</script>

<button onclick={() => setPage(page() + 1)}>Next — current: {page()}</button>
```

Low-level escape hatch if you prefer to update multiple params at once:

```typescript
import { updateUrlSearchParams } from '@urbicon-ui/sveltekit-utils/url.svelte';

updateUrlSearchParams({ page: '1', tag: ['a', 'b'] }, { replaceState: true });
```

**Design notes**

- URL updates use `goto()` with `replaceState: true`, `noScroll: true`, `keepFocus: true` — suited for filter/pagination UIs, not full page transitions.
- `useUrlParam` returns getters (not Svelte stores) so consumers can read the value lazily inside `$derived`/`$effect`.

## Table Query ↔ URL (`table-query` + `url.svelte`)

Opt-in URL sync for `@urbicon-ui/table` in `mode="server"`: the `TableQuery` the table emits (search, sort, page, page size, filters, grouping) is mirrored onto query parameters (`?q=…&sort=…&page=…`), so the view state survives reloads and can be shared as a link.

```svelte
<script lang="ts">
  import { Table } from '@urbicon-ui/table';
  import { tableQueryToSearchParams } from '@urbicon-ui/sveltekit-utils/table-query';
  import { createTableQueryUrlSync } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const sync = createTableQueryUrlSync({ defaults: { itemsPerPage: 25 } });
</script>

<Table
  mode="server"
  {columns}
  itemsPerPage={25}
  initialPage={sync.initialQuery.page}
  initialGroupBy={sync.initialQuery.groupByKey}
  initialSort={sync.initialQuery.sortColumn
    ? { column: sync.initialQuery.sortColumn, direction: sync.initialQuery.sortDirection }
    : undefined}
  initialFilters={sync.initialQuery.activeFilters}
  queryFn={async (query, { signal }) => {
    sync.syncQuery(query); // mirror the query onto the URL (replaceState)
    const res = await fetch(`/api/users?${tableQueryToSearchParams(query)}`, { signal });
    const data = await res.json();
    return { items: data.results, totalItems: data.total };
  }}
/>
```

With manual control (`onQueryChange` instead of `queryFn`), pass `sync.syncQuery` directly — note that `onQueryChange` does not fire when `queryFn` is set, which is why the managed variant calls it inside `queryFn`.

The pure serializers live under `@urbicon-ui/sveltekit-utils/table-query` and work without SvelteKit — e.g. to parse the initial query in a server `load` and fetch the first page during SSR:

```typescript
// +page.server.ts
import { searchParamsToTableQuery } from '@urbicon-ui/sveltekit-utils/table-query';

export const load = async ({ url }) => {
  const query = searchParamsToTableQuery(url.searchParams, { defaults: { itemsPerPage: 25 } });
  return { initialResult: await fetchUsers(query) };
};
```

**Design notes**

- **Default elision** — values equal to `defaults` are not written; a table in its default state leaves the URL clean. Set `defaults` to the table's initial props (`itemsPerPage`, `initialPage`, `initialGroupBy`, and `sortColumn`/`sortDirection` when the table ships a baked-in `initialSort`) so the elision baseline matches the state the table starts in.
- **Read tolerant, write strict** — unparsable params fall back to the defaults and malformed `filter` entries are skipped; serializing a structurally invalid query (non-positive page, unknown operator) throws instead of writing corrupt state.
- **Namespacing** — `prefix: 't_'` scopes all keys (`?t_q=…`) for multiple synced tables on one page; unrelated params are always preserved.
- **Types** — `TableQueryParams` is a structural mirror of the table's `TableQuery` (no dependency on `@urbicon-ui/table`; a parity test in the table package guards against drift).
- **Seeding** — every axis the URL carries can seed the table: `initialPage`, `initialGroupBy`, `initialSort`, `initialFilters` (plus controlled `searchTerm` with an `onSearchTermChange` write-back). The seeds land before the table's first query emission, so a shared URL's sort/filter params survive it — the header indicator and filter chips show the URL state instead of the first emission wiping it. One precedence caveat: the `initial*` props seed only what `persistenceConfig` left empty — when both are active, a persisted sort/filter/group wins over the URL. And since persistence stores only non-empty values, a state the user _cleared_ reads as empty on the next load and the seed applies again. Scope or disable persistence for URL-driven tables if the link should be the source of truth.

## Cron Runner (`cron`)

Fire HTTP requests against SvelteKit server endpoints on an interval. Pair with a shared-secret header so endpoints can authenticate scheduled calls.

```typescript
// src/lib/server/cron.ts
import { createCronRunner } from '@urbicon-ui/sveltekit-utils/cron';
import { env } from '$env/dynamic/private';

export const cron = createCronRunner({
  secret: env.CRON_SECRET,
  baseUrl: env.BASE_URL,
  jobs: [
    { path: '/api/cron/send-digest', intervalSeconds: 3600 },
    { path: '/api/cron/cleanup', intervalSeconds: 900, method: 'POST' }
  ],
  onError: (job, err) => console.error(`Cron ${job.path} failed`, err)
});

cron.start();
```

Receive the call and verify the secret inside your endpoint:

```typescript
// src/routes/api/cron/send-digest/+server.ts
import { env } from '$env/dynamic/private';

export const POST = async ({ request }) => {
  if (request.headers.get('x-cron-secret') !== env.CRON_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  await sendDigest();
  return new Response('ok');
};
```

**Design notes**

- Simple `setInterval`-based scheduler. No drift compensation, no distributed locking, no exponential backoff — intended for single-process SvelteKit deployments. For scale-out scenarios use a real scheduler (e.g. BullMQ) and point it at the same HTTP endpoints.
- Header name defaults to `x-cron-secret`; override via `secretHeader`.

## SSE Stream Reader (`sse`)

Read a POST endpoint that answers `text/event-stream` — the pattern where a SvelteKit API route relays an LLM (or any) stream to the browser. `streamSse` is an async generator: `for await` over it and each `data:`/`event:` frame arrives as a parsed `SseEvent`.

```typescript
import { streamSse, SseRequestError } from '@urbicon-ui/sveltekit-utils/sse';

const controller = new AbortController();

try {
  for await (const ev of streamSse('/api/chat', {
    body: { messages }, // JSON-encoded, content-type set for you
    signal: controller.signal
  })) {
    if (ev.event === 'token') appendToken(JSON.parse(ev.data).text);
    else if (ev.event === 'error') throw new Error(JSON.parse(ev.data).message);
  }
} catch (err) {
  if (err instanceof SseRequestError) showError(err.body); // raw response body
  else if ((err as Error).name !== 'AbortError') throw err;
}

// Cancelling the stream closes the HTTP connection:
controller.abort();
```

Emit the matching frames from the endpoint:

```typescript
// src/routes/api/chat/+server.ts
export const POST = async ({ request }) => {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      for await (const token of runModel(await request.json())) send('token', { text: token });
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
};
```

**Design notes**

- **Chunk-decomposition-invariant** — the emitted event sequence is identical no matter how the byte stream splits into network chunks, including a split inside a CRLF pair or in the middle of a multi-byte UTF-8 character. Implements the core of the WHATWG SSE parser: `\r\n`/`\n`/`\r` terminators, multi-`data:` join with `\n`, one-leading-space stripping, `:`-comment lines, `id` persistence (NUL-poisoned ids ignored), leading-BOM strip, no dispatch without a `data` line or a final blank line.
- **Not an `EventSource`** — it POSTs a body and takes an injectable `fetch` (pass SvelteKit's `load` fetch to stream during SSR). It deliberately does **not** reconnect; `retry:` and unknown fields are parsed and ignored, and a dropped connection surfaces as the underlying `fetch`/read error.
- **Fail loud** — a non-2xx status, or a 2xx response with no body, throws `SseRequestError` carrying the `status` and a best-effort raw `body`. An abort propagates as an `AbortError` rather than ending the loop silently.
- **Body shaping** — a string body is sent verbatim (no forced content-type); any other value is JSON-stringified with `content-type: application/json`. `accept: text/event-stream` is always sent; caller `headers` override both defaults.

## Exports

| Subpath         | Contents                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.`             | Barrel of all modules                                                                                              |
| `./url.svelte`  | `useUrlParam`, `useUrlArrayParam`, `createUrlParam`, `updateUrlSearchParams`, `createTableQueryUrlSync`, types     |
| `./table-query` | `tableQueryToSearchParams`, `searchParamsToTableQuery`, `applyTableQueryToSearchParams`, `TableQueryParams`, types |
| `./cron`        | `createCronRunner`, `CronJob`, `CronRunnerConfig`, `CronRunner`                                                    |
| `./sse`         | `streamSse`, `SseEvent`, `StreamSseOptions`, `SseRequestError`                                                     |

## Development

```bash
bun --filter='@urbicon-ui/sveltekit-utils' run build    # svelte-package
bun --filter='@urbicon-ui/sveltekit-utils' run check    # svelte-check
```

## Scope & Roadmap

Candidate additions under consideration: form-helper runes, layout-runes, shared load-helpers.
