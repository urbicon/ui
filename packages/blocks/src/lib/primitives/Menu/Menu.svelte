<script lang="ts" generics="TItem extends MenuItemType = MenuItemType">
  import { tick, untrack } from 'svelte';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { Button, menuVariants, type MenuVariants } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import { getTierContext } from '$lib/utils/tier-context';
  import { resolveClassChain } from '$lib/utils/variants';
  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import Popover from '../Popover/Popover.svelte';
  import { popoverMotion } from '../Popover/popover.variants';
  import { setMenuContext, type MenuContext, type MenuRegistryItem } from './menu.context';
  import {
    groupMenuItems,
    isMenuDividerItem,
    menuEntryKey,
    type MenuGroupEntry
  } from './menu.grouping';
  import MenuDivider from './MenuDivider.svelte';
  import MenuItemComp from './MenuItem.svelte';
  import MenuSection from './MenuSection.svelte';
  import MenuSubmenu from './MenuSubmenu.svelte';
  import type {
    MenuDividerItem,
    MenuItemType,
    MenuObjectOption,
    MenuSectionHeader,
    MenuProps
  } from './index';

  const bt = useBlocksI18n();

  let {
    items = [],
    placeholder = bt('menu.placeholder'),
    getItemLabel,
    getItemId,
    getItemDisabled,
    getItemChildren,
    getItemIcon,
    getItemClass,
    getItemChecked,
    getItemDetail,
    isSection: isSectionMapper,
    isDivider: isDividerMapper,
    getSectionLabel,
    disabled = false,
    loading = false,
    open = $bindable(false),
    onOpenChange,
    id: idProp,
    placement = 'bottom-start',
    syncWidth = true,
    usePortal = true,
    customTrigger,
    contextTrigger,
    customItem,
    customHeader,
    customFooter,
    variant = 'outlined',
    size = 'md',
    itemSize: itemSizeProp,
    intent = 'neutral',
    tier,
    mint = 'none',
    chevronAnimation = 'rotate',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    children,
    ...restProps
  }: MenuProps<TItem> = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const propsId = $props.id();
  const rootId = $derived(idProp ?? `menu-${propsId}`);

  // Tier resolution: explicit prop wins, otherwise inherit from a wrapping
  // <Toolbar tier> / <ButtonGroup tier>, otherwise default to `commit` —
  // Menu is an Action surface, matching `<Button>`'s default tier.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  // The element that had focus when the menu opened (normally the trigger
  // button) — captured in the open effect below and refocused by `dismiss()`
  // on Escape / selection. Not bound to Popover's `triggerElement`; Popover
  // anchors + excludes via its own internal trigger-wrapper.
  let triggerRef = $state<HTMLElement>();
  let panelRef = $state<HTMLElement>();
  let openSubMenus = $state<Set<string>>(new Set());
  const childrenMode = $derived(!!children);

  // ── Context-menu (right-click) anchoring ───────────────────────────────
  // A context menu has no trigger button — it opens at the cursor. Floating UI
  // anchors to an element, not a point, so a 0×0 fixed-position element is
  // parked at the click coordinates and handed to Popover as the trigger.
  let cursorAnchor = $state<HTMLElement>();
  let contextX = $state(0);
  let contextY = $state(0);

  async function handleContextMenu(event: MouseEvent) {
    if (disabled || loading) return;
    // Suppress the native browser menu and anchor ours at the cursor.
    event.preventDefault();
    contextX = event.clientX;
    contextY = event.clientY;
    // Re-open at the new spot even if it was already open elsewhere: close and
    // let Popover tear down (await tick) before reopening, so it re-reads the
    // moved anchor rect. A synchronous setOpen(false)+setOpen(true) batches into
    // no net change and would strand the menu at the previous cursor position.
    if (open) {
      setOpen(false);
      await tick();
    }
    setOpen(true);
  }

  // Map of declarative MenuItems by id — populated via the context's
  // `registerItem` / `unregisterItem` hooks. Used to debug + (in future)
  // power type-ahead search; the keyboard model itself walks DOM-focusable
  // descendants directly so it works in array-mode too.
  // Plain Map — internal registry, not reactive UI state.
  const registryBuffer: Map<string, MenuRegistryItem> = new Map();

  // ── Item-shape mappers ─────────────────────────────────────────────────
  function isSectionItem(it: MenuItemType): it is MenuSectionHeader {
    if (isSectionMapper) return isSectionMapper(it);
    return typeof it === 'object' && it !== null && (it as MenuSectionHeader).type === 'section';
  }

  // Symmetric to `isSectionItem`: a consumer's own item type may legitimately
  // carry `type: 'divider'` as domain data, and without a mapper such a row
  // would silently render as a rule — the item and its `onSelect` lost, with
  // no error. The mapper is asked first, exactly like the section predicate.
  function isDividerItem(it: MenuItemType): it is MenuDividerItem {
    if (isDividerMapper) return isDividerMapper(it);
    return isMenuDividerItem(it);
  }

  function resolveSectionLabel(section: MenuSectionHeader): string {
    return getSectionLabel ? getSectionLabel(section) : section.label;
  }

  function resolveLabel(item: TItem): string {
    if (getItemLabel) return getItemLabel(item);
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      return ((item as MenuObjectOption).label as string | undefined) ?? '';
    }
    return String(item);
  }

  function resolveId(item: TItem, fallbackIndex: number): string {
    if (getItemId) return getItemId(item);
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) {
      return ((item as MenuObjectOption).id as string | undefined) ?? `item-${fallbackIndex}`;
    }
    return `item-${fallbackIndex}`;
  }

  function resolveDisabled(item: TItem): boolean {
    if (getItemDisabled) return getItemDisabled(item);
    if (typeof item === 'object' && item !== null) {
      return Boolean((item as MenuObjectOption).disabled);
    }
    return false;
  }

  function resolveChildren(item: TItem): MenuItemType[] | undefined {
    if (getItemChildren) return getItemChildren(item);
    if (typeof item === 'object' && item !== null) {
      return (item as MenuObjectOption).children;
    }
    return undefined;
  }

  function resolveIconForItem(item: TItem): unknown {
    if (getItemIcon) return getItemIcon(item);
    if (typeof item === 'object' && item !== null) {
      return (item as MenuObjectOption).icon;
    }
    return undefined;
  }

  function resolveClass(item: TItem): string | undefined {
    if (getItemClass) return getItemClass(item);
    if (typeof item === 'object' && item !== null) {
      return (item as MenuObjectOption).class;
    }
    return undefined;
  }

  function resolveChecked(item: TItem): boolean | undefined {
    if (getItemChecked) return getItemChecked(item);
    if (typeof item === 'object' && item !== null) {
      return (item as MenuObjectOption).checked;
    }
    return undefined;
  }

  function resolveDetail(item: TItem): string | undefined {
    if (getItemDetail) return getItemDetail(item);
    if (typeof item === 'object' && item !== null) {
      return (item as MenuObjectOption).detail;
    }
    return undefined;
  }

  // ── Array-mode section grouping ────────────────────────────────────────
  // Segmentation is shared with MenuSubmenu (menu.grouping.ts); the markup
  // around a group is shared with the declarative call form, because all
  // three render the same <MenuSection>. Items before the first header render
  // bare, outside any group.
  const arrayGroups = $derived(groupMenuItems<TItem>(items, isSectionItem, isDividerItem));

  const entryKey = (entry: MenuGroupEntry<TItem>) => menuEntryKey(entry, resolveId);

  // ── Check-gutter scope ─────────────────────────────────────────────────
  // The checkmark gutter is reserved for ALL rows of a scope as soon as any
  // item in it carries `checked` — platform menus reserve the gutter across
  // rows, otherwise verb labels sit outdented beside radio labels. Scope: a
  // section group in array mode; the whole top level for items outside any
  // section. Declarative rows resolve menu-wide via `ctx.showCheckGutter`
  // (Menu cannot inspect snippet children ahead of render — they report
  // through item registration instead, see `checkableCount`).
  function entryIsCheckable(entry: MenuGroupEntry<TItem>): boolean {
    if (entry.divider) return false;
    return (
      resolveChecked(entry.item) !== undefined && (resolveChildren(entry.item)?.length ?? 0) === 0
    );
  }
  const anyTopLevelChecked = $derived(
    !childrenMode && arrayGroups.some((group) => group.entries.some(entryIsCheckable))
  );

  // `checked` on a submenu parent is swallowed by design (the parent row is
  // a disclosure, not a radio) — say so once in dev instead of silently.
  $effect(() => {
    if (!import.meta.env?.DEV) return;
    for (const group of arrayGroups) {
      for (const entry of group.entries) {
        if (entry.divider) continue;
        if (
          resolveChecked(entry.item) !== undefined &&
          (resolveChildren(entry.item)?.length ?? 0) > 0
        ) {
          console.warn(
            `[Menu] item "${resolveLabel(entry.item)}" sets both \`checked\` and \`children\` — ` +
              'checked is ignored on a submenu parent row (it is a disclosure, not a radio). ' +
              "Use `detail` to show the submenu's current value."
          );
        }
      }
    }
  });

  // ── Open / close lifecycle ─────────────────────────────────────────────
  // Single mutation point for internally-driven open changes, so
  // `onOpenChange` fires exactly once per transition. Popover-owned dismiss
  // paths (outside click) mutate `open` via `bind:open` instead and report
  // through the forwarded Popover `onOpenChange` — the Escape path can't
  // double-fire because `handlePanelKeydown` calls `preventDefault()`,
  // which Popover's document-level Escape listener honors.
  function setOpen(next: boolean) {
    if (open === next) return;
    open = next;
    onOpenChange?.(next);
  }

  function toggle() {
    if (disabled || loading) return;
    setOpen(!open);
  }

  function dismiss() {
    setOpen(false);
    triggerRef?.focus();
  }

  function onItemActivated(keepOpen?: boolean) {
    if (keepOpen) return;
    dismiss();
  }

  // ── Sub-menu state ─────────────────────────────────────────────────────
  function isSubMenuOpen(id: string) {
    return openSubMenus.has(id);
  }

  function toggleSubMenu(id: string) {
    // Copy + reassign keeps `openSubMenus` reactive.
    const next = new Set(openSubMenus);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    openSubMenus = next;
  }

  // ── Registry (debug + type-ahead hook + gutter census) ────────────────
  // Menu-wide gutter signal for declarative rows: counts mounted items whose
  // registration carries a checked state. register/unregister run inside the
  // MenuItem registration effects, and a compound assignment READS the state
  // it writes — untracked, or every registration effect would adopt
  // `checkableCount` as a dependency and each write would re-run all of them
  // (measured: effect_update_depth_exceeded, the same read+write-in-effect
  // trap as the SvelteMap incident).
  let checkableCount = $state(0);
  function adjustCheckableCount(delta: number) {
    untrack(() => {
      checkableCount += delta;
    });
  }

  function registerItem(item: MenuRegistryItem) {
    const prev = registryBuffer.get(item.id);
    if (prev && import.meta.env?.DEV) {
      console.warn(
        `[Menu] duplicate item id "${item.id}" — the second registration overrides the first.`
      );
    }
    // Keep the census in sync across re-registrations: an id only moves the
    // count when `checked` crosses the defined/undefined boundary.
    const wasCheckable = prev?.checked !== undefined;
    const isCheckable = item.checked !== undefined;
    if (wasCheckable !== isCheckable) adjustCheckableCount(isCheckable ? 1 : -1);
    registryBuffer.set(item.id, item);
  }

  function unregisterItem(id: string) {
    const prev = registryBuffer.get(id);
    if (prev?.checked !== undefined) adjustCheckableCount(-1);
    registryBuffer.delete(id);
  }

  // ── Roving tabindex / arrow-key navigation ────────────────────────────
  //
  // W3C menu pattern: only one item is in the tab order at a time; arrow
  // keys move focus between items; Tab moves focus OUT of the menu.
  // We walk the rendered DOM (works for both array-mode and declarative
  // children, and for nested sub-menus) instead of the registry, so the
  // navigation always reflects what the user actually sees.
  //
  // The role set is ONE constant feeding both the DOM query below and the
  // role comparison in handlePanelKeydown. A row rendered with a role this
  // set misses drops out of arrow navigation silently — focus skips it and
  // nothing errors — which is exactly what happened to `menuitemradio`
  // before the set existed.
  const NAV_ITEM_ROLES = ['menuitem', 'menuitemradio'] as const;
  const NAV_ITEM_SELECTOR = NAV_ITEM_ROLES.map(
    (role) => `[role="${role}"]:not([disabled]):not([aria-disabled="true"])`
  ).join(', ');

  function isNavItem(el: HTMLElement | null): el is HTMLElement {
    const role = el?.getAttribute('role');
    return role != null && (NAV_ITEM_ROLES as readonly string[]).includes(role);
  }

  function getFocusableItems(): HTMLElement[] {
    if (!panelRef) return [];
    return Array.from(panelRef.querySelectorAll<HTMLElement>(NAV_ITEM_SELECTOR));
  }

  function focusNextItem(current: HTMLElement) {
    const items = getFocusableItems();
    if (items.length === 0) return;
    const idx = items.indexOf(current);
    const next = items[(idx + 1) % items.length] ?? items[0];
    next.focus();
  }

  function focusPrevItem(current: HTMLElement) {
    const items = getFocusableItems();
    if (items.length === 0) return;
    const idx = items.indexOf(current);
    const prev = items[(idx - 1 + items.length) % items.length] ?? items[items.length - 1];
    prev.focus();
  }

  function focusFirstItem() {
    const items = getFocusableItems();
    items[0]?.focus();
  }

  function focusLastItem() {
    const items = getFocusableItems();
    items[items.length - 1]?.focus();
  }

  // Sub-menu disclosure state resets on the OPENING edge, not on close:
  // Popover keeps the panel mounted through its exit transition, so a reset
  // on close would visibly collapse open submenus in the exit frame. The
  // non-reactive prev tracker (Popover's own exit pattern) keys the effect
  // on real transitions, and `$effect.pre` clears the state in the same
  // flush that renders the reopened panel — every close path (dismiss,
  // outside click, consumer-driven `open = false`) is followed by exactly
  // such an opening edge, so the menu still reopens fully collapsed.
  let prevOpen = untrack(() => open);
  $effect.pre(() => {
    if (open === prevOpen) return;
    prevOpen = open;
    if (open) openSubMenus = new Set();
  });

  // When the menu opens, move focus into it (W3C menu pattern) so arrow-key
  // navigation works immediately — otherwise focus would stay on the trigger
  // and the panel keydown handler would never receive keys.
  //
  // BUT focusing the first *item* paints a `:focus-visible` ring on it. That
  // ring is desirable for keyboard users (they navigated here) and jarring
  // for pointer users (a tap shouldn't pre-highlight an entry as if selected
  // — the stray green ring report). So we branch on the opener's modality:
  //   • keyboard-open (trigger matches `:focus-visible`) → focus first item
  //   • pointer-open                                     → focus the ring-less
  //     panel container; arrows still work (handlePanelKeydown falls back to
  //     focusFirstItem / focusLastItem when no item is focused yet).
  //
  // We also capture the opener element here so `dismiss()` can restore focus
  // to the trigger on Escape / selection (the previous `triggerRef` was never
  // assigned, so that restore was a silent no-op).
  $effect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    if (opener && opener !== document.body) triggerRef = opener;
    const openedViaKeyboard = opener?.matches?.(':focus-visible') ?? false;
    queueMicrotask(() => {
      if (openedViaKeyboard) focusFirstItem();
      else panelRef?.focus();
    });
  });

  function itemSizeForDepth(_depth: number): 'sm' | 'md' | 'lg' {
    if (itemSizeProp) return itemSizeProp;
    if (size === 'sm' || size === 'md' || size === 'lg') return size;
    if (size === 'xs' || size === '2xs') return 'sm';
    if (size === 'xl') return 'lg';
    return 'md';
  }

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the menu's active variants.
  const variantProps: MenuVariants = $derived({
    open,
    itemSize: itemSizeForDepth(0),
    syncWidth,
    placement,
    chevronAnimation,
    usePortal,
    // Drives the floating panel's corner radius via the `tier` axis on
    // menuVariants — keeps the panel visually attached to its trigger
    // (e.g. pill trigger → rounded-lg panel instead of near-flat
    // rounded-contain).
    tier: effectiveTier
  });

  const styles = $derived(menuVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Menu',
      preset,
      variantProps,
      slotClassesProp,
      menuVariants.config
    )
  );

  const ctx: MenuContext = {
    get rootId() {
      return rootId;
    },
    get size() {
      return itemSizeForDepth(0);
    },
    get intent() {
      return intent;
    },
    get mint() {
      return mint;
    },
    get disabled() {
      return disabled;
    },
    get unstyled() {
      return unstyled;
    },
    get slotClasses() {
      return slotClasses;
    },
    get styles() {
      return styles;
    },
    onItemActivated,
    focusNextItem,
    focusPrevItem,
    focusFirstItem,
    focusLastItem,
    isSubMenuOpen,
    toggleSubMenu,
    registerItem,
    unregisterItem,
    itemSizeForDepth,
    get showCheckGutter() {
      return checkableCount > 0;
    },
    // Mapper-honoring field resolvers, so MenuSubmenu's child pipeline runs
    // through the same functions as the top level (the `getItem*` mappers
    // used to end silently at the submenu boundary). The context is typed on
    // MenuItemType while the mappers take TItem — safe here because submenu
    // children come from `resolveChildren` (i.e. `getItemChildren`), which
    // yields the same shape the mappers were written for.
    resolvers: {
      label: (item) => resolveLabel(item as TItem),
      id: (item, fallbackIndex) => resolveId(item as TItem, fallbackIndex),
      disabled: (item) => resolveDisabled(item as TItem),
      icon: (item) => resolveIconForItem(item as TItem),
      class: (item) => resolveClass(item as TItem),
      checked: (item) => resolveChecked(item as TItem),
      detail: (item) => resolveDetail(item as TItem),
      isSection: isSectionItem,
      isDivider: isDividerItem,
      sectionLabel: resolveSectionLabel
    }
  };
  setMenuContext(ctx);

  // Panel-level keyboard model. Handles arrow-key navigation, Home/End,
  // and Escape — individual MenuItem buttons forward Enter/Space + arrow
  // keys to here via their own onkeydown handler.
  //
  // Every handled key is CONSUMED (`stopPropagation` beside the
  // `preventDefault`): a menu owns its navigation, and because the panel
  // renders in the trigger's DOM (top-layer promotion does not reparent),
  // handled keys would otherwise bubble into whatever hosts the menu.
  // Unhandled keys keep bubbling on purpose. Popover's manual-mode Escape
  // listener explicitly yields to inner widgets that stop or prevent.
  function handlePanelKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const active = document.activeElement as HTMLElement | null;
    // Only treat a real menu item (any role in NAV_ITEM_ROLES) as the
    // navigation anchor. When focus is on the panel container itself
    // (pointer-open), `focusedItem` is null and ArrowDown/Up fall back to
    // focusing the first/last item.
    const focusedItem = isNavItem(target) ? target : isNavItem(active) ? active : null;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        if (focusedItem) focusNextItem(focusedItem);
        else focusFirstItem();
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        if (focusedItem) focusPrevItem(focusedItem);
        else focusLastItem();
        break;
      case 'Home':
        e.preventDefault();
        e.stopPropagation();
        focusFirstItem();
        break;
      case 'End':
        e.preventDefault();
        e.stopPropagation();
        focusLastItem();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        dismiss();
        break;
      case 'Tab':
        // W3C menu pattern: Tab moves focus OUT of the menu — close and let
        // the browser take the next tab stop. Deliberately NOT consumed:
        // the browser needs the un-stopped, un-prevented event to move focus.
        dismiss();
        break;
    }
  }
