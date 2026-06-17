<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
-->
<script lang="ts">
  import { PasskeyManager } from '@urbicon-ui/auth';
  import { createPasskeyDemoFetcher } from '$lib/demo/auth-demo-fetch';

  const demoFetch = createPasskeyDemoFetcher();
</script>

<PasskeyManager basePath="/api/auth/passkey" fetcher={demoFetch} />
