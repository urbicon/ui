<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import SearchIconDefault from '$lib/icons/SearchIcon.svelte';
  import { Dialog, Separator } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { CommandPaletteProps, CommandPaletteItem } from './index';
  import { commandPaletteVariants, type CommandPaletteVariants } from './commandPalette.variants';

  const bt = useBlocksI18n();

  const SearchIcon = resolveIcon('search', SearchIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  let {
    items,
    placeholder: placeholderProp,
    emptyText: emptyTextProp,
    showFooter = true,
    open = $bindable(false),
    query = $bindable(''),
    shortcut = 'mod+k',
    filter,
    onSelect,
    onOpenChange,
    customItem,
    customEmpty,
    size = 'md',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset
  }: CommandPaletteProps = $props();

  const placeholder = $derived(placeholderProp ?? bt('commandPalette.search', {}));
  const emptyText = $derived(emptyTextProp ?? bt('commandPalette.noResults', {}));

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const variantProps: CommandPaletteVariants = $derived({ size });

  const styles = $derived(commandPaletteVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'CommandPalette',
      preset,
      variantProps,
      slotClassesProp,
      commandPaletteVariants.config
    )
  );

  const defaultFilter = (item: CommandPaletteItem, q: string) => {
    const lower = q.toLowerCase();
    return (
      item.label.toLowerCase().includes(lower) ||
      (item.category?.toLowerCase().includes(lower) ?? false)
    );
  };

  const filtered = $derived.by(() => {
    if (!query) return items;
    const fn = filter ?? defaultFilter;
    return items.filter((item) => fn(item, query));
  });

  /**
   * Entries carry their index into `filtered` so the markup does not have to
   * look it up per row — that was an `indexOf` per item, i.e. quadratic in the
   * item count on every render.
   */
  type GroupEntry = { item: CommandPaletteItem; flatIdx: number };

  const grouped = $derived.by(() => {
    const groups: { category: string; entries: GroupEntry[] }[] = [];
    const seen: Record<string, GroupEntry[]> = {};
    filtered.forEach((item, flatIdx) => {
      const cat = item.category ?? '';
      if (!seen[cat]) {
        const arr: GroupEntry[] = [];
        seen[cat] = arr;
        groups.push({ category: cat, entries: arr });
      }
      seen[cat].push({ item, flatIdx });
    });
    return groups;
  });

  $effect(() => {
    void query;
    selectedIndex = 0;
  });

  $effect(() => {
    if (open) {
      query = '';
      selectedIndex = 0;
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  function setOpen(value: boolean) {
    open = value;
    onOpenChange?.(value);
  }

  function selectItem(item: CommandPaletteItem) {
    if (item.disabled) return;
    setOpen(false);
    query = '';
    onSelect?.(item);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
      scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      scrollSelectedIntoView();
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      selectItem(filtered[selectedIndex]);
    }
  }

  function scrollSelectedIntoView() {
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-command-palette-selected="true"]');
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (!shortcut) return;
    const isMod = e.metaKey || e.ctrlKey;
    if (shortcut === 'mod+k' && isMod && e.key === 'k') {
      e.preventDefault();
      setOpen(!open);
    }
  }

  export function toggle() {
    setOpen(!open);
  }

  export function show() {
    setOpen(true);
  }

  export function hide() {
    setOpen(false);
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<Dialog
  {unstyled}
  bind:open
  size="md"
  placement="top"
  class="mt-[15vh]"
  onClose={() => setOpen(false)}
>
  <div
    class={unstyled
      ? resolveClassChain(slotClasses?.wrapper, className)
      : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
  >
    <!-- Search input -->
    <div
      class={unstyled
        ? (slotClasses?.inputWrapper ?? '')
        : styles.inputWrapper({ class: slotClasses?.inputWrapper })}
    >
      <SearchIcon
        class={unstyled
          ? (slotClasses?.inputIcon ?? '')
          : styles.inputIcon({ class: slotClasses?.inputIcon })}
      />
      <input
        bind:this={inputEl}
        type="text"
        bind:value={query}
        onkeydown={handleKeydown}
        {placeholder}
        class={unstyled ? (slotClasses?.input ?? '') : styles.input({ class: slotClasses?.input })}
        role="combobox"
        aria-expanded={filtered.length > 0}
        aria-controls="command-palette-list"
        aria-activedescendant={filtered[selectedIndex]
          ? `command-palette-item-${selectedIndex}`
          : undefined}
        autocomplete="off"
      />
      {#if query}
        <button
          class={unstyled
            ? (slotClasses?.clearButton ?? '')
            : styles.clearButton({ class: slotClasses?.clearButton })}
          aria-label={bt('accessibility.clearSearch')}
          onclick={() => {
            query = '';
            inputEl?.focus();
          }}
        >
          <CloseIcon class="h-4 w-4" />
        </button>
      {/if}
    </div>

    <!-- Results -->
    <div
      id="command-palette-list"
      role="listbox"
      class={unstyled ? (slotClasses?.list ?? '') : styles.list({ class: slotClasses?.list })}
    >
      {#if filtered.length === 0}
        {#if customEmpty}
          {@render customEmpty(query)}
        {:else}
          <div
            class={unstyled
              ? (slotClasses?.empty ?? '')
              : styles.empty({ class: slotClasses?.empty })}
          >
            {emptyText}{#if query}&nbsp;"{query}"{/if}
          </div>
        {/if}
      {:else}
        {#each grouped as group, groupIdx (group.category)}
          {#if groupIdx > 0}
            <Separator
              class={unstyled
                ? (slotClasses?.separator ?? '')
                : styles.separator({ class: slotClasses?.separator })}
            />
          {/if}
          {#if group.category}
            <div
              class={unstyled
                ? (slotClasses?.groupLabel ?? '')
                : styles.groupLabel({ class: slotClasses?.groupLabel })}
              role="presentation"
            >
              {group.category}
            </div>
          {/if}
          {#each group.entries as { item, flatIdx } (item.id ?? item.label)}
            {@const isHighlighted = flatIdx === selectedIndex}
            {@const isDisabled = item.disabled ?? false}
            {#if customItem}
              {@render customItem(item, isHighlighted, flatIdx)}
            {:else}
              <!--
                role="option" requires a non-button host so screenreaders
                announce the item as an option rather than a button. Activation
                is driven through the input's aria-activedescendant pattern
                (Enter/Space handled in handleKeydown) plus pointer clicks
                here. tabindex="-1" keeps the items out of the tab sequence.

                The row's class is four sources with both consumer rungs last,
                folded rather than joined. Joining two finished folds instead
                puts the library's state class after the consumer's `item`
                entry: measured on that form, 24 of 24 colliding pairs across
                `text-color`, `bg-color`, `cursor`, `opacity` and
                `hover:bg-color` went to the library. The price is that a
                colliding `item` entry now removes the state class — which is
                what the `slotClasses` JSDoc has to keep saying.
              -->
              {@const stateSlot = isDisabled
                ? 'itemDisabled'
                : isHighlighted
                  ? 'itemHighlighted'
                  : 'itemDefault'}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                id="command-palette-item-{flatIdx}"
                role="option"
                tabindex="-1"
                aria-selected={isHighlighted}
                aria-disabled={isDisabled}
                data-command-palette-selected={isHighlighted}
                class={resolveClassChain(
                  unstyled ? '' : styles.item(),
                  unstyled ? '' : styles[stateSlot](),
                  slotClasses?.item,
                  slotClasses?.[stateSlot]
                )}
                onclick={() => {
                  if (!isDisabled) selectItem(item);
                }}
                onmouseenter={() => {
                  if (!isDisabled) selectedIndex = flatIdx;
                }}
              >
                {#if item.icon}
                  {@const ItemIcon = item.icon}
                  <ItemIcon
                    class={unstyled
                      ? (slotClasses?.itemIcon ?? '')
                      : styles.itemIcon({ class: slotClasses?.itemIcon })}
                  />
                {/if}
                <span
                  class={unstyled
                    ? (slotClasses?.itemText ?? '')
                    : styles.itemText({ class: slotClasses?.itemText })}
                >
                  <span
                    class={unstyled
                      ? (slotClasses?.itemLabel ?? '')
                      : styles.itemLabel({ class: slotClasses?.itemLabel })}>{item.label}</span
                  >
                  {#if item.excerpt}
                    <span
                      class={unstyled
                        ? (slotClasses?.itemExcerpt ?? '')
                        : styles.itemExcerpt({ class: slotClasses?.itemExcerpt })}
                      >{item.excerpt}</span
                    >
                  {/if}
                </span>
                {#if item.shortcut}
                  <kbd
                    class={unstyled
                      ? (slotClasses?.itemShortcut ?? '')
                      : styles.itemShortcut({ class: slotClasses?.itemShortcut })}
                    >{item.shortcut}</kbd
                  >
                {/if}
              </div>
            {/if}
          {/each}
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    {#if showFooter}
      <div
        class={unstyled
          ? (slotClasses?.footer ?? '')
          : styles.footer({ class: slotClasses?.footer })}
      >
        <span
          class={unstyled
            ? (slotClasses?.footerHint ?? '')
            : styles.footerHint({ class: slotClasses?.footerHint })}
        >
          <kbd class={unstyled ? (slotClasses?.kbd ?? '') : styles.kbd({ class: slotClasses?.kbd })}
            >&#8593;&#8595;</kbd
          >
          {bt('commandPalette.hints.navigate', {})}
        </span>
        <span
          class={unstyled
            ? (slotClasses?.footerHint ?? '')
            : styles.footerHint({ class: slotClasses?.footerHint })}
        >
          <kbd class={unstyled ? (slotClasses?.kbd ?? '') : styles.kbd({ class: slotClasses?.kbd })}
            >&#8629;</kbd
          >
          {bt('commandPalette.hints.select', {})}
        </span>
        <span
          class={unstyled
            ? (slotClasses?.footerHint ?? '')
            : styles.footerHint({ class: slotClasses?.footerHint })}
        >
          <kbd class={unstyled ? (slotClasses?.kbd ?? '') : styles.kbd({ class: slotClasses?.kbd })}
            >esc</kbd
          >
          {bt('commandPalette.hints.close', {})}
        </span>
      </div>
    {/if}
  </div>
</Dialog>
