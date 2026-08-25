<!--
  Preview-only wrapper: the docs site has no /auth/login route, so the live
  preview points that link at the LoginPage docs page instead of leaving it on
  a 404. It also hands the checklist a policy inline — the docs site mounts no
  createPasswordPolicyHandler, so the default `policyPath` request would 404 and
  the preview would show the single default rule. The displayed snippet stays
  Basic.svelte (the real-world usage, which reads the policy off the endpoint).
-->
<script lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
</script>

<RegisterPage
  token=""
  onSuccess={() => goto(resolve('/'))}
  loginUrl={resolve('/auth/components/login-page')}
  passwordPolicy={{
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecial: false
  }}
/>
