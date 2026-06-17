<script lang="ts">
  import { r } from '$lib/route';
  import { useAppI18n } from '$lib/i18n';
  import { navigationItems, useNavLabel, type NavItem } from './navigation';

  let { currentPath }: { currentPath: string } = $props();

  const ta = useAppI18n();
  const navLabel = useNavLabel();

  function getAllPages(items: NavItem[]): { name: string; href: string }[] {
    const result: { name: string; href: string }[] = [];
    for (const item of items) {
      if (item.href) result.push({ name: navLabel(item), href: item.href });
      if (item.children) result.push(...getAllPages(item.children));
    }
    return result;
  }

  const allPages = $derived(getAllPages(navigationItems));

  const currentIndex = $derived(allPages.findIndex((p) => p.href === currentPath));
  const prev = $derived(currentIndex > 0 ? allPages[currentIndex - 1] : null);
  const next = $derived(currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null);
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
          class="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {prev.name}
      </a>
    {:else}
      <div></div>
    {/if}
    {#if next}
      <a
        href={r(next.href)}
        class="group text-text-secondary hover:text-primary flex items-center gap-2 text-sm transition-colors"
      >
        {next.name}
        <svg
          class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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
