<script lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
</script>

<!-- The invitation link is /auth/register?token=<secret>&email=<invitee>; the
     token is the proof of invitation, so read both off the URL. -->
<RegisterPage
  token={page.url.searchParams.get('token') ?? ''}
  defaultEmail={page.url.searchParams.get('email') ?? ''}
  onSuccess={() => goto(resolve('/'))}
/>
