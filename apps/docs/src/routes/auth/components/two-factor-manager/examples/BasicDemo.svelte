<!--
  Preview-only wrapper: the docs site has no auth backend, so the live preview
  runs against a mocked demo API via the `fetcher` prop.
  Setup returns a demo secret + otpauth URI; enabling with any 6-digit code
  reveals demo backup codes. No real TOTP verification happens. The `qr` snippet
  is intentionally omitted, so the zero-dep manual-entry fallback is shown.
  The displayed snippet stays Basic.svelte (the real server-backed usage).
  `headingLevel` continues the host's outline: 4 below the doc page's example
  title (h3), 3 from Playground.svelte, which stages it under the landing
  hero's h2.
-->
<script lang="ts">
  import { TwoFactorManager } from '@urbicon-ui/auth';
  import { createTwoFactorDemoFetcher, demoAuthUser } from '#lib/demo/auth-demo-fetch.js';

  let { headingLevel = 4 }: { headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 } = $props();

  const demoFetch = createTwoFactorDemoFetcher();
</script>

<TwoFactorManager
  {headingLevel}
  user={demoAuthUser}
  apiPath="/api/auth/account/2fa"
  fetcher={demoFetch}
/>
