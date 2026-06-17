<script lang="ts">
  import { AccountSettings } from '@urbicon-ui/auth';
  import type { AuthUser } from '@urbicon-ui/auth';

  // `user` typically comes from your auth store or `locals.user`.
  let { user }: { user: AuthUser | null } = $props();
</script>

<AccountSettings {user} basePath="/api/auth/account" />