</script>

<div
  data-menu-root
  data-menu-open={open || undefined}
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  {...restProps}
>
  {#if contextTrigger}
    <!-- Right-click target. `display: contents` drops the wrapper from layout so
         the consumer's own element controls sizing; the contextmenu event still
         bubbles to the handler. -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="contents" oncontextmenu={handleContextMenu}>
      {@render contextTrigger()}
    </div>
    <!-- 0×0 anchor parked at the cursor for Popover to position the menu against. -->
    <div
      bind:this={cursorAnchor}
      aria-hidden="true"
      style:position="fixed"
      style:left="{contextX}px"
      style:top="{contextY}px"
      style:width="0"
      style:height="0"
    ></div>
  {/if}

  {#snippet triggerContent()}
    {#if customTrigger}
      {@render customTrigger(toggle, open, dismiss)}
    {:else}
      <Button
        {unstyled}
        {variant}
        {size}
        {intent}
        tier={effectiveTier}
        {disabled}
        {loading}
        {mint}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            toggle();
          }
        }}
        slotClasses={{ content: 'flex-1 w-full justify-between' }}
        class={unstyled
          ? (slotClasses?.trigger ?? '')
          : styles.trigger({ class: slotClasses?.trigger })}
      >
        <span
          class={unstyled
            ? (slotClasses?.triggerText ?? '')
            : styles.triggerText({ class: slotClasses?.triggerText })}
        >
          {placeholder}
        </span>
        <ChevronDownIcon
          class={unstyled
            ? (slotClasses?.chevron ?? '')
            : styles.chevron({ class: slotClasses?.chevron })}
        />
      </Button>
    {/if}
  {/snippet}

  <!--
    `unstyled` here strips Popover's default surface (background, border,
    shadow, padding, min/max-width) so the Menu's own `content` slot is the
    only painted layer. Without this, the panel renders as two stacked
    surfaces (Popover wrapper + Menu content) and shows a near-empty box
    with double borders.

    The stripped default ALSO carried the enter/exit motion, so the exact
    fragment (`popoverMotion`) is re-applied via `class` — it survives
    Popover's `unstyled` by design and animates the transparent wrapper,
    which fades/scales the Menu chrome inside it. A Menu-level `unstyled`
    strips it again; consumers rebuild on the panel's `data-state`.
  -->
  <Popover
    bind:open
    onOpenChange={(o) => onOpenChange?.(o)}
    placement={placement as import('$lib/utils/floating').Placement}
    {usePortal}
    autoTrigger={false}
    unstyled
    class={unstyled ? undefined : popoverMotion}
    syncMinWidth={contextTrigger ? false : syncWidth}
    offsetDistance={effectiveTier === 'commit' ? 8 : 4}
    trigger={contextTrigger ? undefined : triggerContent}
    triggerElement={contextTrigger ? cursorAnchor : undefined}
  >
    <div
      bind:this={panelRef}
      role="menu"
      tabindex={-1}
      onkeydown={handlePanelKeydown}
      class={[
        unstyled ? (slotClasses?.content ?? '') : styles.content({ class: slotClasses?.content }),
        // Panel is programmatically focused on pointer-open as the ring-less
        // anchor for arrow-key nav — suppress any UA outline on the container.
        'focus:outline-none'
      ]}
    >
      {#if customHeader}
        <div
          class={unstyled
            ? (slotClasses?.header ?? '')
            : styles.header({ class: slotClasses?.header })}
        >
          {@render customHeader()}
        </div>
      {/if}

      <div
        class={unstyled ? (slotClasses?.items ?? '') : styles.items({ class: slotClasses?.items })}
      >
        {#snippet arrayEntry(entry: MenuGroupEntry<TItem>, checkGutter: boolean)}
          {#if entry.divider}
            <MenuDivider />
          {:else}
            {@render arrayRow(entry.item, entry.index, checkGutter)}
          {/if}
        {/snippet}

        {#snippet arrayRow(typedItem: TItem, i: number, checkGutter: boolean)}
          {@const itemId = resolveId(typedItem, i)}
          {@const itemLabel = resolveLabel(typedItem)}
          {@const itemDisabled = resolveDisabled(typedItem)}
          {@const itemChildren = resolveChildren(typedItem)}
          {@const itemIcon = resolveIconForItem(typedItem)}
          {@const opt = typeof typedItem === 'object' ? (typedItem as MenuObjectOption) : null}

          {#if itemChildren && itemChildren.length > 0}
            <MenuSubmenu
              id={itemId}
              label={itemLabel}
              disabled={itemDisabled}
              icon={itemIcon}
              detail={resolveDetail(typedItem)}
              class={resolveClass(typedItem)}
              items={itemChildren}
              {checkGutter}
            />
          {:else if customItem}
            <MenuItemComp
              id={itemId}
              label={itemLabel}
              disabled={itemDisabled}
              icon={itemIcon}
              checked={resolveChecked(typedItem)}
              detail={resolveDetail(typedItem)}
              class={resolveClass(typedItem)}
              onSelect={opt?.onSelect}
              keepOpen={opt?.keepOpen}
              {checkGutter}
            >
              {@render customItem(typedItem)}
            </MenuItemComp>
          {:else}
            <!-- Without a customItem snippet, render MenuItem *without*
                 a children block — passing `{#if customItem}{/if}` would
                 hand MenuItem a truthy-but-empty snippet, and its
                 `{#if children}` short-circuit would then skip the
                 fallback `{label}` render and the item would appear
                 blank. -->
            <MenuItemComp
              id={itemId}
              label={itemLabel}
              disabled={itemDisabled}
              icon={itemIcon}
              checked={resolveChecked(typedItem)}
              detail={resolveDetail(typedItem)}
              class={resolveClass(typedItem)}
              onSelect={opt?.onSelect}
              keepOpen={opt?.keepOpen}
              {checkGutter}
            />
          {/if}
        {/snippet}

        {#if childrenMode}
          {@render children?.()}
        {:else}
          {#each arrayGroups as group (group.key)}
            {#if group.section}
              {@const groupGutter = group.entries.some(entryIsCheckable)}
              <MenuSection label={resolveSectionLabel(group.section)}>
                {#each group.entries as entry (entryKey(entry))}
                  {@render arrayEntry(entry, groupGutter)}
                {/each}
              </MenuSection>
            {:else}
              {#each group.entries as entry (entryKey(entry))}
                {@render arrayEntry(entry, anyTopLevelChecked)}
              {/each}
            {/if}
          {/each}
        {/if}
      </div>

      {#if customFooter}
        <div
          class={unstyled
            ? (slotClasses?.footer ?? '')
            : styles.footer({ class: slotClasses?.footer })}
        >
          {@render customFooter()}
        </div>
      {/if}
    </div>
  </Popover>
</div>
