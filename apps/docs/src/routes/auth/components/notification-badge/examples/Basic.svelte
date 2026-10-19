<script lang="ts">
  import { NotificationBadge } from '@urbicon-ui/auth';
  import { Button } from '@urbicon-ui/blocks';

  let count = $state(3);
  let lastClick = $state<number | null>(null);
</script>

<div class="flex items-center gap-6">
  <div class="relative">
    <span class="text-text-secondary text-sm">Notifications</span>
    <!-- No `alert()`: this example also runs outside the docs page (in the
         landing hero), where a browser dialog would block everything else. The
         feedback renders beside the badge instead. -->
    <NotificationBadge {count} onclick={() => (lastClick = count)} />
  </div>

  {#if lastClick !== null}
    <span class="text-text-tertiary text-sm" role="status">{lastClick} unread</span>
  {/if}

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
