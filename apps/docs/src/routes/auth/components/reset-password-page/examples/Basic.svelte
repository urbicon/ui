<script lang="ts">
  import { ResetPasswordPage } from '@urbicon-ui/auth';
  import { page } from '$app/state';
  import { browser } from '$app/environment';

  // searchParams is unavailable during prerendering — the static build renders
  // with the demo token, the client reads the URL after hydration.
  const token = $derived(
    browser ? (page.url.searchParams.get('token') ?? 'demo-token') : 'demo-token'
  );
</script>

<ResetPasswordPage {token} />
