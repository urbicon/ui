<!--
  Preview-only wrapper: the docs site has no /auth/login route, so the live
  preview points that link at the LoginPage docs page instead of leaving it on
  a 404. The displayed snippet stays Basic.svelte (the real-world usage, which
  keeps the '/auth/login' default).
-->
<script lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
</script>

<RegisterPage
  onSuccess={() => goto(resolve('/'))}
  loginUrl={resolve('/auth/components/login-page')}
/>
