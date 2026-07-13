<script lang="ts">
  import { buttonGroupVariants, type ButtonGroupVariants } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { edgeEnabledIndex, nextEnabledIndex } from '$lib/utils';
  import { getTierContext, setTierContext } from '$lib/utils/tier-context';
  import type { ButtonGroupContext, ButtonGroupProps } from './index';
  import { setButtonGroupContext } from './buttonGroup.context';

  let {
    children,
    orientation = 'horizontal',
    connected = true,
    size = 'md',
    intent = 'neutral',
    variant = 'outlined',
    tier,
    selection = 'none',
    value = $bindable(),
    disabled = false,
    mint = 'none',
    onSelectionChange,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ariaLabel,
    ariaLabelledBy,
    ...restProps
  }: ButtonGroupProps = $props();

  // Tier precedence: own prop → outer TierContext (e.g. Toolbar) → 'commit'.
  // Re-propagate as our own TierContext so child Buttons inherit our tier
  // (and not the outer one) when we override.
  const outerTierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? outerTierCtx?.tier ?? 'commit');
  setTierContext({
    get tier() {
      return effectiveTier;
    }
  });

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: ButtonGroupVariants = $derived({
    orientation,
    connected,
    tier: effectiveTier,
    disabled
  });
  const styles = $derived(buttonGroupVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'ButtonGroup', preset, variantProps, slotClassesProp)
  );

  let selectedValues = $state<Set<string>>(new Set());

  $effect(() => {
    if (selection === 'single' && typeof value === 'string') {
      selectedValues = new Set(value ? [value] : []);
    } else if (selection === 'multiple' && Array.isArray(value)) {
      selectedValues = new Set(value);
    } else {
      selectedValues = new Set();
    }
  });

  // Child Button values in registration (= document) order. Buttons register
  // during their render pass (before any effect runs), so this is fully
  // populated in DOM order by the time roving reads it — it lets the radiogroup
  // map the reactive selection back to a radio's position without the shared
  // <Button> exposing its value in the DOM.
  const buttonOrder: string[] = [];

  function registerButton(buttonValue: string | undefined) {
    if (buttonValue && !buttonOrder.includes(buttonValue)) buttonOrder.push(buttonValue);
    return {
      get isSelected() {
        return buttonValue ? selectedValues.has(buttonValue) : false;
      },
      onClick() {
        if (disabled || !buttonValue || selection === 'none') return;

        // Local-only copy, not stored in state.
        const next = new Set(selectedValues);

        if (selection === 'single') {
          next.clear();
          if (!selectedValues.has(buttonValue)) next.add(buttonValue);
          selectedValues = next;
          value = next.size > 0 ? buttonValue : undefined;
        } else if (selection === 'multiple') {
          if (next.has(buttonValue)) next.delete(buttonValue);
          else next.add(buttonValue);
          selectedValues = next;
          value = Array.from(next);
        }

        onSelectionChange?.(value, Array.from(selectedValues));
      },
      getButtonProps() {
        // A value-less Button is an action button, not a selection option, so it
        // gets no radio/checkbox role. This also keeps `rovingRadios()` (which
        // collects `[role="radio"]`) index-aligned with `buttonOrder` (gated on
        // `buttonValue`): a value-less radio would otherwise sit in the roving
        // array but not the order registry, drifting the two index spaces and
        // misplacing the tab stop / arrow-nav origin.
        if (selection === 'none' || !buttonValue) return {};
        const checked = selectedValues.has(buttonValue);
        return {
          role: selection === 'single' ? ('radio' as const) : ('checkbox' as const),
          'aria-checked': checked
        };
      }
    };
  }

  setButtonGroupContext({
    get orientation() {
      return orientation;
    },
    get connected() {
      return connected;
    },
    get size() {
      return size;
    },
    get intent() {
      return intent;
    },
    get variant() {
      return variant;
    },
    get selection() {
      return selection;
    },
    get disabled() {
      return disabled;
    },
    get mint() {
      return mint;
    },
    get selectedValues() {
      return selectedValues;
    },
    registerButton
  });

  let containerElement = $state<HTMLDivElement>();

  // Single-select is a WAI-ARIA radiogroup: ONE tab stop, arrow keys move the
  // selection (roving tabindex). Tab/SegmentGroup drive this from a value→element
  // registry their own item components populate; ButtonGroup's items are shared
  // <Button>s (outside this component), so the radiogroup owns the roving from
  // the container instead — it queries the radio *elements* from the DOM (for
  // focus + disabled state), reads the *selected* one from reactive state (see
  // selectedRadioIndex), reuses the shared index math (utils/roving), skips
  // disabled radios, and drives selection by clicking the target radio (Button's
  // own click handler does the rest). `multiple`/`none` keep every button
  // natively tabbable (checkbox-group / plain toolbar convention — not roved).
  function rovingRadios(): HTMLButtonElement[] {
    return containerElement
      ? Array.from(containerElement.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
      : [];
  }

  // Position of the selected radio, read from the reactive selection (not the
  // DOM's aria-checked) so it is correct even on the first paint — a parent
  // effect can run before the child <Button>s commit their aria, so the DOM
  // isn't a reliable source there. `buttonOrder` is in document order, matching
  // the radios queried above.
  function selectedRadioIndex(): number {
    for (let i = 0; i < buttonOrder.length; i++) {
      if (selectedValues.has(buttonOrder[i])) return i;
    }
    return -1;
  }

  $effect(() => {
    if (selection !== 'single' || !containerElement) return;
    const radios = rovingRadios();
    if (radios.length === 0) return;

    const checkedIndex = selectedRadioIndex();
    // Nothing selected yet → the first enabled radio holds the tab stop, so the
    // group stays reachable with Tab (standard radiogroup entry behaviour).
    const activeIndex =
      checkedIndex >= 0
        ? checkedIndex
        : edgeEnabledIndex(radios.length, 1, (i) => radios[i].disabled);

    radios.forEach((radio, i) => {
      radio.tabIndex = i === activeIndex ? 0 : -1;
    });

    // Restore native tabbability when the group stops roving (selection flips away
    // from single, or it unmounts) — otherwise the imposed -1 would strand the
    // buttons out of the tab order.
    return () => {
      for (const radio of radios) radio.removeAttribute('tabindex');
    };
  });

  // A disabled radio renders a `<button disabled>`, which can't hold focus, so
  // arrow navigation must step over it — otherwise selection strands on an
  // unfocusable radio (aria-checked set, focus stuck on the previous one). The
  // index math lives in the shared roving helpers (utils/roving).
  function handleKeyDown(event: KeyboardEvent) {
    if (disabled || selection !== 'single') return;

    const radios = rovingRadios();
    if (radios.length === 0) return;

    const currentIndex = selectedRadioIndex();
    const isDisabled = (i: number) => radios[i].disabled;
    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = nextEnabledIndex(radios.length, currentIndex, 1, isDisabled);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = nextEnabledIndex(radios.length, currentIndex, -1, isDisabled);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = edgeEnabledIndex(radios.length, 1, isDisabled);
        break;
      case 'End':
        event.preventDefault();
        newIndex = edgeEnabledIndex(radios.length, -1, isDisabled);
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      const target = radios[newIndex];
      target.click(); // Button's own click handler performs the selection
      target.focus();
    }
  }

  const ariaRole = $derived(selection === 'single' ? 'radiogroup' : 'group');
</script>

<div
  bind:this={containerElement}
  role={ariaRole}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledBy}
  aria-orientation={orientation}
  aria-disabled={disabled || undefined}
  onkeydown={handleKeyDown}
  {...restProps}
>
  {@render children?.()}
</div>
