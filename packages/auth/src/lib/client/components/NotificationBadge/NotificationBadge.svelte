<script lang="ts">
  import { Badge, getBlocksConfig, resolveClassChain } from '@urbicon-ui/blocks';
  import { resolveAuthSlotClasses } from '../../utils/slot-class.js';
  import type { NotificationBadgeProps } from './index.js';

  let {
    count,
    onclick,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: NotificationBadgeProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
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
    class={resolveClassChain(slotClasses.root, className)}
  >
    {count > 99 ? '99+' : count}
  </Badge>
{/if}
