<script lang="ts">
  import { buttonGroupVariants, type ButtonGroupVariants } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
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

  function registerButton(buttonValue: string | undefined) {
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
        if (selection === 'none') return {};
        const checked = buttonValue ? selectedValues.has(buttonValue) : false;
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

  const ariaRole = $derived(selection === 'single' ? 'radiogroup' : 'group');
</script>

<div
  role={ariaRole}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={ariaLabel}
  aria-labelledby={ariaLabelledBy}
  aria-disabled={disabled}
  {...restProps}
>
  {@render children?.()}
</div>
