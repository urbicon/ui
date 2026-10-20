<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  mocks a successful verification via the `fetcher` prop.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
  `headingLevel` continues this page's outline below the example's h3 title.
-->
<script lang="ts">
  import { VerifyEmailPage } from '@urbicon-ui/auth';
  import { createVerifyEmailDemoFetcher } from '#lib/demo/auth-demo-fetch.js';

  const demoFetch = createVerifyEmailDemoFetcher();
</script>

<VerifyEmailPage headingLevel={4} token="demo-token" fetcher={demoFetch} />
