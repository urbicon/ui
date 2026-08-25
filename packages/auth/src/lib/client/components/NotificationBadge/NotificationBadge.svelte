<script lang="ts">
  import { Badge, getBlocksConfig } from '@urbicon-ui/blocks';
  import { resolveAuthSlotClasses } from '../../utils/slot-class.js';
  import type { NotificationBadgeProps } from './index.js';

  let {
    count,
    onclick,
    unstyled = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: NotificationBadgeProps = $props();

  const blocksConfig = getBlocksConfig();
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'NotificationBadge', preset, slotClassesProp)
  );
</script>

{#if count > 0}
  <Badge
    intent="danger"
    variant="filled"
    size="sm"
    interactive
    {onclick}
    {unstyled}
    class={[slotClasses.root, className].filter(Boolean).join(' ')}
  >
    {count > 99 ? '99+' : count}
  </Badge>
{/if}
