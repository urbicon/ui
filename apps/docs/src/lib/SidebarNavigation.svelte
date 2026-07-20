<script lang="ts">
  import { page } from '$app/state';
  import { resolveNav, useNavLabel, type NavHref, type NavItem } from '$lib/navigation';

  let { items }: { items: NavItem[] } = $props();

  const navLabel = useNavLabel();

  // Prefix-active: this item's subtree contains the current page.
  function isActive(href: string | undefined, path: string) {
    if (!href) return false;
    if (href === '/') return path === '/';
    return path === href || path.startsWith(href + '/');
  }

  function hasActiveDescendant(node: NavItem, path: string): boolean {
    if (!node.children) return false;
    return node.children.some(
      (child) => isActive(child.href, path) || hasActiveDescendant(child, path)
    );
  }

  // A section expands IN PLACE while the reader is anywhere inside it; all
  // other sections stay single rows, so the list keeps its poster calm.
  function isExpanded(node: NavItem, path: string): boolean {
    if (!node.children?.length) return false;
    return isActive(node.href, path) || hasActiveDescendant(node, path);
  }

  // Flatten the active section's subtree into ONE column: group nodes become
  // mono kickers, their children (and direct link children, e.g. the Table
  // section) plain rows. No indent staircase — grouping is carried by the
  // kickers alone, every label sits on the same left edge.
  type FlatEntry =
    { kind: 'kicker'; item: NavItem } | { kind: 'link'; item: NavItem; href: NavHref };
  function flattenSection(node: NavItem): FlatEntry[] {
    const entries: FlatEntry[] = [];
    for (const child of node.children ?? []) {
      if (child.group) {
        entries.push({ kind: 'kicker', item: child });
        for (const leaf of child.children ?? []) {
          if (leaf.href) entries.push({ kind: 'link', item: leaf, href: leaf.href });
        }
      } else if (child.href) {
        entries.push({ kind: 'link', item: child, href: child.href });
      }
    }
    return entries;
  }

  const path = $derived(page.url.pathname);

  // Shared row anatomy — one label edge (pl-4) for every row; the marker
  // column (left-1) matches the TOC's active-square geometry.
  const row = 'relative flex items-center py-1.5 pl-4 pr-2 text-sm transition-colors';
  const marker =
    "before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:size-1.5 before:bg-primary before:content-['']";
  // The page the reader is ON gets a room-tinted chip; the section that
  // CONTAINS it gets the block marker.
  const chip = 'bg-surface-selected text-primary-emphasis font-medium rounded-modify';
</script>

<!--
  Rooms sidebar — flat two-zone list:
  - Zone 1: every top-level entry, always visible, single rows.
  - Zone 2: the active section's content, expanded in place directly below
    its row — group kickers (`meta-marker`) + rows, no nested indentation.
  Active page = surface-selected chip; active section = block-cursor square
  (mirrors the TOC marker); hover = colour shift only.
-->
<nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
  {#each items as item (item.href ?? item.name)}
    {@const exact = item.href != null && path === item.href}
    {@const inSection = isActive(item.href, path) || hasActiveDescendant(item, path)}
    <div>
      {#if item.href}
        <a
          href={resolveNav(item.href)}
          aria-current={exact ? 'page' : undefined}
          class={[
            row,
            'min-h-11',
            exact
              ? chip
              : inSection
                ? `text-primary font-medium ${marker}`
                : 'text-text-secondary hover:text-text-primary'
          ]}
        >
          {navLabel(item)}
        </a>
      {:else}
        <div class="text-text-secondary min-h-11 py-1.5 pl-4 text-sm font-semibold">
          {navLabel(item)}
        </div>
      {/if}

      {#if isExpanded(item, path)}
        <div class="flex flex-col gap-px pb-2">
          {#each flattenSection(item) as entry (entry.item.href ?? entry.item.name)}
            {#if entry.kind === 'kicker'}
              <!-- `meta-marker` only exists under `.docs-rooms` (rooms-docs.css, unlayered —
                   wins over the utility layer); the utilities carry the library skin, same
                   pairing as PrevNextNav's kicker and TableOfContents' title slot. -->
              <div class="mt-3 mb-0.5 pl-4">
                <span
                  class="meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase"
                  >{navLabel(entry.item)}</span
                >
              </div>
            {:else}
              {@const leafActive = isActive(entry.href, path)}
              <a
                href={resolveNav(entry.href)}
                aria-current={leafActive ? 'page' : undefined}
                class={[
                  row,
                  'min-h-9',
                  leafActive ? chip : 'text-text-tertiary hover:text-text-primary'
                ]}
              >
                {navLabel(entry.item)}
              </a>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</nav>
