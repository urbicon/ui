<script lang="ts">
  import { VerifyEmailPage } from '@urbicon-ui/auth';
  import { page } from '$app/state';

  // Token from the verification link, e.g. /verify-email?token=...
  const token = $derived(page.url.searchParams.get('token') ?? '');
</script>

<VerifyEmailPage {token} />
