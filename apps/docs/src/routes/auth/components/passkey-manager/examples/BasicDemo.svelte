<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
  `headingLevel` continues the host's outline: 4 below the doc page's example
  title (h3), 3 from Playground.svelte, which stages it under the landing
  hero's h2.
-->
<script lang="ts">
  import { PasskeyManager } from '@urbicon-ui/auth';
  import { createPasskeyDemoFetcher } from '#lib/demo/auth-demo-fetch.js';

  let { headingLevel = 4 }: { headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 } = $props();

  const demoFetch = createPasskeyDemoFetcher();
</script>

<PasskeyManager {headingLevel} apiPath="/api/auth/passkey" fetcher={demoFetch} />
