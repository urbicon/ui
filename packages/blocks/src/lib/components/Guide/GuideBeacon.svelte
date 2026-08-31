<script lang="ts">
  import { useBlocksI18n } from '$lib/i18n';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { getGuideContext } from './guide.context';
  import { guideBeaconVariants, type GuideBeaconVariants } from './guide.variants';
  import type { GuideBeaconProps } from './index';

  const bt = useBlocksI18n();

  let {
    tour,
    onActivate,
    once = true,
    size = 'md',
    label,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuideBeaconProps = $props();

  const guide = getGuideContext();

  if (import.meta.env?.DEV && !guide) {
    console.warn(
      '[Guide] <GuideBeacon> is used without a <GuideProvider> ancestor — it will not render.'
    );
  }

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: GuideBeaconVariants = $derived({ size });
  const styles = $derived(guideBeaconVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'GuideBeacon', preset, variantProps, slotClassesProp)
  );

  // Hide once the tour has been seen (gentle, never nags) and while it is running (the
  // tour's own scrim takes over). Both reactive: `hasSeen` reads the controller's seen set,
  // `activeTour` its tour state.
  const seen = $derived(!!tour && once && !!guide && guide.hasSeen(tour.id));
  const running = $derived(!!tour && guide?.activeTour?.id === tour.id);
  const hidden = $derived(seen || running);

  function activate() {
    if (tour) guide?.startTour(tour);
    onActivate?.();
  }
</script>

{#if guide && !hidden}
  <button
    type="button"
    class={[
      'guide-beacon',
      unstyled
        ? resolveClassChain(slotClasses?.beacon, className)
        : styles.beacon({ class: [slotClasses?.beacon, className] })
    ]}
    aria-label={label ?? bt('guide.startTour', {})}
    onclick={activate}
    {...restProps}
  >
    <span
      class={[
        'guide-beacon-ping',
        unstyled ? (slotClasses?.ping ?? '') : styles.ping({ class: slotClasses?.ping })
      ]}
      aria-hidden="true"
    ></span>
    <span
      class={unstyled ? (slotClasses?.dot ?? '') : styles.dot({ class: slotClasses?.dot })}
      aria-hidden="true"
    ></span>
  </button>
{/if}

<style>
  /* Waiting pulse — an expanding, fading ring behind the solid dot. Reduced-motion
     hides the ring entirely, leaving a calm static dot. */
  .guide-beacon-ping {
    animation: guide-beacon-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  @keyframes guide-beacon-ping {
    0% {
      transform: scale(1);
      opacity: 0.7;
    }
    75%,
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-beacon-ping {
      animation: none;
      opacity: 0;
    }
  }
</style>
