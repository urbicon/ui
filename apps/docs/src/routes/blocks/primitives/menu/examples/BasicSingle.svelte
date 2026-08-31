<script lang="ts">
  import { Menu, MenuDivider, MenuItem, MenuSection } from '@urbicon-ui/blocks';

  let lastAction = $state('—');
</script>

<div class="flex items-center gap-4">
  <Menu placeholder="File">
    <MenuItem label="New file" onSelect={() => (lastAction = 'New file')} />
    <MenuItem label="Open recent" onSelect={() => (lastAction = 'Open recent')} />
    <MenuSection label="Workspace">
      <MenuItem label="Settings" onSelect={() => (lastAction = 'Settings')} />
      <MenuItem label="Extensions" onSelect={() => (lastAction = 'Extensions')} />
    </MenuSection>
    <MenuDivider />
    <MenuItem label="Close window" onSelect={() => (lastAction = 'Close window')} />
  </Menu>
  <span class="text-text-tertiary text-sm">Last action: <code>{lastAction}</code></span>
</div>
