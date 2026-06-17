<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolveIcon } from '$lib/icons';
  import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
  import { getMenuContext, setMenuParentId } from './menu.context';
  import MenuItemComp from './MenuItem.svelte';
  import type { MenuItemType, MenuObjectOption, MenuSectionHeader } from './index';

  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);

  let {
    id,
    label,
    disabled = false,
    icon,
    items,
    children
  }: {
    /** Stable id for sub-menu bookkeeping. */
    id: string;
    /** Visible label on the parent menu row. */
    label?: string;
    /** @default false */
    disabled?: boolean;
    /** Optional leading icon component. */
    icon?: unknown;
    /**
     * Array-shape children — used when Menu's parent `items` array contains a
     * `MenuObjectOption` with `children: MenuItemType[]`. Mutually exclusive
     * with the `children` snippet.
     */
    items?: MenuItemType[];
    /**
     * Declarative-shape children — used inside `<MenuSubmenu><MenuItem …/></MenuSubmenu>`.
     */
    children?: Snippet;
  } = $props();

  const ctx = getMenuContext();
  if (!ctx) throw new Error('MenuSubmenu must be used inside Menu');

  const isOpen = $derived(ctx.isSubMenuOpen(id));

  // Provide parent id to descendants exactly once per component instance
  // so that nested MenuItem components can register with correct parent.
  setMenuParentId(id);

  function toggleOpen() {
    if (disabled) return;
    ctx.toggleSubMenu(id);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      toggleOpen();
    } else if (e.key === 'ArrowLeft' && isOpen) {
      e.preventDefault();
      toggleOpen();
    }
  }

  function isSectionItem(it: MenuItemType): it is MenuSectionHeader {
    return typeof it === 'object' && it !== null && (it as MenuSectionHeader).type === 'section';
  }

  function resolveLabel(item: MenuItemType): string {
    if (typeof item === 'string') return item;
    if (isSectionItem(item)) return item.label;
    return ((item as MenuObjectOption).label as string | undefined) ?? '';
  }

  function resolveId(item: MenuItemType, fallbackIndex: number): string {
    if (typeof item === 'string') return item;
    if (isSectionItem(item)) return `section-${fallbackIndex}`;
    return ((item as MenuObjectOption).id as string | undefined) ?? `item-${fallbackIndex}`;
  }
</script>

<button
  id={`${ctx.rootId}-submenu-${id}`}
  type="button"
  {disabled}
  onclick={toggleOpen}
  onkeydown={onKeydown}
  role="menuitem"
  tabindex={-1}
  aria-haspopup="menu"
  aria-expanded={isOpen}
  aria-disabled={disabled || undefined}
  class={ctx.styles.item({ itemSize: ctx.itemSizeForDepth(0), disabled })}
  data-mint={ctx.mint}
>
  {#if icon}
    {@const Icon = icon as import('svelte').Component<{ class?: string }>}
    <span
      class={ctx.unstyled
        ? (ctx.slotClasses?.indicator ?? '')
        : ctx.styles.indicator({ class: ctx.slotClasses?.indicator })}
    >
      <Icon class="h-4 w-4" />
    </span>
  {/if}
  <span class="flex-1 truncate text-left">{label}</span>
  <ChevronRightIcon class="h-4 w-4 opacity-70" />
</button>

{#if isOpen}
  <div role="menu" class={ctx.styles.submenu()}>
    {#if items && items.length > 0}
      {#each items as child, i (resolveId(child, i))}
        {#if isSectionItem(child)}
          <div
            role="presentation"
            class={ctx.unstyled
              ? (ctx.slotClasses?.section ?? '')
              : ctx.styles.section({ class: ctx.slotClasses?.section })}
          >
            {child.label}
          </div>
        {:else}
          {@const childOpt = typeof child === 'object' ? (child as MenuObjectOption) : null}
          <MenuItemComp
            id={resolveId(child, i)}
            label={resolveLabel(child)}
            disabled={Boolean(childOpt?.disabled)}
            icon={childOpt?.icon}
            onSelect={childOpt?.onSelect}
            keepOpen={childOpt?.keepOpen}
          />
        {/if}
      {/each}
    {:else if children}
      {@render children()}
    {/if}
  </div>
{/if}
