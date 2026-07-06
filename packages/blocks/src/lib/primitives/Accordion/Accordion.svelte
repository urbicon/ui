<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { accordionVariants, type AccordionVariants } from './accordion.variants';
  import { setAccordionContext } from './accordion.context';
  import type { AccordionProps, AccordionContext } from './index';

  let {
    type = 'single',
    variant = 'default',
    size = 'md',
    value = $bindable(),
    defaultValue,
    onValueChange,
    disabled = false,
    collapsible = true,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: AccordionProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: AccordionVariants = $derived({ variant, size });
  const styles = $derived(accordionVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Accordion', preset, variantProps, slotClassesProp)
  );

  function normalise(v: string | string[] | undefined): string[] {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  }

  // Uncontrolled seed: capture only the initial `defaultValue`; later changes
  // must not clobber user interaction.
  // svelte-ignore state_referenced_locally
  let internalValue = $state<string[]>(normalise(defaultValue));

  const openItems = $derived(value !== undefined ? normalise(value) : internalValue);

  function update(next: string[]) {
    if (value !== undefined) {
      value = type === 'single' ? (next[0] ?? '') : next;
    } else {
      internalValue = next;
    }
    onValueChange?.(type === 'single' ? (next[0] ?? '') : next);
  }

  const ctx: AccordionContext = {
    toggle(itemValue: string) {
      if (disabled) return;

      const isOpen = openItems.includes(itemValue);

      if (isOpen) {
        if (!collapsible && openItems.length <= 1) return;
        update(openItems.filter((v) => v !== itemValue));
      } else if (type === 'single') {
        update([itemValue]);
      } else {
        update([...openItems, itemValue]);
      }
    },
    isOpen(itemValue: string) {
      return openItems.includes(itemValue);
    },
    get variant() {
      return variant;
    },
    get size() {
      return size;
    },
    get disabled() {
      return disabled;
    }
  };

  setAccordionContext(ctx);
</script>

<div
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  data-orientation="vertical"
  {...restProps}
>
  {@render children()}
</div>
