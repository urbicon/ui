<script lang="ts">
  import { r } from '$lib/route';
  import { useAppI18n } from '$lib/i18n';
  import { navigationItems, useNavLabel, type NavItem } from './navigation';

  let { currentPath }: { currentPath: string } = $props();

  const ta = useAppI18n();
  const navLabel = useNavLabel();

  type PageEntry = { name: string; href: string; group?: string };

  // Group landings that render their own bespoke layout (so they carry no
  // page-nav): drop the landing href from the reading chain, but keep the
  // section's real pages in it. `standalone` can't express this — it skips the
  // whole subtree, which is right for a fully bespoke group (recipes) but would
  // drop the blocks component pages too.
  const BESPOKE_GROUP_LANDINGS = new Set<string>(['/blocks']);

  /**
   * Flatten the nav into the reading chain, carrying each page's section label.
   * Group nodes hold no `href`, so the flat chain drops them entirely — the
   * section a link leads into can only survive by being threaded down from the
   * parent. `standalone` entries (and their children) are skipped: they are
   * jump-in / index / landing surfaces with no page-nav, so keeping them out of
   * the chain is what stops a neighbour's next/prev from pointing at a dead end.
   */
  function collectPages(items: NavItem[], group: string | undefined, into: PageEntry[]): void {
    for (const item of items) {
      if (item.standalone) continue;
      if (item.href && !BESPOKE_GROUP_LANDINGS.has(item.href)) {
        into.push({ name: navLabel(item), href: item.href, group });
      }
      if (item.children) collectPages(item.children, navLabel(item), into);
    }
  }

  const allPages = $derived.by(() => {
    const pages: PageEntry[] = [];
    collectPages(navigationItems, undefined, pages);
    return pages;
  });

  const currentIndex = $derived(allPages.findIndex((p) => p.href === currentPath));
  const prev = $derived(currentIndex > 0 ? allPages[currentIndex - 1] : null);
  // currentIndex === -1 means the page is outside the reading chain (a
  // standalone surface that still renders through DocsLayout). It must yield no
  // next — not the first page — now that the layout mounts this on every
  // DocsLayout page rather than only on pages known to be in the chain.
  const next = $derived(
    currentIndex >= 0 && currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null
  );

  // `meta-marker` is only defined under `.docs-rooms` (rooms-docs.css), which the
  // library skin removes from <html>. The utilities carry that unscoped case; the
  // rooms rule is unlayered, so it still wins over them wherever the scope applies.
  // Same pairing as TableOfContents' title slot.
  const kicker = 'meta-marker text-text-tertiary text-xs font-medium tracking-wider uppercase';
</script>

{#if prev || next}
  <nav
    class="border-border-subtle mt-12 flex items-center justify-between border-t pt-6"
    aria-label={ta('chrome.pageNavigation' as Parameters<typeof ta>[0])}
  >
    {#if prev}
      <a
        href={r(prev.href)}
        class="group text-text-secondary hover:text-primary flex items-center gap-2 text-sm transition-colors"
      >
        <svg
          class="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="flex flex-col items-start">
          {#if prev.group}<span class={kicker}>{prev.group}</span>{/if}
          <span>{prev.name}</span>
        </span>
      </a>
    {:else}
      <div></div>
    {/if}
    {#if next}
      <a
        href={r(next.href)}
        class="group text-text-secondary hover:text-primary flex items-center gap-2 text-sm transition-colors"
      >
        <span class="flex flex-col items-end">
          {#if next.group}<span class={kicker}>{next.group}</span>{/if}
          <span>{next.name}</span>
        </span>
        <svg
          class="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    {/if}
  </nav>
{/if}
