<script lang="ts" generics="TItem extends MenuItemType = MenuItemType">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { Button, menuVariants, type MenuVariants } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import { getTierContext } from '$lib/utils/tier-context';
  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  import Popover from '../Popover/Popover.svelte';
  import { setMenuContext, type MenuContext, type MenuRegistryItem } from './menu.context';
  import MenuItemComp from './MenuItem.svelte';
  import MenuSubmenu from './MenuSubmenu.svelte';
  import type { MenuItemType, MenuObjectOption, MenuSectionHeader, MenuProps } from './index';

  const bt = useBlocksI18n();

  let {
    items = [],
    placeholder = bt('menu.placeholder'),
    getItemLabel,
    getItemId,
    getItemDisabled,
    getItemChildren,
    getItemIcon,
    isSection: isSectionMapper,
    getSectionLabel,
    disabled = false,
    loading = false,
    open = $bindable(false),
    id: idProp,
    placement = 'bottom-start',
    syncWidth = true,
    usePortal = true,
    customTrigger,
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

  // ── Open / close lifecycle ─────────────────────────────────────────────
  function toggle() {
    if (disabled || loading) return;
    open = !open;
  }

  function dismiss() {
    open = false;
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

  // ── Registry (debug + type-ahead hook) ────────────────────────────────
  function registerItem(item: MenuRegistryItem) {
    if (registryBuffer.has(item.id) && import.meta.env?.DEV) {
      console.warn(
        `[Menu] duplicate item id "${item.id}" — the second registration overrides the first.`
      );
    }
    registryBuffer.set(item.id, item);
  }

  function unregisterItem(id: string) {
    registryBuffer.delete(id);
  }

  // ── Roving tabindex / arrow-key navigation ────────────────────────────
  //
  // W3C menu pattern: only one item is in the tab order at a time; arrow
  // keys move focus between items; Tab moves focus OUT of the menu.
  // We walk the rendered DOM (works for both array-mode and declarative
  // children, and for nested sub-menus) instead of the registry, so the
  // navigation always reflects what the user actually sees.
  function getFocusableItems(): HTMLElement[] {
    if (!panelRef) return [];
    return Array.from(
      panelRef.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
      )
    );
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
    resolveSlotClasses(blocksConfig, 'Menu', preset, variantProps, slotClassesProp)
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
    itemSizeForDepth
  };
  setMenuContext(ctx);

  // Panel-level keyboard model. Handles arrow-key navigation, Home/End,
  // and Escape — individual MenuItem buttons forward Enter/Space + arrow
  // keys to here via their own onkeydown handler.
  function handlePanelKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const active = document.activeElement as HTMLElement | null;
    // Only treat a real menuitem as the navigation anchor. When focus is on
    // the panel container itself (pointer-open), `focusedItem` is null and
    // ArrowDown/Up fall back to focusing the first/last item.
    const focusedItem =
      target?.getAttribute('role') === 'menuitem'
        ? target
        : active?.getAttribute('role') === 'menuitem'
          ? active
          : null;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (focusedItem) focusNextItem(focusedItem);
        else focusFirstItem();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (focusedItem) focusPrevItem(focusedItem);
        else focusLastItem();
        break;
      case 'Home':
        e.preventDefault();
        focusFirstItem();
        break;
      case 'End':
        e.preventDefault();
        focusLastItem();
        break;
      case 'Escape':
        e.preventDefault();
        dismiss();
        break;
      case 'Tab':
        // W3C menu pattern: Tab moves focus OUT of the menu — close and let
        // the browser take the next tab stop.
        dismiss();
        break;
    }
  }
</script>

<div
  data-menu-root
  data-menu-open={open || undefined}
  class={[unstyled ? slotClasses?.base : styles.base({ class: slotClasses?.base }), className]
    .filter(Boolean)
    .join(' ')}
  {...restProps}
>
  {#snippet triggerContent()}
    {#if customTrigger}
      {@render customTrigger(toggle, open, dismiss)}
    {:else}
      <Button
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
          class={[unstyled ? '' : styles.triggerText(), slotClasses?.triggerText]
            .filter(Boolean)
            .join(' ')}
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
  -->
  <Popover
    bind:open
    placement={placement as import('$lib/utils/floating').Placement}
    {usePortal}
    autoTrigger={false}
    unstyled
    syncMinWidth={syncWidth}
    offsetDistance={effectiveTier === 'commit' ? 8 : 4}
    trigger={triggerContent}
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
        {#if childrenMode}
          {@render children?.()}
        {:else}
          {#each items as item, i (resolveId(item as TItem, i))}
            {#if isSectionItem(item)}
              {@const section = item as MenuSectionHeader}
              <div
                role="presentation"
                class={unstyled
                  ? (slotClasses?.section ?? '')
                  : styles.section({ class: slotClasses?.section })}
              >
                {getSectionLabel ? getSectionLabel(section) : section.label}
              </div>
            {:else}
              {@const typedItem = item as TItem}
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
                  items={itemChildren}
                />
              {:else if customItem}
                <MenuItemComp
                  id={itemId}
                  label={itemLabel}
                  disabled={itemDisabled}
                  icon={itemIcon}
                  onSelect={opt?.onSelect}
                  keepOpen={opt?.keepOpen}
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
                  onSelect={opt?.onSelect}
                  keepOpen={opt?.keepOpen}
                />
              {/if}
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
