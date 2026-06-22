<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Dialog, Separator } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { CommandPaletteProps, CommandPaletteItem } from './index';
  import { commandPaletteVariants, type CommandPaletteVariants } from './commandPalette.variants';

  const bt = useBlocksI18n();

  let {
    items,
    placeholder: placeholderProp,
    emptyText: emptyTextProp,
    showFooter = true,
    open = $bindable(false),
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

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const variantProps: CommandPaletteVariants = $derived({ size });

  const styles = $derived(commandPaletteVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'CommandPalette', preset, variantProps, slotClassesProp)
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

  const grouped = $derived.by(() => {
    const groups: { category: string; items: CommandPaletteItem[] }[] = [];
    const seen: Record<string, CommandPaletteItem[]> = {};
    for (const item of filtered) {
      const cat = item.category ?? '';
      if (!seen[cat]) {
        const arr: CommandPaletteItem[] = [];
        seen[cat] = arr;
        groups.push({ category: cat, items: arr });
      }
      seen[cat].push(item);
    }
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

  function getFlatIndex(item: CommandPaletteItem): number {
    return filtered.indexOf(item);
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

<Dialog bind:open size="md" placement="top" class="mt-[15vh]" onClose={() => setOpen(false)}>
  <div
    class={unstyled
      ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
      : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
  >
    <!-- Search input -->
    <div
      class={unstyled
        ? (slotClasses?.inputWrapper ?? '')
        : styles.inputWrapper({ class: slotClasses?.inputWrapper })}
    >
      <svg
        class={unstyled
          ? (slotClasses?.inputIcon ?? '')
          : styles.inputIcon({ class: slotClasses?.inputIcon })}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
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
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
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
          {#each group.items as item (item.id ?? item.label)}
            {@const flatIdx = getFlatIndex(item)}
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
              -->
              {@const itemStateClass = isDisabled
                ? unstyled
                  ? (slotClasses?.itemDisabled ?? '')
                  : styles.itemDisabled({ class: slotClasses?.itemDisabled })
                : isHighlighted
                  ? unstyled
                    ? (slotClasses?.itemHighlighted ?? '')
                    : styles.itemHighlighted({ class: slotClasses?.itemHighlighted })
                  : unstyled
                    ? (slotClasses?.itemDefault ?? '')
                    : styles.itemDefault({ class: slotClasses?.itemDefault })}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                id="command-palette-item-{flatIdx}"
                role="option"
                tabindex="-1"
                aria-selected={isHighlighted}
                aria-disabled={isDisabled}
                data-command-palette-selected={isHighlighted}
                class={[
                  unstyled ? (slotClasses?.item ?? '') : styles.item({ class: slotClasses?.item }),
                  itemStateClass
                ]
                  .filter(Boolean)
                  .join(' ')}
                onclick={() => {
                  if (!isDisabled) selectItem(item);
                }}
                onmouseenter={() => {
                  if (!isDisabled) selectedIndex = flatIdx;
                }}
              >
                {#if item.icon}
                  <svg
                    class={unstyled
                      ? (slotClasses?.itemIcon ?? '')
                      : styles.itemIcon({ class: slotClasses?.itemIcon })}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
                  </svg>
                {/if}
                <span
                  class={unstyled
                    ? (slotClasses?.itemLabel ?? '')
                    : styles.itemLabel({ class: slotClasses?.itemLabel })}>{item.label}</span
                >
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
