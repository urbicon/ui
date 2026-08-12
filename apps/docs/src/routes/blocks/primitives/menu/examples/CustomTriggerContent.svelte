<script lang="ts">
  import { Button, Menu, type MenuObjectOption, MoreHorizontalIcon } from '@urbicon-ui/blocks';

  let lastAction = $state('—');

  const items: MenuObjectOption[] = [
    { label: 'Rename', onSelect: () => (lastAction = 'Rename') },
    { label: 'Duplicate', onSelect: () => (lastAction = 'Duplicate') },
    { label: 'Delete', onSelect: () => (lastAction = 'Delete') }
  ];
</script>

<div class="flex items-center gap-4">
  <Menu {items}>
    {#snippet customTrigger(toggle, open)}
      <Button
        variant="ghost"
        size="sm"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}
      >
        <MoreHorizontalIcon class="h-4 w-4" />
      </Button>
    {/snippet}
  </Menu>
  <span class="text-text-tertiary text-sm">Last action: <code>{lastAction}</code></span>
</div>
