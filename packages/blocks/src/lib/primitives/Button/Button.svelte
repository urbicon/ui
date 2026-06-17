<script lang="ts">
  import { mintRegistry, Spinner } from '$lib';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { getButtonGroupContext } from '../ButtonGroup/buttonGroup.context';
  import { buttonVariants } from '$lib/primitives';
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
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Button?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Button', preset),
      slotClassesProp
    )
  );

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

  const styles = $derived(
    buttonVariants({
      tier: effectiveTier,
      intent: effectiveIntent,
      variant: effectiveVariant,
      size: effectiveSize,
      loading: loading || undefined,
      loadingPlacement,
      pressed: effectivePressed || undefined,
      active: effectiveActive || undefined,
      buttonGroupConnected: groupCtx?.connected || undefined
    })
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

<button
  bind:this={buttonElement}
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
  role={ariaProps.role}
  aria-checked={ariaProps['aria-checked']}
  aria-pressed={ariaProps.role ? undefined : effectiveActive || effectivePressed || undefined}
  aria-disabled={effectiveDisabled}
  aria-busy={loading}
  {...restProps}
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

  :global(.blocks-button .blocks-ripple) {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    pointer-events: none;
    animation: ripple var(--blocks-duration-slow) var(--blocks-ease-confident);
    z-index: 1;
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }

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

  @media (prefers-reduced-motion: reduce) {
    :global(.blocks-button .blocks-ripple) {
      animation: none !important;
      opacity: 0 !important;
    }
  }
</style>
