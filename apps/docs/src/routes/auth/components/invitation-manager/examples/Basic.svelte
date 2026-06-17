<script lang="ts">
  import { InvitationManager } from '@urbicon-ui/auth';

  const roles = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'USER', label: 'User' }
  ];
</script>

<InvitationManager {roles} />
