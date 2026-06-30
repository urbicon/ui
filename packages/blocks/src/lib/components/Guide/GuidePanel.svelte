<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { useBlocksI18n } from '$lib/i18n';
  import { CloseIcon, ChevronLeftIcon, ChevronRightIcon } from '$lib/icons';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getGuideContext } from './guide.context';
  import { setGuidePanelContext } from './guide-panel.context';
  import { guidePanelVariants, type GuidePanelVariants } from './guide.variants';
  import type { GuidePanelProps } from './index';

  const bt = useBlocksI18n();

  let {
    id: idProp,
    placement = 'right',
    size = 'md',
    title,
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
  const articleMap = new SvelteMap<string, string>();
  setGuidePanelContext({
    registerArticle(id, articleTitle) {
      untrack(() => articleMap.set(id, articleTitle));
      return () => untrack(() => articleMap.delete(id));
    }
  });

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuidePanelVariants = $derived({ placement, size });
  const styles = $derived(guidePanelVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'GuidePanel', preset, variantProps, slotClassesProp)
  );

  const open = $derived(guide?.panelOpen ?? false);
  const activeArticle = $derived(guide?.activeArticle ?? null);
  const articles = $derived([...articleMap].map(([id, t]) => ({ id, title: t })));
  const headerTitle = $derived(
    (activeArticle ? articleMap.get(activeArticle) : undefined) ?? title ?? bt('guide.openHelp', {})
  );

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
      ? [slotClasses?.panel, className].filter(Boolean).join(' ')
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
        id={`${panelId}-title`}
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
      {#if !activeArticle}
        <ul
          class={unstyled ? (slotClasses?.list ?? '') : styles.list({ class: slotClasses?.list })}
        >
          {#each articles as article (article.id)}
            <li>
              <button
                type="button"
                class={unstyled
                  ? (slotClasses?.listItem ?? '')
                  : styles.listItem({ class: slotClasses?.listItem })}
                onclick={() => guide.setArticle(article.id)}
              >
                <span class="flex-1">{article.title}</span>
                <ChevronRightIcon class="h-4 w-4 opacity-50" />
              </button>
            </li>
          {/each}
        </ul>
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
