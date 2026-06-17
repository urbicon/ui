<script lang="ts">
  import { Badge } from '@urbicon-ui/blocks';
  import type { NotificationBadgeProps } from './index.js';

  let { count, onclick, unstyled = false, class: className }: NotificationBadgeProps = $props();
</script>

{#if count > 0}
  <Badge
    intent="danger"
    variant="filled"
    size="sm"
    interactive
    {onclick}
    {unstyled}
    class={className}
  >
    {count > 99 ? '99+' : count}
  </Badge>
{/if}
