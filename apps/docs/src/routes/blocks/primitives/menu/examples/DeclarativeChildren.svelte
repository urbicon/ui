<script lang="ts">
  import { Menu, MenuItem, MenuSection, MenuDivider } from '@urbicon-ui/blocks';

  let lastAction = $state('—');
</script>

<div class="flex items-center gap-4">
  <Menu placeholder="More">
    <MenuSection label="Main" />
    <MenuItem label="Dashboard" onSelect={() => (lastAction = 'Dashboard')} />
    <MenuItem label="Settings" onSelect={() => (lastAction = 'Settings')} />
    <MenuDivider />
    <MenuSection label="Other" />
    <MenuItem label="Help" disabled />
  </Menu>
  <span class="text-text-tertiary text-sm">Last action: <code>{lastAction}</code></span>
</div>
