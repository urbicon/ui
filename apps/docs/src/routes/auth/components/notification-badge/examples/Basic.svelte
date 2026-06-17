<script lang="ts">
  import { NotificationBadge } from '@urbicon-ui/auth';
  import { Button } from '@urbicon-ui/blocks';

  let count = $state(3);
</script>

<div class="flex items-center gap-6">
  <div class="relative">
    <span class="text-text-secondary text-sm">Notifications</span>
    <NotificationBadge {count} onclick={() => alert(`${count} unread`)} />
  </div>

  <div class="flex gap-2">
    <Button size="sm" variant="outlined" intent="neutral" onclick={() => count++}>+1</Button>
    <Button
      size="sm"
      variant="outlined"
      intent="neutral"
      onclick={() => (count = Math.max(0, count - 1))}>-1</Button
    >
    <Button size="sm" variant="ghost" intent="neutral" onclick={() => (count = 0)}>Clear</Button>
  </div>
</div>
