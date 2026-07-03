<script lang="ts">
  import { TwoFactorManager } from '@urbicon-ui/auth';
  import type { AuthUser } from '@urbicon-ui/auth';

  // `user` typically comes from your auth store or `locals.user`.
  let { user }: { user: AuthUser | null } = $props();
</script>

<TwoFactorManager {user} apiPath="/api/auth/account/2fa" />
