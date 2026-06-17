<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
-->
<script lang="ts">
  import { InvitationManager } from '@urbicon-ui/auth';
  import { createInvitationDemoFetcher } from '$lib/demo/auth-demo-fetch';

  const roles = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'USER', label: 'User' }
  ];

  const demoFetch = createInvitationDemoFetcher();
</script>

<InvitationManager {roles} fetcher={demoFetch} />
