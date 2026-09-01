<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { useBlocksI18n } from '$lib/i18n';
  import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '$lib/icons';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { getGuideContext } from './guide.context';
  import { setGuidePanelContext } from './guide-panel.context';
  import { filterArticles, groupArticles, hasNamedGroups } from './guide-panel.articles';
  import { guidePanelVariants, type GuidePanelVariants } from './guide.variants';
  import type { GuidePanelProps } from './index';

  const bt = useBlocksI18n();

  let {
    id: idProp,
    placement = 'right',
    size = 'md',
    title,
    searchable = false,
    closeOnEscape = true,
    footer,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuidePanelProps = $props();

  const guide = getGuideContext();
  const propsId = $props.id();
  const panelId = $derived(idProp ?? `guide-panel-${propsId}`);
  let panelEl: HTMLElement | undefined = $state();

  // Publish the panel's id so GuideMarkers can wire `aria-controls` (Direction A).
  // Re-registers if the id changes; releases it on unmount.
  $effect(() => guide?.registerPanel(panelId));

  if (import.meta.env?.DEV && !guide) {
    console.warn(
      '[Guide] <GuidePanel> is used without a <GuideProvider> ancestor — it will not render.'
    );
  }

  // Article registry feeding the list view. GuideArticle children register here.
  // untrack mirrors GuideController.registerTarget: writes happen from a child's
  // $effect, so untracking guards the list derived against effect_update_depth_exceeded.
  // SvelteMap preserves insertion order, so the index follows definition order.
  const articleMap = new SvelteMap<string, { title: string; group?: string }>();
  setGuidePanelContext({
    registerArticle(id, articleTitle, group) {
      untrack(() => articleMap.set(id, { title: articleTitle, group }));
      return () => untrack(() => articleMap.delete(id));
    },
    // Tracked read (no untrack): a GuideRef's reactive resolvable re-runs as
    // articles register/unregister.
    hasArticle: (id) => articleMap.has(id)
  });

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuidePanelVariants = $derived({ placement, size });
  const styles = $derived(guidePanelVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'GuidePanel',
      preset,
      variantProps,
      slotClassesProp,
      guidePanelVariants.config
    )
  );

  const open = $derived(guide?.panelOpen ?? false);
  const activeArticle = $derived(guide?.activeArticle ?? null);
  const articles = $derived(
    // Normalize a blank/whitespace `group` to `undefined` so it collapses into the
    // ungrouped block instead of rendering an empty (padded) section header.
    [...articleMap].map(([id, a]) => ({ id, title: a.title, group: a.group?.trim() || undefined }))
  );
  const headerTitle = $derived(
    (activeArticle ? articleMap.get(activeArticle)?.title : undefined) ??
      title ??
      bt('guide.openHelp', {})
  );

  // Optional title filter (#26). Grouping below runs on the filtered set, so a
  // search narrows the index while keeping non-empty sections' headers.
  let searchQuery = $state('');
  const filteredArticles = $derived(searchable ? filterArticles(articles, searchQuery) : articles);
  const isFiltering = $derived(searchable && searchQuery.trim().length > 0);

  // Reset the filter when the panel fully closes (#26 follow-up) so a reopen starts from the
  // complete index. A "back to list" *within* an open panel intentionally keeps the query —
  // that in-session narrowing is expected; only a full close/reopen is a fresh start.
  $effect(() => {
    if (open) return;
    untrack(() => {
      if (searchQuery) searchQuery = '';
    });
  });

  // Group the index into sections (first-occurrence order; ungrouped articles in
  // one headerless block). When no article sets a group, this is a flat list.
  const sections = $derived(groupArticles(filteredArticles));
  const hasGroups = $derived(hasNamedGroups(sections));

  const panelTransform = $derived(
    open ? 'translateX(0)' : placement === 'left' ? 'translateX(-100%)' : 'translateX(100%)'
  );

  // Non-modal → no focus trap. But closing the panel from *within* it (close button / Escape)
  // makes it `inert`, which would strand focus on <body>. Capture whatever opened the panel
  // (e.g. a GuideMarker) so `close()` can hand focus back — mirrors Dialog/Drawer/Popover.
  // A programmatic `closePanel()` bypasses `close()`, leaving that focus to the consumer.
  let opener: HTMLElement | null = null;
  $effect(() => {
    if (open)
      opener = untrack(() =>
        typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
      );
  });

  // A11y: switching articles — via a list item, the back button, or a GuideRef inside the body —
  // unmounts the currently focused control, dropping focus to <body>. Redirect it to the panel
  // heading (a stable anchor, re-announced with the new title on every switch). Only reclaim the
  // focus the unmount stranded on <body>; never pull focus the user/consumer moved elsewhere.
  let titleEl: HTMLHeadingElement | undefined = $state();
  // svelte-ignore state_referenced_locally
  let previousArticle: string | null = activeArticle;
  $effect(() => {
    const current = activeArticle;
    const isOpen = open;
    if (current === previousArticle) return;
    previousArticle = current;
    if (!isOpen) return;
    let cancelled = false;
    tick().then(() => {
      if (cancelled || typeof document === 'undefined') return;
      // Only the unmount-stranded case lands focus on <body>; anything else means the user or
      // consumer is focused elsewhere (e.g. a still-focused GuideMarker) — leave it be.
      if (document.activeElement !== document.body) return;
      titleEl?.focus();
    });
    return () => {
      cancelled = true;
    };
  });

  // DEV-only: warn when the active article has no matching <GuideArticle> (typo in a
  // GuideMarker's `article`, or the article isn't mounted) — otherwise the panel just
  // shows an empty body with no signal. Deferred past the current flush via `tick()` so a
  // sibling <GuideArticle> registering in the same render isn't a false positive.
  $effect(() => {
    if (!import.meta.env?.DEV) return;
    const id = activeArticle;
    if (!id) return;
    let cancelled = false;
    tick().then(() => {
      if (!cancelled && guide?.activeArticle === id && !articleMap.has(id)) {
        console.warn(
          `[Guide] panel shows article "${id}", but no <GuideArticle id="${id}"> is registered — the body will be empty.`
        );
      }
    });
    return () => {
      cancelled = true;
    };
  });

  function close() {
    // Restore focus *before* the reactive `inert` lands (closePanel only flips state; the DOM
    // update is batched), and only when focus is still inside the panel — i.e. a close from
    // within (close button / Escape), the case where focus would otherwise be lost to <body>.
    const returnTo = opener;
    const fromInside = !!panelEl && panelEl.contains(document.activeElement);
    guide?.closePanel();
    if (fromInside && returnTo) returnTo.focus?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Non-modal: only claim Escape when focus is actually inside the panel, so an open
    // Dialog/Combobox in the foreground keeps priority over the help panel.
    if (
      e.key === 'Escape' &&
      closeOnEscape &&
      open &&
      !e.defaultPrevented &&
      panelEl?.contains(document.activeElement)
    ) {
      e.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if guide}
  <aside
    bind:this={panelEl}
    id={panelId}
    class={unstyled
      ? resolveClassChain(slotClasses?.panel, className)
      : styles.panel({ class: [slotClasses?.panel, className] })}
    style:--_guide-panel-transform={panelTransform}
    data-state={open ? 'open' : 'closed'}
    data-placement={placement}
    inert={!open || undefined}
    aria-labelledby={`${panelId}-title`}
    {...restProps}
  >
    <header
      class={unstyled ? (slotClasses?.header ?? '') : styles.header({ class: slotClasses?.header })}
    >
      {#if activeArticle}
        <button
          type="button"
          class={unstyled
            ? (slotClasses?.backButton ?? '')
            : styles.backButton({ class: slotClasses?.backButton })}
          onclick={() => guide.setArticle(null)}
        >
          <ChevronLeftIcon class="h-4 w-4" />
          {bt('guide.backToList', {})}
        </button>
      {/if}
      <h2
        bind:this={titleEl}
        id={`${panelId}-title`}
        tabindex="-1"
        class={unstyled ? (slotClasses?.title ?? '') : styles.title({ class: slotClasses?.title })}
      >
        {headerTitle}
      </h2>
      <button
        type="button"
        class={unstyled
          ? (slotClasses?.closeButton ?? '')
          : styles.closeButton({ class: slotClasses?.closeButton })}
        onclick={close}
        aria-label={bt('guide.close', {})}
      >
        <CloseIcon class="h-5 w-5" />
      </button>
    </header>

    <div class={unstyled ? (slotClasses?.body ?? '') : styles.body({ class: slotClasses?.body })}>
      {#snippet articleListItem(article: { id: string; title: string })}
        <li>
          <button
            type="button"
            class={unstyled
              ? (slotClasses?.listItem ?? '')
              : styles.listItem({ class: slotClasses?.listItem })}
            onclick={() => guide?.setArticle(article.id)}
          >
            <span class="flex-1">{article.title}</span>
            <ChevronRightIcon class="h-4 w-4 opacity-50" />
          </button>
        </li>
      {/snippet}
      {#if !activeArticle}
        {#if searchable}
          <input
            type="search"
            class={unstyled
              ? (slotClasses?.searchInput ?? '')
              : styles.searchInput({ class: slotClasses?.searchInput })}
            placeholder={bt('guide.filterPlaceholder', {})}
            aria-label={bt('guide.filterPlaceholder', {})}
            bind:value={searchQuery}
          />
          <!-- Persistent polite announcer: present in the a11y tree before the result
               set empties, so a filter narrowing to zero is reliably announced (a region
               inserted together with its text is dropped by some screen readers). The
               visible empty-state below carries no role, to avoid a duplicate region. -->
          <p aria-live="polite" class="sr-only">
            {#if isFiltering && filteredArticles.length === 0}{bt('guide.noResults', {})}{/if}
          </p>
        {/if}
        {#if isFiltering && filteredArticles.length === 0}
          <p
            class={unstyled
              ? (slotClasses?.noResults ?? '')
              : styles.noResults({ class: slotClasses?.noResults })}
          >
            {bt('guide.noResults', {})}
          </p>
        {:else if hasGroups}
          {#each sections as section, i (section.group ?? '')}
            {#if section.group}
              <h3
                id={`${panelId}-group-${i}`}
                class={unstyled
                  ? (slotClasses?.groupHeader ?? '')
                  : styles.groupHeader({ class: slotClasses?.groupHeader })}
              >
                {section.group}
              </h3>
            {/if}
            <ul
              class={unstyled
                ? (slotClasses?.list ?? '')
                : styles.list({ class: slotClasses?.list })}
              aria-labelledby={section.group ? `${panelId}-group-${i}` : undefined}
            >
              {#each section.articles as article (article.id)}
                {@render articleListItem(article)}
              {/each}
            </ul>
          {/each}
        {:else}
          <ul
            class={unstyled ? (slotClasses?.list ?? '') : styles.list({ class: slotClasses?.list })}
          >
            {#each filteredArticles as article (article.id)}
              {@render articleListItem(article)}
            {/each}
          </ul>
        {/if}
      {/if}
      {@render children?.()}
    </div>

    {#if footer}
      <footer
        class={unstyled
          ? (slotClasses?.footer ?? '')
          : styles.footer({ class: slotClasses?.footer })}
      >
        {@render footer()}
      </footer>
    {/if}
  </aside>
{/if}

<style>
  aside {
    transform: var(--_guide-panel-transform);
    transition: transform var(--blocks-duration-normal, 200ms)
      var(--blocks-ease-confident, cubic-bezier(0.2, 0, 0, 1));
  }

  @media (prefers-reduced-motion: reduce) {
    aside {
      transition: none;
    }
  }
</style>
