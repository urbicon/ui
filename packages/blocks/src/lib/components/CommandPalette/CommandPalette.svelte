<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Dialog, Separator } from '$lib/primitives';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { CommandPaletteProps, CommandPaletteItem } from './index';
  import { commandPaletteVariants } from './commandPalette.variants';

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
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.CommandPalette?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'CommandPalette', preset),
      slotClassesProp
    )
  );

  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const styles = $derived(unstyled ? undefined : commandPaletteVariants({ size }));

  function slot(name: keyof NonNullable<typeof styles>) {
    const base = styles?.[name]?.() ?? '';
    const override = slotClasses?.[name as keyof typeof slotClasses] ?? '';
    return override ? `${base} ${override}` : base;
  }

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
  <div class="{slot('wrapper')} {className}">
    <!-- Search input -->
    <div class={slot('inputWrapper')}>
      <svg
        class={slot('inputIcon')}
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
        class={slot('input')}
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
          class={slot('clearButton')}
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
    <div id="command-palette-list" role="listbox" class={slot('list')}>
      {#if filtered.length === 0}
        {#if customEmpty}
          {@render customEmpty(query)}
        {:else}
          <div class={slot('empty')}>
            {emptyText}{#if query}&nbsp;"{query}"{/if}
          </div>
        {/if}
      {:else}
        {#each grouped as group, groupIdx (group.category)}
          {#if groupIdx > 0}
            <Separator class={slot('separator')} />
          {/if}
          {#if group.category}
            <div class={slot('groupLabel')} role="presentation">
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
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                id="command-palette-item-{flatIdx}"
                role="option"
                tabindex="-1"
                aria-selected={isHighlighted}
                aria-disabled={isDisabled}
                data-command-palette-selected={isHighlighted}
                class="{slot('item')} {isDisabled
                  ? slot('itemDisabled')
                  : isHighlighted
                    ? slot('itemHighlighted')
                    : slot('itemDefault')}"
                onclick={() => {
                  if (!isDisabled) selectItem(item);
                }}
                onmouseenter={() => {
                  if (!isDisabled) selectedIndex = flatIdx;
                }}
              >
                {#if item.icon}
                  <svg
                    class={slot('itemIcon')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
                  </svg>
                {/if}
                <span class={slot('itemLabel')}>{item.label}</span>
                {#if item.shortcut}
                  <kbd class={slot('itemShortcut')}>{item.shortcut}</kbd>
                {/if}
              </div>
            {/if}
          {/each}
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    {#if showFooter}
      <div class={slot('footer')}>
        <span class={slot('footerHint')}>
          <kbd class={slot('kbd')}>&#8593;&#8595;</kbd>
          {bt('commandPalette.hints.navigate', {})}
        </span>
        <span class={slot('footerHint')}>
          <kbd class={slot('kbd')}>&#8629;</kbd>
          {bt('commandPalette.hints.select', {})}
        </span>
        <span class={slot('footerHint')}>
          <kbd class={slot('kbd')}>esc</kbd>
          {bt('commandPalette.hints.close', {})}
        </span>
      </div>
    {/if}
  </div>
</Dialog>
