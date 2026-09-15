<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { linkVariants, type LinkVariants } from './link.variants';
  import type { LinkProps } from './index';

  let {
    href,
    variant = 'inline',
    active = false,
    disabled = false,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    onclick,
    ...restProps
  }: LinkProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: LinkVariants = $derived({ variant, active, disabled });

  const styles = $derived(unstyled ? null : linkVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Link',
      preset,
      variantProps,
      slotClassesProp,
      linkVariants.config
    )
  );

  const baseClass = $derived(
    styles
      ? styles.base({ class: [slotClasses?.base, className] })
      : resolveClassChain(slotClasses?.base, className)
  );

  // `pointer-events-none` suppresses hit testing and nothing else: an
  // assistive-technology activation calls `element.click()` on the anchor, and
  // Enter on a focused link synthesizes the same event — both reach the handler
  // whatever CSS says. So a disabled link cancels the navigation here and never
  // calls the consumer's handler; without this it still followed its `href`.
  //
  // The parameter type is read off the prop rather than spelled as `MouseEvent`:
  // Svelte narrows an element handler's event with `currentTarget`, and a
  // hand-written `MouseEvent` does not satisfy it.
  function handleClick(event: Parameters<NonNullable<LinkProps['onclick']>>[0]) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onclick?.(event);
  }
</script>

<!--
  restProps spreads FIRST so the modelled state wins; the ARIA attributes after
  it fall back to the caller's value rather than removing it — an explicit
  `undefined` written after a spread strips the attribute. That fallback is what
  keeps `aria-current="step"` reachable for a wizard trail while `active`
  remains the shorthand for the page case.
-->
<a
  {...restProps}
  {href}
  class={baseClass}
  tabindex={disabled ? -1 : restProps.tabindex}
  aria-disabled={disabled ? true : restProps['aria-disabled']}
  aria-current={active ? 'page' : restProps['aria-current']}
  onclick={handleClick}>{@render children()}</a
>
