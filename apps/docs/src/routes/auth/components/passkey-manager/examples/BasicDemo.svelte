<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
  `headingLevel` continues this page's outline below the example's h3 title.
-->
<script lang="ts">
  import { PasskeyManager } from '@urbicon-ui/auth';
  import { createPasskeyDemoFetcher } from '#lib/demo/auth-demo-fetch.js';

  const demoFetch = createPasskeyDemoFetcher();
</script>

<PasskeyManager headingLevel={4} apiPath="/api/auth/passkey" fetcher={demoFetch} />
