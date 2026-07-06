<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { collapsibleVariants, type CollapsibleVariants } from './collapsible.variants';
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
    transitionDuration,
    transitionEasing,
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

  // ACC-3: per-instance collapse motion. Set the shared collapse CSS variables inline only when
  // a prop is provided, so the unset default keeps inheriting the reduced-motion-aware token.
  const collapseDuration = $derived(
    transitionDuration != null ? `${transitionDuration}ms` : undefined
  );

  // Uncontrolled seed: capture only the initial `defaultOpen`; later changes
  // must not clobber user interaction.
  // svelte-ignore state_referenced_locally
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

  const variantProps: CollapsibleVariants = $derived({ variant, size });
  const styles = $derived(collapsibleVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Collapsible', preset, variantProps, slotClassesProp)
  );

  const propsId = $props.id();
  const fallbackName = `collapsible-${propsId}`;
  const uid = $derived(name ?? fallbackName);
  const triggerId = $derived(`${uid}-trigger`);
  const contentId = $derived(`${uid}-content`);
</script>

<div
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  style:--blocks-collapse-duration={collapseDuration}
  style:--blocks-collapse-easing={transitionEasing}
  data-state={isOpen ? 'open' : 'closed'}
  {...restProps}
>
  {#if trigger}
    {@render trigger({ open: isOpen, toggle, disabled, triggerId, contentId })}
  {:else}
    <button
      id={triggerId}
      type="button"
      class={unstyled
        ? (slotClasses?.trigger ?? '')
        : styles.trigger({ class: slotClasses?.trigger })}
      aria-expanded={isOpen}
      aria-controls={contentId}
      {disabled}
      onclick={toggle}
    >
      <span>{title ?? ''}</span>
      <ChevronDownIcon
        class={unstyled
          ? [slotClasses?.chevron, isOpen ? 'rotate-180' : ''].filter(Boolean).join(' ')
          : styles.chevron({ class: [slotClasses?.chevron, isOpen ? 'rotate-180' : ''] })}
      />
    </button>
  {/if}

  <div
    id={contentId}
    role="region"
    aria-labelledby={triggerId}
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
    style="display:grid; grid-template-rows: {isOpen ? '1fr' : '0fr'};"
  >
    <div class="overflow-hidden">
      <div
        class={unstyled
          ? (slotClasses?.contentInner ?? '')
          : styles.contentInner({ class: slotClasses?.contentInner })}
      >
        {@render children()}
      </div>
    </div>
  </div>
</div>
