<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { edgeEnabledIndex, getTierContext, nextEnabledIndex } from '$lib/utils';
  import { resolveClassChain } from '$lib/utils/variants';
  import { tabVariants, type TabVariants } from './tab.variants';
  import { setTabContext } from './tab.context';
  import type { RegisteredTab, TabContext, TabProps } from './index';

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

  // The entry carries an `isDisabled` GETTER — see RegisteredTab, and the same
  // reasoning as SegmentGroup's RegisteredSegment: a snapshot would freeze at
  // registration time, and reading `element.disabled` is not tracked at all.
  const registeredTabs = new SvelteMap<string, RegisteredTab>();

  /** First tab that can actually take focus, in registration (document) order. */
  function firstEnabledTab(): string | undefined {
    const tabValues = Array.from(registeredTabs.keys());
    const index = edgeEnabledIndex(tabValues.length, 1, (i) => {
      const entry = registeredTabs.get(tabValues[i]);
      return !entry || entry.isDisabled();
    });
    return index >= 0 ? tabValues[index] : undefined;
  }

  const activeValue = $derived(value !== undefined ? value : internalValue);

  // How many rendered TabPanels claim a value — a count, not a flag: two panels
  // may briefly share one value (a `value` prop changing re-runs the claim, and
  // a consumer can render duplicates), and a Set would let the departing one
  // delete a claim the remaining panel still holds, dropping aria-controls for
  // a panel that is in the document. TabItem emits aria-controls only for a
  // claimed value — consumers may render panel content themselves, and a lazy
  // panel has no id in the document before its first activation (#109).
  const panelClaims = new SvelteMap<string, number>();

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

    const activeTab = registeredTabs.get(activeValue)?.element;
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
    registerTab(tabValue: string, element: HTMLElement, isDisabled: () => boolean) {
      registeredTabs.set(tabValue, { element, isDisabled });

      // A tabs widget always has exactly one selected tab, so "nothing
      // selected" is not a state this component may be in. Left representable
      // it was a keyboard trap: with neither `value` nor `defaultValue` (both
      // optional) `internalValue` was '', which matches no tab — every tab
      // rendered aria-selected=false and tabindex=-1, no panel rendered, and
      // the tablist could not be reached with Tab. So the first enabled tab to
      // register takes the selection.
      //
      // Written once here rather than derived from the registration map: a
      // derived `activeValue` would have to read every tab's `isDisabled`,
      // which each tab reads back through `isActive` — the two-way traffic
      // between the tablist's and the items' deriveds hung the test run rather
      // than settling. Writing the seed keeps the graph one-way, and the
      // widget then behaves exactly as if `defaultValue` had been passed.
      //
      // A CONTROLLED `value` naming no tab is deliberately left alone — that is
      // the consumer's state to own, and selecting something else would fight
      // them. `isTabStop` keeps that case reachable without touching selection.
      if (value === undefined && !internalValue && !isDisabled()) {
        internalValue = tabValue;
      }

      return () => {
        registeredTabs.delete(tabValue);
      };
    },

    registerPanel(panelValue: string) {
      // `untrack` around every read: this runs inside TabPanel's `$effect`, so
      // reading the count tracked would make that effect depend on the very map
      // it then writes — it re-ran itself without end and hung the test run.
      // The count is bookkeeping for the writer; only `hasPanel` is a signal.
      const claims = untrack(() => panelClaims.get(panelValue) ?? 0);
      panelClaims.set(panelValue, claims + 1);

      return () => {
        const remaining = untrack(() => panelClaims.get(panelValue) ?? 1) - 1;
        if (remaining > 0) panelClaims.set(panelValue, remaining);
        else panelClaims.delete(panelValue);
      };
    },

    hasPanel(panelValue: string) {
      return panelClaims.has(panelValue);
    },

    // Only a tab that can take focus may hold the stop. The active tab holds it
    // whenever it is registered and enabled; otherwise it goes to the first
    // enabled tab, which keeps the tablist reachable when a controlled `value`
    // names no tab or names a disabled one. Same rule as SegmentGroup (#205).
    isTabStop(tabValue: string) {
      const active = registeredTabs.get(activeValue);
      if (active && !active.isDisabled()) return activeValue === tabValue;
      return firstEnabledTab() === tabValue;
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
    // Same source as `isTabStop`, not the DOM: one answer to "can this tab
    // take focus" keeps navigation and the tab stop from disagreeing.
    const isDisabled = (i: number) => {
      const entry = registeredTabs.get(tabValues[i]);
      return !entry || entry.isDisabled();
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

      const newTab = registeredTabs.get(tabValues[newIndex])?.element;
      newTab?.focus();
    }
  }
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
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
