<script lang="ts">
  import { mintRegistry, Spinner } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getButtonGroupContext } from '../ButtonGroup/buttonGroup.context';
  import { buttonVariants, type ButtonVariants } from '$lib/primitives';
  import { getTierContext } from '$lib/utils/tier-context';
  import type { ButtonProps } from './index';

  let {
    tier,
    intent = 'neutral',
    variant = 'filled',
    size = 'md',
    loading = false,
    loadingPlacement = 'overlay',
    pressed = false,
    active = false,
    disabled = false,
    mint = 'scale',
    children,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    value,
    onclick,
    type = 'button',
    ...restProps
  }: ButtonProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let buttonElement = $state<HTMLButtonElement>();

  const groupCtx = getButtonGroupContext();
  const tierCtx = getTierContext();

  const registration = $derived(groupCtx ? groupCtx.registerButton(value) : null);

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'commit' default. Button is a commit surface unless
  // a wrapping container reframes it as modify (e.g. icon-only toolbar).
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');
  const effectiveVariant = $derived(groupCtx?.variant ?? variant);
  const effectiveSize = $derived(groupCtx?.size ?? size);
  const effectiveIntent = $derived(groupCtx?.intent ?? intent);
  const effectiveDisabled = $derived(groupCtx?.disabled || disabled);
  const effectiveMint = $derived(groupCtx?.mint ?? mint);
  const effectiveActive = $derived(registration?.isSelected ?? active);
  const effectivePressed = $derived(pressed);
  const ariaProps = $derived(registration?.getButtonProps() ?? {});

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the button's active variants.
  const variantProps: ButtonVariants = $derived({
    tier: effectiveTier,
    intent: effectiveIntent,
    variant: effectiveVariant,
    size: effectiveSize,
    loading: loading || undefined,
    loadingPlacement,
    pressed: effectivePressed || undefined,
    active: effectiveActive || undefined,
    buttonGroupConnected: groupCtx?.connected || undefined
  });

  const styles = $derived(buttonVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Button', preset, variantProps, slotClassesProp)
  );

  $effect(() => {
    if (
      buttonElement &&
      effectiveMint &&
      effectiveMint !== 'none' &&
      !effectiveDisabled &&
      !loading
    ) {
      return mintRegistry.apply(buttonElement, effectiveMint);
    }
  });

  function handleClick(event: MouseEvent) {
    if (effectiveDisabled || loading) return;

    registration?.onClick();

    onclick?.(event);
  }

  const spinnerSizeMap = {
    '2xs': 'xs' as const,
    xs: 'xs' as const,
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const,
    xl: 'lg' as const
  };

  export function getElement(): HTMLButtonElement | undefined {
    return buttonElement;
  }
</script>

<!--
  restProps spreads FIRST so component-owned state wins (COMPONENT-API-CONVENTIONS
  §restProps ordering). The ARIA/selection attributes after the spread are
  conditional merges, not plain overrides: an explicit `undefined` after a spread
  REMOVES the attribute in Svelte, so a naive `role={ariaProps.role}` would strip
  a standalone consumer's own `role="link"`. Each merge lets the ButtonGroup
  selection wiring (role/aria-checked/data-value) and the modeled state
  (pressed/disabled/loading) win when the component has something to say, and
  falls back to the consumer's restProps value when it doesn't. Inside a
  selection group aria-pressed is forced off even against restProps — a selection
  role announces via aria-checked, and doubling up is an ARIA violation.
  `type`/`disabled`/`class`/`onclick` are destructured (never in restProps);
  a consumer onclick is composed inside handleClick.
-->
<button
  bind:this={buttonElement}
  {...restProps}
  {type}
  disabled={effectiveDisabled}
  class={[
    'blocks-button',
    `blocks-intent-${effectiveIntent}`,
    unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })
  ]}
  onclick={handleClick}
  role={ariaProps.role ?? restProps.role}
  aria-checked={ariaProps['aria-checked'] ?? restProps['aria-checked']}
  data-value={ariaProps['data-value'] ?? restProps['data-value']}
  aria-pressed={ariaProps.role
    ? undefined
    : effectiveActive || effectivePressed || restProps['aria-pressed']}
  aria-disabled={effectiveDisabled || (restProps['aria-disabled'] ?? false)}
  aria-busy={loading || (restProps['aria-busy'] ?? false)}
>
  <span
    class={unstyled
      ? loading
        ? (slotClasses?.spinner ?? '')
        : 'hidden'
      : styles.spinner({ class: slotClasses?.spinner })}
    aria-hidden="true"
  >
    <Spinner size={spinnerSizeMap[effectiveSize]} intent="current" visible={true} />
  </span>

  <span
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
  >
    {@render children?.()}
  </span>
</button>

<style>
  /* All `.blocks-mint-*` rules live in `packages/blocks/src/lib/mint/styles.css`
     — see XC-12. Previously each primitive carried its own copy, which
     duplicated logic and (in the case of `--intent-bg`) referenced an
     undefined CSS variable that silently invalidated the declaration. The
     `blocks-intent-{name}` class on the button root scopes the glow color
     via `mint/styles.css`. */

  /* The ripple mint owns the ripple end-to-end: `mint/ripple.ts` appends a
     `<span class="blocks-mint-ripple">` on click and drives it with the Web
     Animations API, tinted `currentColor` so it resolves per variant/intent —
     white on a filled button, the intent hue on outlined/ghost. Button used to
     carry a competing `.blocks-ripple` rule here (a hardcoded
     `rgba(255,255,255,0.4)` plus its own @keyframes) that no element ever
     matched — nothing has emitted that class since the initial commit, and it
     would have been invisible on light variants had it matched. Removed rather
     than tokenised; see the same note in `mint/styles.css` (XC-12/PAG-1). */

  :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* No reduced-motion rule for the ripple here either: `mint/ripple.ts` bails at
     click time on `prefers-reduced-motion`, and `mint/styles.css` hides
     `.blocks-mint-ripple` outright — both on the class that actually exists. */
</style>
