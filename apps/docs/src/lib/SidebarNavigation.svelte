<script lang="ts">
  import { page } from '$app/state';
  import { resolveNav, useNavLabel, type NavItem } from '$lib/navigation';

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

  const path = $derived(page.url.pathname);

  /** Groups have no href, so their identity is the section path plus the name. */
  const groupKey = (section: NavItem, group: NavItem) =>
    `${section.href ?? section.name}/${group.name}`;

  /**
   * Which group is open. Only one at a time: the section under Blocks holds 75
   * leaves across 8 groups, and showing them all is what made the list 3714px
   * tall — taller than any viewport, so the marked entry sat far below the fold
   * on every deep link.
   *
   * Derived from the route, with a manual override that expires the moment the
   * route changes. Storing the path alongside the choice keeps this a pure
   * derivation — no effect has to reach in and reset it after navigation.
   */
  const routeGroupKey = $derived.by(() => {
    for (const section of items) {
      for (const child of section.children ?? []) {
        if (!child.group) continue;
        if (child.children?.some((leaf) => isActive(leaf.href, path)))
          return groupKey(section, child);
      }
    }
    return null;
  });
  let manual = $state<{ path: string; key: string | null } | null>(null);
  const openKey = $derived(manual?.path === path ? manual.key : routeGroupKey);

  function toggleGroup(key: string) {
    manual = { path, key: openKey === key ? null : key };
  }

  /**
   * Bring the current page into view inside the sidebar's scroll box.
   *
   * The box is real — an `overflow-y-auto` container of ~666px inside the fixed
   * aside — but nothing ever scrolled it, so a deep link left it at the top
   * while the marked row sat 1600px down. `block: 'nearest'` so an entry that
   * is already visible does not jolt the list; instant, because this is a
   * restore, not a gesture the reader made.
   */
  function revealSelf(node: HTMLElement) {
    node.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  // ── Row anatomy ──────────────────────────────────────────────────
  // One label edge for the section rows; group rows and leaves share the
  // second edge, so the tree is two edges deep, never three — the section is
  // the context (only one is ever open), not a level of its own.
  const row = 'relative flex items-center gap-2 py-1.5 pr-2 text-sm transition-colors';
  const sectionRow = `${row} pl-4`;
  const groupRow = `${row} w-full pl-4 text-left cursor-pointer`;
  const leafRow = `${row} pl-8`;
  // The section marker mirrors the TOC's active square.
  const marker =
    "before:absolute before:left-1 before:top-1/2 before:-translate-y-1/2 before:size-1.5 before:bg-primary before:content-['']";
  // The page the reader is ON gets a room-tinted chip.
  const chip = 'bg-surface-selected text-primary-emphasis font-medium rounded-modify';
</script>

<!--
  Rooms sidebar — one open group at a time, two edges deep.

  Three questions are open at once, so the marking answers all three: the
  square says which SECTION, the tinted group row and its rail say which GROUP,
  the chip says which PAGE. The rail carries the depth so the indent does not
  have to: leaves step in once, and their belonging is drawn as a line rather
  than as a third staircase step.
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
            sectionRow,
            'min-h-11',
            exact
              ? chip
              : inSection
                ? `text-primary font-medium ${marker}`
                : 'text-text-secondary hover:text-text-primary'
          ]}
          {@attach exact ? revealSelf : () => {}}
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
          {#each item.children ?? [] as child (child.href ?? child.name)}
            {#if child.group}
              {@const key = groupKey(item, child)}
              {@const open = openKey === key}
              {@const holdsPage =
                child.children?.some((leaf) => isActive(leaf.href, path)) ?? false}
              <button
                type="button"
                aria-expanded={open}
                onclick={() => toggleGroup(key)}
                class={[
                  groupRow,
                  'min-h-9',
                  holdsPage
                    ? 'text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary'
                ]}
              >
                <span
                  class={[
                    'text-text-quaternary w-2 shrink-0 text-[0.6rem] transition-transform',
                    open && 'rotate-90'
                  ]}
                  aria-hidden="true">▶</span
                >
                {navLabel(child)}
                <span class="font-meta text-text-quaternary ml-auto text-2xs"
                  >{child.children?.length ?? 0}</span
                >
              </button>

              {#if open}
                <!-- The rail: it runs beside the open group and stops where the
                     group stops, so belonging is visible without a second
                     indent. Tinted while this group holds the current page,
                     quiet when the reader opened a different one. -->
                <div
                  class={[
                    'ml-[1.35rem] flex flex-col gap-px border-l pl-0',
                    holdsPage ? 'border-primary' : 'border-border-default'
                  ]}
                >
                  {#each child.children ?? [] as leaf (leaf.href ?? leaf.name)}
                    {#if leaf.href}
                      {@const leafActive = isActive(leaf.href, path)}
                      <a
                        href={resolveNav(leaf.href)}
                        aria-current={leafActive ? 'page' : undefined}
                        class={[
                          row,
                          'min-h-9 pl-3',
                          leafActive ? chip : 'text-text-tertiary hover:text-text-primary'
                        ]}
                        {@attach leafActive ? revealSelf : () => {}}
                      >
                        {navLabel(leaf)}
                      </a>
                    {/if}
                  {/each}
                </div>
              {/if}
            {:else if child.href}
              <!-- A section can hold plain links next to its groups (Table's
                   feature pages, Auth's reference). They sit on the group edge,
                   because that is what they are — siblings of the groups. -->
              {@const leafActive = isActive(child.href, path)}
              <a
                href={resolveNav(child.href)}
                aria-current={leafActive ? 'page' : undefined}
                class={[
                  leafRow,
                  'min-h-9',
                  leafActive ? chip : 'text-text-tertiary hover:text-text-primary'
                ]}
                {@attach leafActive ? revealSelf : () => {}}
              >
                {navLabel(child)}
              </a>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</nav>
