<script lang="ts">
  import { LoginPage } from '@urbicon-ui/auth';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
</script>

<LoginPage onSuccess={() => goto(resolve('/'))} passkeyApiPath="/api/auth/passkey" rememberMe />
