<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { accordionVariants } from './accordion.variants';
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
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.AccordionItem?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'AccordionItem', preset),
      slotClassesProp
    )
  );

  const ctx = getAccordionContext();
  const open = $derived(ctx.isOpen(value));
  const isDisabled = $derived(itemDisabled || ctx.disabled);

  const styles = $derived(
    unstyled
      ? {
          item: () => '',
          trigger: () => '',
          chevron: () => '',
          content: () => '',
          contentInner: () => ''
        }
      : accordionVariants({ variant: ctx.variant, size: ctx.size })
  );

  function slot(key: keyof typeof styles, extra?: string) {
    const overrides = [slotClasses?.[key], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
    return styles[key]({ class: overrides });
  }
</script>

<Collapsible
  {open}
  onOpenChange={() => ctx.toggle(value)}
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
  {#snippet trigger({ open: isOpen, toggle, triggerId, contentId })}
    <button
      id={triggerId}
      type="button"
      class={slot('trigger')}
      aria-expanded={isOpen}
      aria-controls={contentId}
      disabled={isDisabled}
      onclick={toggle}
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
