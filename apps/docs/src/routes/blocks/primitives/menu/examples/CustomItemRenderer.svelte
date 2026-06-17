<script lang="ts">
  import { Menu, type MenuObjectOption } from '@urbicon-ui/blocks';

  let lastAction = $state('—');

  const items: MenuObjectOption[] = [
    { id: 'copy', label: 'Copy link', onSelect: () => (lastAction = 'Copy link') },
    { id: 'open', label: 'Open in new tab', onSelect: () => (lastAction = 'Open in new tab') },
    { id: 'archive', label: 'Archive', onSelect: () => (lastAction = 'Archive') }
  ];

  const icons: Record<string, string> = {
    copy: '🔗',
    open: '↗',
    archive: '📦'
  };
</script>

<div class="flex items-center gap-4">
  <Menu placeholder="Actions" {items}>
    {#snippet customItem(item)}
      <!--
        Render visible content only — Menu's outer button handles activation.
        Putting another <button> inside would nest interactive elements and
        fire the item's onSelect twice via event bubbling.
      -->
      <span class="flex w-full items-center gap-3">
        <span class="text-lg">{icons[(item as MenuObjectOption).id ?? '']}</span>
        <span class="flex-1 truncate">{(item as MenuObjectOption).label}</span>
      </span>
    {/snippet}
  </Menu>
  <span class="text-text-tertiary text-sm">Last action: <code>{lastAction}</code></span>
</div>
