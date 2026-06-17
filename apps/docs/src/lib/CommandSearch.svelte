<script lang="ts">
  import { CommandPalette } from '@urbicon-ui/blocks';
  import type { CommandPaletteItem } from '@urbicon-ui/blocks';
  import { nav } from '$lib/route';
  import { useAppI18n } from '$lib/i18n';
  import { navigationItems, useNavLabel, type NavItem } from './navigation';

  const ta = useAppI18n();
  const navLabel = useNavLabel();

  function flattenNav(items: NavItem[], category = ''): CommandPaletteItem[] {
    const result: CommandPaletteItem[] = [];
    for (const item of items) {
      const cat = item.group ? navLabel(item) : category;
      if (item.href) {
        result.push({
          id: item.href,
          label: navLabel(item),
          category: cat || ta('chrome.pages' as Parameters<typeof ta>[0]),
          icon: 'M9 5l7 7-7 7',
          data: { href: item.href }
        });
      }
      if (item.children) {
        result.push(...flattenNav(item.children, cat || navLabel(item)));
      }
    }
    return result;
  }

  const allItems = $derived(flattenNav(navigationItems));

  let open = $state(false);
  let palette: ReturnType<typeof CommandPalette> | undefined = $state();

  function handleSelect(item: CommandPaletteItem) {
    const href = (item.data as { href: string })?.href;
    if (href) nav(href);
  }

  export function toggle() {
    palette?.toggle();
  }
</script>

<CommandPalette
  bind:this={palette}
  bind:open
  items={allItems}
  onSelect={handleSelect}
  placeholder={ta('chrome.searchPlaceholder' as Parameters<typeof ta>[0])}
/>
