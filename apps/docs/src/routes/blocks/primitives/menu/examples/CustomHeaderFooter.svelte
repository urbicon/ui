<script lang="ts">
  import { Menu, Button, type MenuObjectOption } from '@urbicon-ui/blocks';

  let lastAction = $state('—');

  const items: MenuObjectOption[] = [
    { label: 'Profile', onSelect: () => (lastAction = 'Profile') },
    { label: 'Billing', onSelect: () => (lastAction = 'Billing') },
    { label: 'Team', onSelect: () => (lastAction = 'Team') }
  ];
</script>

<div class="flex items-center gap-4">
  <Menu placeholder="Account" {items}>
    {#snippet customHeader()}
      <div class="text-text-secondary text-xs font-medium">Logged in as jane@example.com</div>
    {/snippet}
    {#snippet customFooter()}
      <div class="flex justify-end">
        <Button variant="ghost" intent="danger" size="sm" onclick={() => (lastAction = 'Sign out')}>
          Sign out
        </Button>
      </div>
    {/snippet}
  </Menu>
  <span class="text-text-tertiary text-sm">Last action: <code>{lastAction}</code></span>
</div>
