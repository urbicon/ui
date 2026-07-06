<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext } from '$lib/utils';
  import { tabVariants, type TabVariants } from './tab.variants';
  import { setTabContext } from './tab.context';
  import type { TabContext, TabProps } from './index';

  let {
    tabs,
    panels,
    value = $bindable(),
    defaultValue,
    onValueChange,
    variant = 'line',
    orientation = 'horizontal',
    size = 'md',
    tier,
    fullWidth = false,
    disabled = false,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: TabProps = $props();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'modify' default. Propagated through TabContext so
  // every TabItem renders with the same radius family.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let tabListElement = $state<HTMLDivElement>();
  let indicatorStyle = $state('');

  // Uncontrolled seed: capture only the initial `defaultValue`; later changes
  // must not clobber user interaction.
  // svelte-ignore state_referenced_locally
  let internalValue = $state(defaultValue || '');

  const activeValue = $derived(value !== undefined ? value : internalValue);

  const registeredTabs = new SvelteMap<string, HTMLElement>();

  const variantProps: TabVariants = $derived({
    variant,
    orientation,
    size,
    tier: effectiveTier,
    fullWidth
  });

  const styles = $derived(tabVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Tab', preset, variantProps, slotClassesProp)
  );

  function updateIndicator() {
    if (!tabListElement || variant !== 'line') return;

    const activeTab = registeredTabs.get(activeValue);
    if (!activeTab) return;

    const listRect = tabListElement.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();

    if (orientation === 'horizontal') {
      const left = tabRect.left - listRect.left;
      const width = tabRect.width;
      indicatorStyle = `left: ${left}px; width: ${width}px;`;
    } else {
      const top = tabRect.top - listRect.top;
      const height = tabRect.height;
      indicatorStyle = `top: ${top}px; height: ${height}px;`;
    }
  }

  const tabContext: TabContext = {
    registerTab(tabValue: string, element: HTMLElement) {
      registeredTabs.set(tabValue, element);

      return () => {
        registeredTabs.delete(tabValue);
      };
    },

    selectTab(tabValue: string) {
      if (disabled) return;

      if (value !== undefined) {
        value = tabValue;
      } else {
        internalValue = tabValue;
      }

      onValueChange?.(tabValue);
    },

    isActive(tabValue: string) {
      return activeValue === tabValue;
    },

    get variant() {
      return variant;
    },
    get orientation() {
      return orientation;
    },
    get size() {
      return size;
    },
    get tier() {
      return effectiveTier;
    },
    get disabled() {
      return disabled;
    },
    get mint() {
      return mint;
    }
  };

  setTabContext(tabContext);

  $effect(() => {
    updateIndicator();
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;

    const tabValues = Array.from(registeredTabs.keys());
    const currentIndex = tabValues.indexOf(activeValue);

    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        if (orientation === 'horizontal' && event.key === 'ArrowDown') return;
        if (orientation === 'vertical' && event.key === 'ArrowRight') return;

        event.preventDefault();
        newIndex = (currentIndex + 1) % tabValues.length;
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        if (orientation === 'horizontal' && event.key === 'ArrowUp') return;
        if (orientation === 'vertical' && event.key === 'ArrowLeft') return;

        event.preventDefault();
        newIndex = currentIndex - 1 < 0 ? tabValues.length - 1 : currentIndex - 1;
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = tabValues.length - 1;
        break;

      default:
        return;
    }

    if (newIndex !== currentIndex && tabValues[newIndex]) {
      tabContext.selectTab(tabValues[newIndex]);

      const newTab = registeredTabs.get(tabValues[newIndex]);
      newTab?.focus();
    }
  }
</script>

<div
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  data-orientation={orientation}
  {...restProps}
>
  <div
    bind:this={tabListElement}
    class={unstyled ? (slotClasses?.list ?? '') : styles.list({ class: slotClasses?.list })}
    role="tablist"
    tabindex="-1"
    aria-orientation={orientation}
    onkeydown={handleKeyDown}
  >
    {#if variant === 'line'}
      <div
        class={unstyled
          ? (slotClasses?.indicator ?? '')
          : styles.indicator({ class: slotClasses?.indicator })}
        style={indicatorStyle}
        aria-hidden="true"
      ></div>
    {/if}

    {#if tabs}{@render tabs()}{/if}
  </div>

  <div class={unstyled ? (slotClasses?.panel ?? '') : styles.panel({ class: slotClasses?.panel })}>
    {#if panels}{@render panels()}{/if}
  </div>
</div>
