<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { accordionVariants, type AccordionVariants } from './accordion.variants';
  import { getAccordionContext } from './accordion.context';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import { Collapsible } from '../Collapsible';
  import type { AccordionItemProps } from './index';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    value,
    title = '',
    trigger: customTrigger,
    children,
    disabled: itemDisabled = false,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: AccordionItemProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const ctx = getAccordionContext();
  const open = $derived(ctx.isOpen(value));
  const isDisabled = $derived(itemDisabled || ctx.disabled);

  const variantProps: AccordionVariants = $derived({ variant: ctx.variant, size: ctx.size });
  const styles = $derived(accordionVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'AccordionItem', preset, variantProps, slotClassesProp)
  );

  function slot(key: Exclude<keyof typeof styles, 'base'>, extra?: string) {
    const overrides = [slotClasses?.[key], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
    return styles[key]({ class: overrides });
  }
</script>

<!--
  Collapsible is driven purely by the `open` prop (= ctx.isOpen(value)); the
  trigger calls ctx.toggle(value) directly rather than Collapsible's own toggle.
  Routing through Collapsible.toggle would optimistically mutate its local open
  state *before* ctx decides — so a rejected toggle (collapsible=false on the
  last open item) left Collapsible visually closed while ctx kept it open.
-->
<Collapsible
  {open}
  disabled={isDisabled}
  name={`accordion-${value}`}
  unstyled
  class={slot('item', className)}
  slotClasses={{
    content: slot('content'),
    contentInner: slot('contentInner')
  }}
  {...restProps}
>
  {#snippet trigger({ open: isOpen, triggerId, contentId })}
    <button
      id={triggerId}
      type="button"
      class={slot('trigger')}
      aria-expanded={isOpen}
      aria-controls={contentId}
      disabled={isDisabled}
      onclick={() => ctx.toggle(value)}
    >
      {#if customTrigger}
        {@render customTrigger({ open: isOpen })}
      {:else}
        <span>{title}</span>
      {/if}

      <ChevronDownIcon class={slot('chevron', isOpen ? 'rotate-180' : '')} />
    </button>
  {/snippet}
  {@render children()}
</Collapsible>
