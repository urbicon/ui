<!--
  Preview-only wrapper: the docs site has no /auth/register or
  /auth/forgot-password route, so the live preview points those links at the
  sibling components' docs pages instead of leaving them on a 404.
  The displayed snippet stays Basic.svelte (the real-world usage, which keeps
  the '/auth/*' defaults).
-->
<script lang="ts">
  import { LoginPage } from '@urbicon-ui/auth';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
</script>

<LoginPage
  onSuccess={() => goto(resolve('/'))}
  passkeyApiPath="/api/auth/passkey"
  rememberMe
  registerUrl={resolve('/auth/components/register-page')}
  forgotPasswordUrl={resolve('/auth/components/forgot-password-page')}
/>
