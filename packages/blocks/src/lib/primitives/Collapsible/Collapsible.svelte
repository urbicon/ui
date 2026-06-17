<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { collapsibleVariants } from './collapsible.variants';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import type { CollapsibleProps } from './index';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    open = $bindable(),
    defaultOpen = false,
    onOpenChange,
    disabled = false,
    title,
    trigger,
    variant = 'default',
    size = 'md',
    name,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: CollapsibleProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Collapsible?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Collapsible', preset),
      slotClassesProp
    )
  );

  let internalOpen = $state(defaultOpen ?? false);
  const isOpen = $derived(open !== undefined ? open : internalOpen);

  function toggle() {
    if (disabled) return;
    const next = !isOpen;
    if (open !== undefined) {
      open = next;
    } else {
      internalOpen = next;
    }
    onOpenChange?.(next);
  }

  const styles = $derived(
    unstyled
      ? {
          base: () => '',
          trigger: () => '',
          chevron: () => '',
          content: () => '',
          contentInner: () => ''
        }
      : collapsibleVariants({ variant, size })
  );

  function slot(key: keyof typeof styles, extra?: string) {
    const overrides = [slotClasses?.[key], extra].filter(Boolean).join(' ');
    if (unstyled) return overrides;
    return styles[key]({ class: overrides });
  }

  const propsId = $props.id();
  const fallbackName = `collapsible-${propsId}`;
  const uid = $derived(name ?? fallbackName);
  const triggerId = $derived(`${uid}-trigger`);
  const contentId = $derived(`${uid}-content`);
</script>

<div class={slot('base', className)} data-state={isOpen ? 'open' : 'closed'} {...restProps}>
  {#if trigger}
    {@render trigger({ open: isOpen, toggle, disabled, triggerId, contentId })}
  {:else}
    <button
      id={triggerId}
      type="button"
      class={slot('trigger')}
      aria-expanded={isOpen}
      aria-controls={contentId}
      {disabled}
      onclick={toggle}
    >
      <span>{title ?? ''}</span>
      <ChevronDownIcon class={slot('chevron', isOpen ? 'rotate-180' : '')} />
    </button>
  {/if}

  <div
    id={contentId}
    role="region"
    aria-labelledby={triggerId}
    class={slot('content')}
    style="display:grid; grid-template-rows: {isOpen ? '1fr' : '0fr'};"
  >
    <div class="overflow-hidden">
      <div class={slot('contentInner')}>
        {@render children()}
      </div>
    </div>
  </div>
</div>
