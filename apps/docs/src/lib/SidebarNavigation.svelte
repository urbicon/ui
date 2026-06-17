<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { useNavLabel, type NavItem } from '$lib/navigation';

  let { items } = $props<{ items: NavItem[] }>();

  const navLabel = useNavLabel();

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

  function shouldExpand(node: NavItem, path: string, level: number): boolean {
    if (!node.children || node.children.length === 0) return false;
    if (node.group) return hasActiveDescendant(node, path);
    return isActive(node.href, path) || hasActiveDescendant(node, path) || level === 0;
  }
</script>

<!--
  Editorial sidebar:
  - Active state = decorative pipe glyph via ::before (matches TOC, page-title cursor)
  - Hover     = pure colour shift (text-text-tertiary → text-text-primary), no background
  - Groups    = `meta-marker` class so `// FORM`, `// ACTIONS`, … read consistent
                with the right-rail TOC `// ON THIS PAGE` kicker
  - Indent only — no left-border rail
  - One uniform text-sm across all depths; depth is signalled by pl-* indent
-->
<nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
  {#each items as item (item.href ?? item.name)}
    {@const mainActive = isActive(item.href, page.url.pathname)}
    <div>
      {#if item.href}
        <a
          href={resolve(item.href)}
          class={[
            'relative flex min-h-11 items-center py-1.5 pl-4 text-sm transition-colors',
            mainActive
              ? 'text-primary before:text-primary font-medium before:absolute before:inset-y-0 before:left-1 before:flex before:items-center before:content-["|"]'
              : 'text-text-secondary hover:text-text-primary'
          ]}
        >
          {navLabel(item)}
        </a>
      {:else}
        <div class="text-text-secondary px-4 py-1.5 text-sm font-semibold">{navLabel(item)}</div>
      {/if}

      {#if shouldExpand(item, page.url.pathname, 0)}
        <div class="mt-0.5 flex flex-col gap-px pl-4">
          {#each item.children as child (child.href ?? child.name)}
            {@const childActive = isActive(child.href, page.url.pathname)}
            <div>
              {#if child.group}
                <div class="mt-2 mb-0.5 pl-4">
                  <span class="meta-marker">{navLabel(child)}</span>
                </div>
              {:else if child.href}
                <a
                  href={resolve(child.href)}
                  class={[
                    'relative flex min-h-10 items-center py-1 pl-4 text-sm transition-colors',
                    childActive
                      ? 'text-primary before:text-primary font-medium before:absolute before:inset-y-0 before:left-1 before:flex before:items-center before:content-["|"]'
                      : 'text-text-tertiary hover:text-text-primary'
                  ]}
                >
                  {navLabel(child)}
                </a>
              {/if}

              {#if child.children && (child.group || childActive || hasActiveDescendant(child, page.url.pathname))}
                <div class="flex flex-col gap-px pl-4">
                  {#each child.children as grand (grand.href ?? grand.name)}
                    {@const grandActive = isActive(grand.href, page.url.pathname)}
                    {#if grand.group}
                      <div class="mt-2 mb-0.5 pl-4">
                        <span class="meta-marker">{navLabel(grand)}</span>
                      </div>
                    {:else if grand.href}
                      <a
                        href={resolve(grand.href)}
                        class={[
                          'relative flex min-h-9 items-center py-1 pl-4 text-sm transition-colors',
                          grandActive
                            ? 'text-primary before:text-primary font-medium before:absolute before:inset-y-0 before:left-1 before:flex before:items-center before:content-["|"]'
                            : 'text-text-tertiary hover:text-text-primary'
                        ]}
                      >
                        {navLabel(grand)}
                      </a>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</nav>
