# @urbicon-ui/sveltekit-utils

Small, focused SvelteKit helpers that Urbicon apps share. Zero runtime dependencies.

Currently shipping:

- **URL-state runes** — reactive `useUrlParam` / `useUrlArrayParam` that keep component state in sync with `?query=` parameters
- **Cron runner** — interval-based background fetcher for scheduled server endpoints

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

## Exports

| Subpath        | Contents                                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| `.`            | Barrel of both modules                                                              |
| `./url.svelte` | `useUrlParam`, `useUrlArrayParam`, `createUrlParam`, `updateUrlSearchParams`, types |
| `./cron`       | `createCronRunner`, `CronJob`, `CronRunnerConfig`, `CronRunner`                     |

## Development

```bash
bun --filter='@urbicon-ui/sveltekit-utils' run build    # svelte-package
bun --filter='@urbicon-ui/sveltekit-utils' run check    # svelte-check
```

## Scope & Roadmap

Candidate additions under consideration: form-helper runes, layout-runes, shared load-helpers.
