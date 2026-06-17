<script lang="ts">
  import { Menu, type MenuItemType } from '@urbicon-ui/blocks';

  let lastAction = $state('—');
  const items: MenuItemType[] = [
    { label: 'New file', onSelect: () => (lastAction = 'New file') },
    { label: 'Open recent', onSelect: () => (lastAction = 'Open recent') },
    { type: 'section', label: 'Workspace' },
    { label: 'Settings', onSelect: () => (lastAction = 'Settings') }
  ];
</script>

<div class="flex items-center gap-4">
  <Menu placeholder="File" {items} />
  <span class="text-text-tertiary text-sm">Last action: <code>{lastAction}</code></span>
</div>
