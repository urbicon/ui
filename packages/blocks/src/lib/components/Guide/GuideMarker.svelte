<script lang="ts">
  import { useBlocksI18n } from '$lib/i18n';
  import { InfoCircleIcon } from '$lib/icons';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getGuideContext } from './guide.context';
  import { guideMarkerVariants, type GuideMarkerVariants } from './guide.variants';
  import type { GuideMarkerProps } from './index';

  const bt = useBlocksI18n();

  let {
    for: topicId,
    article,
    direction,
    label,
    size = 'md',
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuideMarkerProps = $props();

  const guide = getGuideContext();

  if (import.meta.env.DEV && !guide) {
    console.warn(
      '[Guide] <GuideMarker> is used without a <GuideProvider> ancestor — it renders inert.'
    );
  }

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuideMarkerVariants = $derived({ size });
  const styles = $derived(guideMarkerVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'GuideMarker', preset, variantProps, slotClassesProp)
  );

  // A Marker is the UI→Guide affordance; it is live unless the resolved direction
  // is 'to-ui' only. With no `for` there is no topic to gate on (the prop wins).
  const effectiveDirection = $derived(
    topicId ? (guide?.resolveDirection(topicId, direction) ?? 'both') : (direction ?? 'both')
  );
  const active = $derived(!!guide && effectiveDirection !== 'to-ui');

  // Which article to open: explicit prop > topic meta > the topic id itself.
  const targetArticle = $derived(
    article ?? (topicId ? guide?.getTopicMeta(topicId)?.article : undefined) ?? topicId
  );
  const topicLabel = $derived(topicId ? guide?.getTopicMeta(topicId)?.label : undefined);
  const ariaLabel = $derived(
    label ?? (topicLabel ? bt('guide.infoAbout', { label: topicLabel }) : bt('guide.info', {}))
  );
  // Reflects whether *this* marker's article is the one currently shown.
  const expanded = $derived(
    !!guide?.panelOpen && targetArticle !== undefined && guide?.activeArticle === targetArticle
  );

  function activate() {
    if (!guide || !active) return;
    guide.openPanel(targetArticle ?? undefined);
  }
</script>

{#if active}
  <button
    type="button"
    class={unstyled
      ? [slotClasses?.marker, className].filter(Boolean).join(' ')
      : styles.marker({ class: [slotClasses?.marker, className] })}
    aria-controls={guide?.panelId ?? undefined}
    aria-expanded={expanded}
    aria-label={ariaLabel}
    data-guide-marker
    onclick={activate}
    {...restProps}
  >
    {#if children}
      {@render children()}
    {:else}
      <InfoCircleIcon
        class={unstyled ? slotClasses?.icon : styles.icon({ class: slotClasses?.icon })}
      />
    {/if}
  </button>
{/if}
