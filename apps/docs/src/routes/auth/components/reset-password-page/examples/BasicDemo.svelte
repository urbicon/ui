<!--
  Preview-only wrapper: the docs site has no /auth/login route, so the live
  preview points that link at the LoginPage docs page instead of leaving it on
  a 404. The displayed snippet stays Basic.svelte (the real-world usage, which
  keeps the '/auth/login' default and reads the token from the URL).
  `headingLevel` continues the host's outline: 4 below the doc page's example
  title (h3), 3 from Playground.svelte, which stages it under the landing
  hero's h2.
-->
<script lang="ts">
  import { ResetPasswordPage } from '@urbicon-ui/auth';
  import { resolve } from '$app/paths';

  let { headingLevel = 4 }: { headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 } = $props();
</script>

<ResetPasswordPage
  {headingLevel}
  token="demo-token"
  loginUrl={resolve('/auth/components/login-page')}
/>
