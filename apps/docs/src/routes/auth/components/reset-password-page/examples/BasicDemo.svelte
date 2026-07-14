<!--
  Preview-only wrapper: the docs site has no /auth/login route, so the live
  preview points that link at the LoginPage docs page instead of leaving it on
  a 404. The displayed snippet stays Basic.svelte (the real-world usage, which
  keeps the '/auth/login' default and reads the token from the URL).
-->
<script lang="ts">
  import { ResetPasswordPage } from '@urbicon-ui/auth';
  import { resolve } from '$app/paths';
</script>

<ResetPasswordPage token="demo-token" loginUrl={resolve('/auth/components/login-page')} />
