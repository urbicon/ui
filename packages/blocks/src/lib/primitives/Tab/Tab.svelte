<script lang="ts">
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { edgeEnabledIndex, getTierContext, nextEnabledIndex } from '$lib/utils';
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
    // Retargeted onto the inner role="tablist" div: restProps land on the
    // role-less root, which forbids aria-label (axe aria-prohibited-attr),
    // and the tablist is the element screen readers announce by name (#135).
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
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

  // Values whose TabPanel is actually in the DOM. TabItem reads this to emit
  // aria-controls only for panels that exist — consumers may render panel
  // content themselves (no TabPanel at all), and a lazy panel has no id in the
  // document before its first activation (#109).
  const registeredPanels = new SvelteSet<string>();

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

    registerPanel(panelValue: string) {
      registeredPanels.add(panelValue);

      return () => {
        registeredPanels.delete(panelValue);
      };
    },

    hasPanel(panelValue: string) {
      return registeredPanels.has(panelValue);
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
    get fullWidth() {
      return fullWidth;
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

  // A disabled TabItem renders a `<button disabled>`, which can't hold focus, so
  // roving navigation must skip it — otherwise selection strands on an
  // unfocusable tab (aria-selected set, focus stuck on the previous tab). The
  // index math lives in the shared roving helpers (utils/roving).
  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;

    const tabValues = Array.from(registeredTabs.keys());
    const currentIndex = tabValues.indexOf(activeValue);
    const isDisabled = (i: number) => {
      const el = registeredTabs.get(tabValues[i]);
      return !el || (el as HTMLButtonElement).disabled;
    };

    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        if (orientation === 'horizontal' && event.key === 'ArrowDown') return;
        if (orientation === 'vertical' && event.key === 'ArrowRight') return;

        event.preventDefault();
        newIndex = nextEnabledIndex(tabValues.length, currentIndex, 1, isDisabled);
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        if (orientation === 'horizontal' && event.key === 'ArrowUp') return;
        if (orientation === 'vertical' && event.key === 'ArrowLeft') return;

        event.preventDefault();
        newIndex = nextEnabledIndex(tabValues.length, currentIndex, -1, isDisabled);
        break;

      case 'Home':
        event.preventDefault();
        newIndex = edgeEnabledIndex(tabValues.length, 1, isDisabled);
        break;

      case 'End':
        event.preventDefault();
        newIndex = edgeEnabledIndex(tabValues.length, -1, isDisabled);
        break;

      default:
        return;
    }

    if (newIndex !== currentIndex && newIndex >= 0 && tabValues[newIndex]) {
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
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
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
