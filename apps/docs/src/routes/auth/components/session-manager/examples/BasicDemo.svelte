<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  Signing a session out (or "sign out others") updates the mocked list.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
  `headingLevel` continues the host's outline: 4 below the doc page's example
  title (h3), 3 from Playground.svelte, which stages it under the landing
  hero's h2.
-->
<script lang="ts">
  import { SessionManager } from '@urbicon-ui/auth';
  import { createSessionDemoFetcher } from '#lib/demo/auth-demo-fetch.js';

  let { headingLevel = 4 }: { headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 } = $props();

  const demoFetch = createSessionDemoFetcher();
</script>

<SessionManager {headingLevel} apiPath="/api/auth/sessions" fetcher={demoFetch} />
