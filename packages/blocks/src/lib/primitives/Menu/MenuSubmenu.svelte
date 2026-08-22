<script lang="ts">
  import type { Snippet } from 'svelte';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
  import { mintAttachment } from '$lib';
  import { getMenuContext, setMenuParentId } from './menu.context';
  import { menuIconVariants } from './menu.variants';
  import MenuItemComp from './MenuItem.svelte';
  import type { MenuItemType, MenuObjectOption } from './index';

  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const ChevronRightIcon = resolveIcon('chevronRight', ChevronRightIconDefault);

  let {
    id,
    label,
    disabled = false,
    icon,
    detail,
    checkGutter,
    items,
    children,
    class: className = ''
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
     * Right-aligned secondary text on the parent row — typically the current
     * value among the sub-menu's entries ("Average"), visible while collapsed.
     */
    detail?: string;
    /**
     * Reserve the checkmark gutter on the parent row (always empty — a
     * disclosure is never checked), so it aligns with radio rows in the same
     * scope. Falls back to the menu-wide signal when omitted.
     */
    checkGutter?: boolean;
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
    /** Extra classes merged onto the parent row, after `slotClasses.item`. */
    class?: string;
  } = $props();

  const ctx = getMenuContext();
  if (!ctx) throw new Error('MenuSubmenu must be used inside Menu');

  const isOpen = $derived(ctx.isSubMenuOpen(id));

  // Provide parent id to descendants exactly once per component instance
  // so that nested MenuItem components can register with correct parent.
  // svelte-ignore state_referenced_locally
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

  // Field access runs through the context's mapper-honoring resolvers — the
  // same pipeline as Menu's top level. Reading the object fields directly
  // here (the previous shape) silently cut every `getItem*` mapper off at
  // the submenu boundary.
  const resolvers = $derived(ctx.resolvers);

  const reserveParentGutter = $derived(checkGutter ?? ctx.showCheckGutter);

  // The submenu panel is its own scope: reserve the child gutter as soon as
  // any array-shape child carries `checked`. Declarative children fall back
  // to the menu-wide signal inside MenuItem itself.
  const childrenGutter = $derived(
    (items ?? []).some(
      (child) => !resolvers.isSection(child) && resolvers.checked(child) !== undefined
    )
  );

  // `detail` is a description, not part of the accessible name — see
  // MenuItem for the aria-hidden + aria-describedby rationale.
  const detailId = $derived(`${ctx.rootId}-submenu-${id}-detail`);
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
  aria-describedby={detail ? detailId : undefined}
  aria-disabled={disabled || undefined}
  class={ctx.unstyled
    ? [ctx.slotClasses?.item, className].filter(Boolean).join(' ')
    : ctx.styles.item({
        itemSize: ctx.itemSizeForDepth(0),
        disabled,
        class: [ctx.slotClasses?.item, className]
      })}
  {@attach mintAttachment(ctx.mint, { enabled: !disabled })}
>
  {#if reserveParentGutter}
    <!-- Empty check gutter: a disclosure row is never checked, but it still
         aligns with the radio rows of its scope. -->
    <span
      aria-hidden="true"
      class={ctx.unstyled
        ? (ctx.slotClasses?.indicator ?? '')
        : ctx.styles.indicator({ class: ctx.slotClasses?.indicator })}
    >
      <CheckIcon class={menuIconVariants({ type: 'checkmark', class: 'invisible' })} />
    </span>
  {/if}
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
  {#if detail}
    <span
      id={detailId}
      aria-hidden="true"
      class={ctx.unstyled
        ? (ctx.slotClasses?.detail ?? '')
        : ctx.styles.detail({ class: ctx.slotClasses?.detail })}
    >
      {detail}
    </span>
  {/if}
  <ChevronRightIcon class="h-4 w-4 opacity-70" />
</button>

{#if isOpen}
  <div
    role="menu"
    class={ctx.unstyled
      ? (ctx.slotClasses?.submenu ?? '')
      : ctx.styles.submenu({ class: ctx.slotClasses?.submenu })}
  >
    {#if items && items.length > 0}
      {#each items as child, i (resolvers.id(child, i))}
        {#if resolvers.isSection(child)}
          <div
            role="presentation"
            class={ctx.unstyled
              ? (ctx.slotClasses?.section ?? '')
              : ctx.styles.section({ class: ctx.slotClasses?.section })}
          >
            {resolvers.sectionLabel(child)}
          </div>
        {:else}
          {@const childOpt = typeof child === 'object' ? (child as MenuObjectOption) : null}
          <MenuItemComp
            id={resolvers.id(child, i)}
            label={resolvers.label(child)}
            disabled={resolvers.disabled(child)}
            icon={resolvers.icon(child)}
            checked={resolvers.checked(child)}
            detail={resolvers.detail(child)}
            class={resolvers.class(child)}
            onSelect={childOpt?.onSelect}
            keepOpen={childOpt?.keepOpen}
            checkGutter={childrenGutter}
          />
        {/if}
      {/each}
    {:else if children}
      {@render children()}
    {/if}
  </div>
{/if}
