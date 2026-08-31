<script lang="ts">
  import { tick } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { getGuideContext } from './guide.context';
  import { getGuidePanelContext } from './guide-panel.context';
  import { guideRefVariants, type GuideRefVariants } from './guide.variants';
  import type { GuideRefProps } from './index';

  let {
    article,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuideRefProps = $props();

  const guide = getGuideContext();
  const panel = getGuidePanelContext();

  if (import.meta.env?.DEV && !guide) {
    console.warn(
      '[Guide] <GuideRef> is used without a <GuideProvider> ancestor — it renders as plain text.'
    );
  } else if (import.meta.env?.DEV && !panel) {
    console.warn('[Guide] <GuideRef> is used outside a <GuidePanel> — it renders as plain text.');
  }

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuideRefVariants = $derived({});
  const styles = $derived(guideRefVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'GuideRef', preset, variantProps, slotClassesProp)
  );

  // Interactive only when wired to a panel that actually registers the target
  // article; otherwise (no provider, outside a panel, or an unknown id) it degrades
  // to plain inline text — mirrors GuideMention's no-provider fallback. Articles
  // register from a child `$effect`, so `hasArticle` is false during SSR *and* the
  // first client render → both emit a `<span>` (no hydration mismatch); a known
  // article reactively upgrades to a `<button>` once its registration effect runs.
  const resolvable = $derived(!!panel?.hasArticle(article));
  const interactive = $derived(!!guide && resolvable);

  // DEV-only: warn for an article id that stays unresolved past this flush — deferred
  // via `tick()` so a target `<GuideArticle>` registering in the same render isn't a
  // false positive (mirrors GuidePanel's missing-active-article warning).
  $effect(() => {
    if (!import.meta.env?.DEV || !guide || !panel) return;
    const target = article;
    let cancelled = false;
    tick().then(() => {
      if (!cancelled && !panel.hasArticle(target)) {
        console.warn(
          `[Guide] <GuideRef article="${target}"> points at an article that is not registered — it renders as plain text.`
        );
      }
    });
    return () => {
      cancelled = true;
    };
  });

  function navigate() {
    guide?.setArticle(article);
  }
</script>

{#if interactive}
  <button
    type="button"
    class={unstyled
      ? resolveClassChain(slotClasses?.ref, className)
      : styles.ref({ class: [slotClasses?.ref, className] })}
    data-guide-ref
    onclick={navigate}
    {...restProps}
  >
    {@render children?.()}
  </button>
{:else}
  <span class={resolveClassChain(slotClasses?.ref, className) || undefined} {...restProps}>
    {@render children?.()}
  </span>
{/if}
