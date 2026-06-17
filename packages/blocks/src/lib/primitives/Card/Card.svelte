<script lang="ts">
  import { mintRegistry } from '$lib';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { cardVariants } from './card.variants';
  import type { CardProps } from './index';

  let {
    variant = 'quiet',
    padding = 'md',
    dividers = false,
    disabled = false,
    mint = 'none',
    children,
    header,
    footer,
    clickable = false,
    href,
    onclick,
    onHover,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: CardProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Card?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Card', preset),
      slotClassesProp
    )
  );

  let cardElement = $state<HTMLElement>();

  const elementType = $derived.by(() => {
    if (href) return 'a';
    if (clickable || onclick) return 'button';
    return 'div';
  });

  // Hover/focus styles apply when the card has a real click source —
  // `clickable` (force <button>), an `onclick` handler, or `href` (<a>).
  // No decorative-hover mode: cursor-pointer + translate on a passive
  // element would falsely signal interactivity (WCAG 3.2 Predictable).
  const isInteractive = $derived(clickable || !!onclick || !!href);

  const styles = $derived(
    cardVariants({
      variant,
      padding,
      dividers: dividers || undefined,
      interactive: isInteractive || undefined,
      elementType,
      disabled: disabled || undefined
    })
  );

  const elementProps = $derived.by(() => {
    const props: Record<string, unknown> = { ...restProps };
    if (href) props.href = href;
    if (elementType === 'button') props.type = 'button';
    return props;
  });

  $effect(() => {
    if (cardElement && mint && mint !== 'none' && isInteractive && !disabled) {
      return mintRegistry.apply(cardElement, mint);
    }
  });

  function handleClick(event: MouseEvent) {
    if (disabled) return;
    onclick?.(event);
  }
</script>

<svelte:element
  this={elementType}
  bind:this={cardElement}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  onmouseenter={() => onHover?.(true)}
  onmouseleave={() => onHover?.(false)}
  onclick={handleClick}
  aria-disabled={disabled}
  {...elementProps}
>
  {#if header}
    <div
      class={unstyled ? (slotClasses?.header ?? '') : styles.header({ class: slotClasses?.header })}
    >
      {@render header()}
    </div>
  {/if}

  <div
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
  >
    {@render children?.()}
  </div>

  {#if footer}
    <div
      class={unstyled ? (slotClasses?.footer ?? '') : styles.footer({ class: slotClasses?.footer })}
    >
      {@render footer()}
    </div>
  {/if}
</svelte:element>
