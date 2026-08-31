<script lang="ts">
  import Menu from '../Menu.svelte';
  import MenuDivider from '../MenuDivider.svelte';
  import MenuItem from '../MenuItem.svelte';
  import MenuSection from '../MenuSection.svelte';

  // ONE structure — a bare leading row, then a named section holding two rows
  // split by a rule — written in all three call forms of the same API, in one
  // render. Mounting them one at a time cannot show a divergence between them.
  //
  // `usePortal={false}` keeps each panel inside its own wrapper so a query can
  // be scoped per form; the portal would hoist all three into <body>.
  // `only` narrows the render to a single form. Three menus open at once fight
  // over focus (each one's open-effect moves focus into its own panel), so the
  // keyboard walk measures one at a time while the markup comparison keeps all
  // three side by side.
  let { only }: { only?: 'declarative' | 'array' | 'submenu' } = $props();

  const sectionItems = [
    'lead',
    { type: 'section', label: 'Group A' },
    'one',
    { type: 'divider' },
    'two'
  ] as const;
</script>

{#if !only || only === 'declarative'}
  <div data-form="declarative">
    <Menu open={true} usePortal={false} placeholder="declarative">
      <MenuItem label="lead" />
      <MenuSection label="Group A">
        <MenuItem label="one" />
        <MenuDivider />
        <MenuItem label="two" />
      </MenuSection>
    </Menu>
  </div>
{/if}

{#if !only || only === 'array'}
  <div data-form="array">
    <Menu open={true} usePortal={false} placeholder="array" items={[...sectionItems]} />
  </div>
{/if}

{#if !only || only === 'submenu'}
  <div data-form="submenu">
    <Menu
      open={true}
      usePortal={false}
      placeholder="submenu"
      items={[{ label: 'parent', id: 'parent', children: [...sectionItems] }]}
    />
  </div>
{/if}
