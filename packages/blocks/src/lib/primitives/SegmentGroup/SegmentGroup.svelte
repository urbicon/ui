<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { getTierContext } from '$lib/utils';
  import { segmentGroupVariants } from './segmentgroup.variants';
  import { setSegmentGroupContext } from './segmentGroup.context';
  import type { SegmentGroupContext, SegmentGroupProps } from './index';

  let {
    children,
    value = $bindable(),
    onValueChange,
    size = 'md',
    appearance = 'default',
    tier,
    fullWidth = false,
    disabled = false,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ariaLabel,
    ...restProps
  }: SegmentGroupProps = $props();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'commit' default. Propagated through SegmentGroupContext
  // so the indicator + every item shares the same radius family.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.SegmentGroup?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'SegmentGroup', preset),
      slotClassesProp
    )
  );

  let containerElement = $state<HTMLDivElement>();
  let indicatorStyle = $state('opacity: 0;');
  // SvelteMap instead of `$state(new Map())` — `.set()`/`.delete()` must be
  // reactive so the indicator updates when new items register.
  const registeredItems = new SvelteMap<string, HTMLElement>();

  const styles = $derived(
    segmentGroupVariants({ size, appearance, tier: effectiveTier, fullWidth, disabled })
  );

  function updateIndicator() {
    if (!containerElement || !value) {
      indicatorStyle = 'opacity: 0;';
      return;
    }

    const activeItem = registeredItems.get(value);
    if (!activeItem) {
      indicatorStyle = 'opacity: 0;';
      return;
    }

    const containerRect = containerElement.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();

    const left = itemRect.left - containerRect.left;
    const top = itemRect.top - containerRect.top;
    const width = itemRect.width;
    const height = itemRect.height;

    indicatorStyle = `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px; opacity: 1;`;
  }

  const segmentContext: SegmentGroupContext = {
    registerItem(itemValue: string, element: HTMLElement) {
      registeredItems.set(itemValue, element);
      requestAnimationFrame(updateIndicator);

      return () => {
        registeredItems.delete(itemValue);
      };
    },

    selectItem(itemValue: string) {
      if (disabled) return;
      value = itemValue;
      onValueChange?.(itemValue);
      requestAnimationFrame(updateIndicator);
    },

    isActive(itemValue: string) {
      return value === itemValue;
    },

    get size() {
      return size;
    },
    get appearance() {
      return appearance;
    },
    get tier() {
      return effectiveTier;
    },
    get disabled() {
      return disabled;
    },
    get unstyled() {
      return unstyled;
    },
    get mint() {
      return mint;
    }
  };

  setSegmentGroupContext(segmentContext);

  $effect(() => {
    void value;
    requestAnimationFrame(updateIndicator);
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;

    const itemValues = Array.from(registeredItems.keys());
    const currentIndex = value ? itemValues.indexOf(value) : -1;
    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = (currentIndex + 1) % itemValues.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = currentIndex - 1 < 0 ? itemValues.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = itemValues.length - 1;
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex && itemValues[newIndex]) {
      segmentContext.selectItem(itemValues[newIndex]);
      const newItem = registeredItems.get(itemValues[newIndex]);
      newItem?.focus();
    }
  }
</script>

<div
  bind:this={containerElement}
  role="radiogroup"
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={ariaLabel}
  aria-disabled={disabled || undefined}
  onkeydown={handleKeyDown}
  {...restProps}
>
  <div
    class={unstyled
      ? (slotClasses?.indicator ?? '')
      : styles.indicator({ class: slotClasses?.indicator })}
    style={indicatorStyle}
    aria-hidden="true"
  ></div>

  {@render children?.()}
</div>
