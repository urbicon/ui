<script lang="ts">
  import { ResetPasswordPage } from '@urbicon-ui/auth';
  import { page } from '$app/state';

  // Token from the reset link, e.g. /auth/reset-password?token=...
  const token = $derived(page.url.searchParams.get('token') ?? '');
</script>

<ResetPasswordPage {token} />
