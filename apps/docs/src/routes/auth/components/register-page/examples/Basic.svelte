<script lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
</script>

<RegisterPage onSuccess={() => goto(resolve('/'))} />
