<script lang="ts">
  import { untrack } from 'svelte';
  import { useBlocksI18n } from '#lib';
  import { resolveIcon } from '#lib/icons/index.js';
  import CloseIconDefault from '#lib/icons/CloseIcon.svelte';
  import SearchIconDefault from '#lib/icons/SearchIcon.svelte';
  import { eachKeys } from '#lib/internal/each-keys.js';
  import { Dialog, Kbd, Separator } from '#lib/primitives/index.js';
  import { getBlocksConfig, resolveSlotClasses, useThemeProps } from '#lib/provider/index.js';
  import { edgeEnabledIndex, nextEnabledIndex } from '#lib/utils/index.js';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import type { CommandPaletteHint, CommandPaletteItem, CommandPaletteProps } from './index';
  import { commandPaletteVariants, type CommandPaletteVariants } from './commandPalette.variants';

  const bt = useBlocksI18n();

  const SearchIcon = resolveIcon('search', SearchIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);

  const theme = useThemeProps('CommandPalette', () => preset);

  let {
    preset,
    id: idProp,
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
    onClosed,
    customItem,
    customEmpty,
    footer,
    size = theme.size ?? 'md',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    ...restProps
  }: CommandPaletteProps = $props();

  const placeholder = $derived(placeholderProp ?? bt('commandPalette.search', {}));
  const emptyText = $derived(emptyTextProp ?? bt('commandPalette.noResults', {}));

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // `id` goes to the dialog. The list and its rows derive theirs from it, or
  // from `$props.id()` without one, so the input's ARIA references resolve
  // inside this palette when a second one is on the page.
  const propsId = $props.id();
  const baseId = $derived(idProp ?? `command-palette-${propsId}`);
  const listId = $derived(`${baseId}-list`);
  const itemId = (index: number) => `${baseId}-item-${index}`;

  let selectedIndex = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();
  let listEl: HTMLDivElement | undefined = $state();

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

  /**
   * The row keys, by `flatIdx`. An item keys by its `id`, or by its `label`
   * without one, so its row stays with it while the list filters; the keys
   * stay distinct when ids or labels repeat, or an id spells a label.
   */
  const rowKeys = $derived(
    eachKeys(filtered, (item) => (item.id === undefined ? `label:${item.label}` : `id:${item.id}`))
  );

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

  const isInfo = (item: CommandPaletteItem) => item.kind === 'info';

  /** A row the highlight never rests on: a disabled command, or no command at all. */
  const isSkipped = (index: number) => {
    const item = filtered[index];
    return item === undefined || isInfo(item) || (item.disabled ?? false);
  };

  /**
   * Whether any row is an option. An `info` row is text, so a list of info
   * rows only — like the empty state — is no listbox: a `role="listbox"`
   * without an option in it fails axe's `aria-required-children`.
   */
  const hasOptions = $derived(filtered.some((item) => !isInfo(item)));

  /**
   * The highlighted row, derived rather than stored: `selectedIndex` is only
   * where the user last walked, and it counts while it is an enabled action of
   * the CURRENT `filtered`. Otherwise — results arrived after opening, the row
   * under it turned disabled or info, the list shrank past it — the first
   * enabled action holds the highlight, and -1 when there is none: no row
   * selected, no active descendant, Enter with nothing to select. A stored
   * highlight would need an effect for every way the list can change under it.
   */
  const highlightIndex = $derived(
    selectedIndex >= 0 && selectedIndex < filtered.length && !isSkipped(selectedIndex)
      ? selectedIndex
      : edgeEnabledIndex(filtered.length, 1, isSkipped)
  );

  // A new query and an opening move the highlight without a key, so they bring
  // it into view too; untracked, or a change of `items` would reset the walk.
  $effect(() => {
    void query;
    selectedIndex = 0;
    untrack(() => scrollToHighlight(highlightIndex));
  });

  $effect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputEl?.focus());
    untrack(() => scrollToHighlight(highlightIndex));
  });

  /**
   * The reset runs where the close has finished, not where it starts: a close
   * that is vetoed, interrupted by a reopen or cut short by a destroy never
   * gets here, and the query a consumer sets while the palette is closed is
   * what the next open shows. Ahead of the consumer's `onClosed`, so a query
   * written there survives. `bind:query` sees one write, and none when the
   * query is already empty — which takes the guard: assigning `''` over `''`
   * still calls a function binding's setter.
   */
  function handleClosed() {
    if (query !== '') query = '';
    selectedIndex = 0;
    onClosed?.();
  }

  function setOpen(value: boolean) {
    open = value;
    onOpenChange?.(value);
  }

  function selectItem(item: CommandPaletteItem) {
    if (isInfo(item) || item.disabled) return;
    setOpen(false);
    onSelect?.(item);
  }

  const hints: CommandPaletteHint[] = $derived([
    {
      id: 'navigate',
      keys: bt('commandPalette.keys.navigate', {}),
      label: bt('commandPalette.hints.navigate', {})
    },
    {
      id: 'select',
      keys: bt('commandPalette.keys.select', {}),
      label: bt('commandPalette.hints.select', {})
    },
    {
      id: 'close',
      keys: bt('commandPalette.keys.close', {}),
      label: bt('commandPalette.hints.close', {})
    }
  ]);

  // Neither a disabled row nor an info row is a stop: the arrow keys step over
  // both and wrap at both ends, Home/End land on the enabled edges (the shared
  // roving helpers, as in Tab / ButtonGroup / SegmentGroup). Home/End move the
  // highlight, not the caret — the list is always open behind this input.
  function handleKeydown(e: KeyboardEvent) {
    let next: number;
    switch (e.key) {
      case 'ArrowDown':
        next = nextEnabledIndex(filtered.length, highlightIndex, 1, isSkipped);
        break;
      case 'ArrowUp':
        next = nextEnabledIndex(filtered.length, highlightIndex, -1, isSkipped);
        break;
      case 'Home':
        next = edgeEnabledIndex(filtered.length, 1, isSkipped);
        break;
      case 'End':
        next = edgeEnabledIndex(filtered.length, -1, isSkipped);
        break;
      case 'Enter': {
        const item = filtered[highlightIndex];
        if (!item) return;
        e.preventDefault();
        selectItem(item);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    if (next >= 0 && next !== highlightIndex) {
      selectedIndex = next;
      scrollToHighlight(next);
    }
  }

  /**
   * At the first and the last command the list scrolls to its own edge before
   * the row's `nearest`: `nearest` alone stops at the command and leaves the
   * info rows, the group label or the disabled rows beyond it out of view, and
   * the keyboard, held in the input, has no other way to bring them in. The
   * `nearest` after it keeps the command in view when those rows are taller
   * than the list.
   */
  function scrollToHighlight(index: number) {
    const first = edgeEnabledIndex(filtered.length, 1, isSkipped);
    const last = edgeEnabledIndex(filtered.length, -1, isSkipped);
    requestAnimationFrame(() => {
      if (!listEl) return;
      if (index === first) listEl.scrollTop = 0;
      else if (index === last) listEl.scrollTop = listEl.scrollHeight;
      const row = listEl.querySelector('[data-command-palette-selected="true"]');
      row?.scrollIntoView({ block: 'nearest' });
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

{#snippet rowContent(
  item: CommandPaletteItem,
  isHighlighted: boolean,
  flatIdx: number,
  select: () => void
)}
  {#if customItem}
    {@render customItem(item, isHighlighted, flatIdx, select)}
  {:else}
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
            : styles.itemExcerpt({ class: slotClasses?.itemExcerpt })}>{item.excerpt}</span
        >
      {/if}
    </span>
    {#if item.shortcut}
      <kbd
        class={unstyled
          ? (slotClasses?.itemShortcut ?? '')
          : styles.itemShortcut({ class: slotClasses?.itemShortcut })}>{item.shortcut}</kbd
      >
    {/if}
  {/if}
{/snippet}

<Dialog
  {...restProps}
  id={idProp}
  {unstyled}
  bind:open
  size="md"
  placement="top"
  class="mt-[15vh]"
  onClose={() => setOpen(false)}
  onClosed={handleClosed}
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
        aria-expanded={hasOptions}
        aria-controls={listId}
        aria-activedescendant={filtered[highlightIndex] ? itemId(highlightIndex) : undefined}
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
      bind:this={listEl}
      id={listId}
      role={hasOptions ? 'listbox' : undefined}
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
          {#each group.entries as { item, flatIdx } (rowKeys[flatIdx])}
            {@const isHighlighted = flatIdx === highlightIndex}
            {@const isDisabled = item.disabled ?? false}
            <!--
              role="option" requires a non-button host so screenreaders
              announce the item as an option rather than a button. Activation
              is driven through the input's aria-activedescendant pattern
              (Enter/Space handled in handleKeydown) plus pointer clicks
              here. tabindex="-1" keeps the items out of the tab sequence.

              The container is the component's in both branches: its id is what
              `aria-activedescendant` names and its data attribute is what
              `scrollToHighlight` queries, so `customItem` renders the
              row's visible contents inside it and draws nothing focusable —
              a control here would be nested-interactive on role="option" and
              would select a second time when its click reaches this handler.

              An info row is no option: under `role="presentation"` its text
              sits in the listbox as plain text (Chromium's accessibility
              tree), where an option with `aria-disabled` is exposed as a
              disabled option — an unavailable command. It takes no click and
              no hover, and needs no id.

              The row's class is four sources with both consumer rungs last,
              folded rather than joined. Joining two finished folds instead
              puts the library's state class after the consumer's `item`
              entry: measured on that form, 24 of 24 colliding pairs across
              `text-color`, `bg-color`, `cursor`, `opacity` and
              `hover:bg-color` went to the library. The price is that a
              colliding `item` entry now removes the state class — which is
              what the `slotClasses` JSDoc has to keep saying.
            -->
            {@const stateSlot = isInfo(item)
              ? 'itemInfo'
              : isDisabled
                ? 'itemDisabled'
                : isHighlighted
                  ? 'itemHighlighted'
                  : 'itemDefault'}
            {@const rowClass = resolveClassChain(
              unstyled ? '' : styles.item(),
              unstyled ? '' : styles[stateSlot](),
              slotClasses?.item,
              slotClasses?.[stateSlot]
            )}
            {@const select = () => selectItem(item)}
            {#if isInfo(item)}
              <div role="presentation" class={rowClass}>
                {@render rowContent(item, false, flatIdx, select)}
              </div>
            {:else}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                id={itemId(flatIdx)}
                role="option"
                tabindex="-1"
                aria-selected={isHighlighted}
                aria-disabled={isDisabled}
                data-command-palette-selected={isHighlighted}
                class={rowClass}
                onclick={select}
                onmouseenter={() => {
                  if (!isDisabled) selectedIndex = flatIdx;
                }}
              >
                {@render rowContent(item, isHighlighted, flatIdx, select)}
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
        {#if footer}
          {@render footer({ hints })}
        {:else}
          {#each hints as hint (hint.id)}
            <span
              class={unstyled
                ? (slotClasses?.footerHint ?? '')
                : styles.footerHint({ class: slotClasses?.footerHint })}
            >
              <Kbd
                keys={hint.keys}
                size="sm"
                {unstyled}
                class={unstyled
                  ? (slotClasses?.kbd ?? '')
                  : styles.kbd({ class: slotClasses?.kbd })}
              />
              {hint.label}
            </span>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</Dialog>
