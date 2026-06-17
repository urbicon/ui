<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  mocks a successful verification via the `fetcher` prop.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
-->
<script lang="ts">
  import { VerifyEmailPage } from '@urbicon-ui/auth';
  import { createVerifyEmailDemoFetcher } from '$lib/demo/auth-demo-fetch';

  const demoFetch = createVerifyEmailDemoFetcher();
</script>

<VerifyEmailPage token="demo-token" fetcher={demoFetch} />
