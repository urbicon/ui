# @urbicon-ui/sveltekit-utils

Small, focused SvelteKit helpers that Urbicon apps share. Zero runtime dependencies.

Currently shipping:

- **URL-state runes** — reactive `useUrlParam` / `useUrlArrayParam` that keep component state in sync with `?query=` parameters
- **Table view ↔ URL** — `bindViewToUrl`, the URL home for a `@urbicon-ui/table` view object (`?q=…&sort=…&page=…`), plus the pure serializers for the load path
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

## Table View ↔ URL (`url.svelte` + `table-view`)

`bindViewToUrl` gives the view object of `@urbicon-ui/table` — search, sort, page, page size, filters, grouping — the URL as its home: the axes are mirrored onto query parameters (`?q=…&sort=…&page=…`), so the view survives a reload, can be shared as a link, and — unlike `localStorage` — is visible to the server.

```svelte
<script lang="ts">
  import { Table, createTableView } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const view = createTableView({ defaults: { pageSize: 25 } });
  bindViewToUrl(view);
</script>

<Table {items} {columns} {view} />
```

Both calls belong in the component's initialisation. The init half runs synchronously — a `?sort=…` link renders sorted server HTML — and the runtime halves are effects: URL navigations apply to the view, the reader's changes reach the URL debounced.

The second argument is optional; every option has a default:

| Option            | Default | Effect                                                                                                                                                                                                            |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axes`            | all six | Which axes this binding manages. An unbound axis never reaches the URL, whatever the view holds.                                                                                                                  |
| `debounceMs`      | `300`   | Delay before a view change is written to the URL.                                                                                                                                                                 |
| `replaceState`    | `true`  | Replace the current history entry instead of pushing one, so rapid sort/filter/page edits do not flood the back button.                                                                                           |
| `prefix`          | `''`    | Key namespace (`prefix: 't_'` → `?t_q=…&t_page=…`) for a second bound table on the same page.                                                                                                                     |
| `reflectExternal` | `false` | Mirror an externally applied value (a storage seed) into the URL immediately. Off by default: the address bar does not change without reader interaction, and the seed reaches the URL with the first one anyway. |

Because the binding re-reads the URL rather than capturing it, the browser's back button works: navigating back to a URL that no longer names `?sort` returns the table to its default sort.

The pure serializers work without SvelteKit — e.g. to parse the incoming query in a server `load` and fetch the first page during SSR. Use `searchParamsToViewSnapshot` from `./table-view`: it takes the *same* defaults object the component hands `createTableView`, so the server cannot resolve an absent param differently from the client, and it hands back the very shape a managed `source.query` receives.

```typescript
// view-defaults.ts — imported by both the component and the load function
export const userView = { pageSize: 25, sort: { column: 'joined', direction: 'desc' } };

// +page.server.ts
import { searchParamsToViewSnapshot } from '@urbicon-ui/sveltekit-utils/table-view';
import { userView } from './view-defaults';

export const load = async ({ url }) => ({
  initialResult: await fetchUsers(searchParamsToViewSnapshot(url.searchParams, userView))
});
```

The `./table-query` subpath that used to hold a second copy of this codec — same URL scheme, wire-vocabulary spellings, no field for a default filter set — retired with the vocabulary split it served (#162).

**Design notes**

- **Default elision** — an axis whose value equals its default is not written; a table in its default state leaves the URL clean. The baseline *is* `view.defaults`, read off the object the binding decorates, so there is no second copy of the defaults to keep in step with the table's own.
- **Read tolerant, write strict** — an unparsable value on a param the URL actually carries falls back to that axis' default, and malformed `filter` entries are skipped individually. `assertValidViewSnapshot` is the strict half: it throws on a structurally invalid view (non-positive page, unknown operator) instead of writing corrupt state, and `applyViewToSearchParams` calls it. `viewSnapshotToSearchParams` deliberately does not — it runs inside the binding on every view change, where a throw would cost the page rather than the URL.
- **Namespacing** — `prefix: 't_'` scopes all keys (`?t_q=…`) for multiple bound tables on one page; unrelated params are always preserved. Two prefixless bindings would manage the same keys, so that throws at registration instead of producing a link that loads the wrong table.
- **One writer per page** — every binding submits into one coalescing URL writer, so two tables land in a single navigation, each replacing only its own keys. A landing URL the writer itself sent is not applied back onto the view: an edit made while that navigation was in flight survives instead of being overwritten by the URL it raced.
- **Types** — `TableViewLike`, `TableViewSnapshot` and `TableViewFilter` mirror the table's view object structurally, so this package carries no dependency on `@urbicon-ui/table`. A parity test in the table package (`viewMirror.parity.test.ts`) pins the mirror: the shapes must stay mutually assignable, and the real `TableView` must satisfy `TableViewLike`, which is the entire mechanism by which this binding decorates a view it never imports.

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

| Subpath         | Contents                                                                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`             | Barrel of all modules                                                                                                                              |
| `./url.svelte`  | `useUrlParam`, `useUrlArrayParam`, `createUrlParam`, `updateUrlSearchParams`, `bindViewToUrl`, types                                               |
| `./table-view`  | `searchParamsToViewSnapshot`, `searchParamsToViewPartial`, `viewSnapshotToSearchParams`, `applyViewToSearchParams`, `assertValidViewSnapshot`, `viewAxesNamedBy`, `viewAxisKeys`, `TABLE_VIEW_AXES`, `TABLE_VIEW_FILTER_OPERATORS`, `TableViewLike`, types |
| `./cron`        | `createCronRunner`, `CronJob`, `CronRunnerConfig`, `CronRunner`                                                                                    |
| `./sse`         | `streamSse`, `SseEvent`, `StreamSseOptions`, `SseRequestError`                                                                                     |

`bindViewToUrl` lives in its own module (`view-binding.svelte.ts`) and is re-exported from `./url.svelte`, which is its documented import path — it has no subpath of its own. `./table-view` is SvelteKit-free (it touches no `$app/*`), which is what lets a `load` function and a plain test use it; `./url.svelte` is the half that needs the router.

## Development

```bash
bun --filter='@urbicon-ui/sveltekit-utils' run build    # svelte-package
bun --filter='@urbicon-ui/sveltekit-utils' run check    # svelte-check
```

## Scope & Roadmap

Candidate additions under consideration: form-helper runes, layout-runes, shared load-helpers.
