<script lang="ts">
  import { mintAttachment } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { cardVariants, type CardVariants } from './card.variants';
  import type { CardProps } from './index';

  let {
    variant = 'quiet',
    tier = 'contain',
    padding = 'md',
    dividers = false,
    disabled = false,
    mint = 'none',
    children,
    header,
    footer,
    clickable = false,
    interactive = false,
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

  const elementType = $derived.by(() => {
    if (href) return 'a';
    if (clickable || onclick) return 'button';
    return 'div';
  });

  // Hover/focus styles apply when the card has a real click source —
  // `clickable` (force <button>), an `onclick` handler, or `href` (<a>).
  // No decorative-hover mode: cursor-pointer + translate on a passive
  // element would falsely signal interactivity (WCAG 3.2 Predictable).
  const isInteractive = $derived(clickable || interactive || !!onclick || !!href);

  const variantProps: CardVariants = $derived({
    variant,
    tier,
    padding,
    dividers: dividers || undefined,
    interactive: isInteractive,
    elementType,
    disabled: disabled
  });

  const styles = $derived(cardVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Card',
      preset,
      variantProps,
      slotClassesProp,
      cardVariants.config
    )
  );

  const elementProps = $derived.by(() => {
    const props: Record<string, unknown> = { ...restProps };
    if (href) props.href = href;
    if (elementType === 'button') props.type = 'button';
    return props;
  });

  function handleClick(event: MouseEvent) {
    if (disabled) return;
    onclick?.(event);
  }
</script>

<svelte:element
  this={elementType}
  {@attach mintAttachment(mint, { enabled: isInteractive && !disabled })}
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
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
