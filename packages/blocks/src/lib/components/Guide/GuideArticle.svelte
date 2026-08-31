<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { getGuideContext } from './guide.context';
  import { getGuidePanelContext } from './guide-panel.context';
  import { guideArticleVariants, type GuideArticleVariants } from './guide.variants';
  import type { GuideArticleProps } from './index';

  let {
    id,
    title,
    group,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuideArticleProps = $props();

  const guide = getGuideContext();
  const panel = getGuidePanelContext();

  // Register with the parent panel's list view. Runs regardless of whether this
  // article is the active one, so every article shows up in the list. Cleans up
  // on unmount and re-registers if id/title/group change.
  $effect(() => {
    return panel?.registerArticle(id, title, group);
  });

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuideArticleVariants = $derived({});
  const styles = $derived(guideArticleVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'GuideArticle', preset, variantProps, slotClassesProp)
  );

  const isActive = $derived(guide?.activeArticle === id);
</script>

{#if isActive}
  <article
    class={unstyled
      ? resolveClassChain(slotClasses?.article, className)
      : styles.article({ class: [slotClasses?.article, className] })}
    {...restProps}
  >
    {@render children?.()}
  </article>
{/if}
