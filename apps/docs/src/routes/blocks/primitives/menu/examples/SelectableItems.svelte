<script lang="ts">
  import { Menu, type MenuObjectOption } from '@urbicon-ui/blocks';

  let sortBy = $state('Name');

  // Menu displays the checked state but never stores it — `sortBy` here is
  // the single source of truth, updated by each item's onSelect.
  const sortOption = (label: string): MenuObjectOption => ({
    id: label.toLowerCase(),
    label,
    checked: sortBy === label,
    onSelect: () => (sortBy = label)
  });

  const items = $derived<MenuObjectOption[]>([
    {
      id: 'sort',
      label: 'Sort by',
      detail: sortBy,
      children: [sortOption('Name'), sortOption('Date'), sortOption('Size')]
    },
    { id: 'refresh', label: 'Refresh' }
  ]);
</script>

<div class="flex items-center gap-4">
  <Menu placeholder="View" {items} />
  <span class="text-text-tertiary text-sm">Sorted by <code>{sortBy}</code></span>
</div>
