<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  Signing a session out (or "sign out others") updates the mocked list.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
-->
<script lang="ts">
  import { SessionManager } from '@urbicon-ui/auth';
  import { createSessionDemoFetcher } from '$lib/demo/auth-demo-fetch';

  const demoFetch = createSessionDemoFetcher();
</script>

<SessionManager apiPath="/api/auth/sessions" fetcher={demoFetch} />
