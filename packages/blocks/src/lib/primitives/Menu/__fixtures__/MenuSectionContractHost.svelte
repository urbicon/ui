<script lang="ts">
  import type { Component } from 'svelte';
  import Menu from '../Menu.svelte';
  import MenuItem from '../MenuItem.svelte';
  import MenuSection from '../MenuSection.svelte';

  let { omitChildren = false }: { omitChildren?: boolean } = $props();

  // The pre-#361 call form, laundered through a loose type on purpose:
  // `svelte-check` rejects it now, and the guard in MenuSection exists exactly
  // for consumers whose build never type-checks. A fixture that cannot express
  // the bad call cannot cover the guard.
  const LegacySection = MenuSection as unknown as Component<{ label: string }>;
</script>

<Menu open={true} usePortal={false} placeholder="File">
  {#if omitChildren}
    <LegacySection label="Group A" />
  {:else}
    <MenuSection label="Group A">
      <MenuItem label="one" />
    </MenuSection>
  {/if}
</Menu>
