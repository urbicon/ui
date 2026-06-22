<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getGuideContext } from './guide.context';
  import { guideMentionVariants, type GuideMentionVariants } from './guide.variants';
  import type { GuideMentionProps } from './index';

  let {
    for: topicId,
    direction,
    scroll = true,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuideMentionProps = $props();

  const guide = getGuideContext();

  if (import.meta.env.DEV && !guide) {
    console.warn(
      '[Guide] <GuideMention> is used without a <GuideProvider> ancestor — it renders as plain text.'
    );
  }

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuideMentionVariants = $derived({});
  const styles = $derived(guideMentionVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'GuideMention', preset, variantProps, slotClassesProp)
  );

  // A Mention is the Guide→UI affordance; it is interactive unless the resolved
  // direction is 'to-guide' only (then it degrades to plain inline text).
  // `resolveDirection` is total (never nullish), so the only live fallback is the
  // no-provider branch.
  const effectiveDirection = $derived(
    guide ? guide.resolveDirection(topicId, direction) : (direction ?? 'both')
  );
  const interactive = $derived(!!guide && effectiveDirection !== 'to-guide');

  $effect(() => {
    if (import.meta.env.DEV && guide && effectiveDirection === 'to-guide') {
      console.warn(
        `[Guide] <GuideMention for="${topicId}"> points at a topic whose direction excludes Guide→UI ('to-guide') — it renders as plain text.`
      );
    }
  });

  // Tracks whether this specific mention set the current highlight, so the unmount
  // teardown only releases a ring it actually owns (not one a sibling mention owns).
  let owns = false;

  // Hover *and* focus both highlight (keyboard parity, §4.2). Clearing is guarded on the
  // topic id, so leaving this mention never wipes a *different* topic's highlight (e.g.
  // when the pointer has already moved on to a mention for another target).
  function highlight() {
    owns = true;
    guide?.highlight(topicId);
  }
  function clear() {
    owns = false;
    if (guide?.highlightedId === topicId) guide.clearHighlight();
  }
  function activate() {
    owns = true;
    guide?.highlight(topicId, { scroll });
  }

  // If this mention unmounts while it still owns the highlight — e.g. its article is
  // switched away programmatically before mouseleave/blur fire — release the ring so it
  // doesn't leak onto the (still-mounted) target element.
  $effect(() => {
    return () => {
      if (owns && guide?.highlightedId === topicId) guide.clearHighlight();
    };
  });
</script>

{#if interactive}
  <button
    type="button"
    class={unstyled
      ? [slotClasses?.mention, className].filter(Boolean).join(' ')
      : styles.mention({ class: [slotClasses?.mention, className] })}
    data-guide-mention
    onmouseenter={highlight}
    onmouseleave={clear}
    onfocus={highlight}
    onblur={clear}
    onclick={activate}
    {...restProps}
  >
    {@render children?.()}
  </button>
{:else}
  <span
    class={[slotClasses?.mention, className].filter(Boolean).join(' ') || undefined}
    {...restProps}
  >
    {@render children?.()}
  </span>
{/if}
