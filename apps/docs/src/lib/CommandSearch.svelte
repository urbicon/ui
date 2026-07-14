<script lang="ts">
  import { CommandPalette } from '@urbicon-ui/blocks';
  import type { CommandPaletteItem } from '@urbicon-ui/blocks';
  import { nav } from '$lib/route';
  import { useAppI18n } from '$lib/i18n';
  import { navigationItems, useNavLabel, type NavItem } from './navigation';
  import { searchRecords, type SearchRecord } from './search';

  const ta = useAppI18n();
  const navLabel = useNavLabel();

  const ARROW_ICON = 'M9 5l7 7-7 7';
  const DOC_ICON =
    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';

  function flattenNav(items: NavItem[], category = ''): CommandPaletteItem[] {
    const result: CommandPaletteItem[] = [];
    for (const item of items) {
      const cat = item.group ? navLabel(item) : category;
      if (item.href) {
        result.push({
          id: item.href,
          label: navLabel(item),
          category: cat || ta('chrome.pages' as Parameters<typeof ta>[0]),
          icon: ARROW_ICON,
          data: { href: item.href }
        });
      }
      if (item.children) {
        result.push(...flattenNav(item.children, cat || navLabel(item)));
      }
    }
    return result;
  }

  const navItems = $derived(flattenNav(navigationItems));

  let open = $state(false);
  let query = $state('');
  let palette: ReturnType<typeof CommandPalette> | undefined = $state();

  /**
   * The content index is a ~145 KB gzipped static file. It is fetched on first
   * open rather than imported, so it never enters the initial bundle and never
   * blocks hydration — the palette answers from `navItems` until it lands.
   */
  let index = $state<SearchRecord[] | null>(null);
  let indexRequest: Promise<void> | undefined;

  function loadIndex(): void {
    indexRequest ??= fetch('/search-index.json')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((records: SearchRecord[]) => {
        index = records;
      })
      .catch((error: unknown) => {
        // Never break the palette over the index: nav-title search still works.
        console.error('[docs] search index unavailable', error);
      });
  }

  $effect(() => {
    if (open) loadIndex();
  });

  /** Nav titles, matched the way the palette's own filter would. */
  const navMatches = $derived.by(() => {
    if (!query) return navItems;
    const needle = query.toLowerCase();
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(needle) ||
        (item.category?.toLowerCase().includes(needle) ?? false)
    );
  });

  const navHrefs = $derived(
    new Set(navMatches.map((item) => (item.data as { href: string }).href))
  );

  /**
   * Content hits, minus anything the nav already offers under the same href —
   * a page whose title matches is better represented by its nav entry.
   *
   * Grouped under the indexed page's own title rather than a "Content" heading:
   * the group header then names where the hit lives, and the palette needs no
   * new UI string for a section whose contents are untranslated anyway.
   */
  const contentMatches = $derived.by(() => {
    if (!query || !index) return [];
    return searchRecords(index, query, { limit: 8 })
      .filter((hit) => !navHrefs.has(hit.href))
      .map((hit): CommandPaletteItem => ({
        id: hit.href,
        label: hit.record.t || hit.record.p,
        excerpt: hit.excerpt,
        category: hit.record.p,
        icon: DOC_ICON,
        data: { href: hit.href }
      }));
  });

  const allItems = $derived([...navMatches, ...contentMatches]);

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
  bind:query
  items={allItems}
  filter={() => true}
  onSelect={handleSelect}
  placeholder={ta('chrome.searchPlaceholder' as Parameters<typeof ta>[0])}
/>
