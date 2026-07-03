<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  Renaming shows a success state; deleting explains it needs a real backend.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
-->
<script lang="ts">
  import { AccountSettings } from '@urbicon-ui/auth';
  import { createAccountDemoFetcher, demoAuthUser } from '$lib/demo/auth-demo-fetch';

  const demoFetch = createAccountDemoFetcher();
</script>

<AccountSettings user={demoAuthUser} apiPath="/api/auth/account" fetcher={demoFetch} />
