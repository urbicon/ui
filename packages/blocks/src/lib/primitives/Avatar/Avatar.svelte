<script lang="ts">
  import { mintRegistry } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { avatarVariants, type AvatarVariants } from '$lib/primitives';
  import { useBlocksI18n } from '$lib';
  import type { AvatarProps } from './index';

  const bt = useBlocksI18n();

  let {
    src,
    alt,
    name,
    children,
    size = 'md',
    variant = 'circle',
    intent = 'neutral',
    status,
    statusPosition = 'bottom-right',
    ring = false,
    ringIntent = 'primary',
    ringColor,
    randomColor = false,
    interactive = false,
    clickable = false,
    mint = 'none',
    onclick,
    onHover,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: AvatarProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let avatarElement = $state<HTMLElement>();
  let imageError = $state(false);
  let isHovered = $state(false);

  const isInteractive = $derived(clickable || interactive || !!onclick);

  function getRandomColor(name?: string): string {
    if (!name) return '#4b5563'; // gray-600

    // Tailwind *-700 shades — dark enough that white text hits WCAG AA 4.5:1
    // on every hue. Lighter shades (*-500) used before produced ~3:1 contrast.
    const colors = [
      '#b91c1c', // red-700
      '#c2410c', // orange-700
      '#b45309', // amber-700
      '#a16207', // yellow-700
      '#4d7c0f', // lime-700
      '#15803d', // green-700
      '#047857', // emerald-700
      '#0e7490', // cyan-700
      '#0369a1', // sky-700
      '#1d4ed8', // blue-700
      '#4338ca', // indigo-700
      '#6d28d9', // violet-700
      '#7e22ce', // purple-700
      '#a21caf', // fuchsia-700
      '#be185d' // pink-700
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  function getInitials(name?: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const randomBg = $derived(randomColor ? getRandomColor(name) : undefined);

  const variantProps: AvatarVariants = $derived({
    size,
    variant,
    intent: randomColor ? undefined : intent,
    status,
    statusPosition,
    ring,
    ringIntent: ringColor ? undefined : ringIntent,
    interactive: isInteractive
  });

  const styles = $derived(avatarVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Avatar', preset, variantProps, slotClassesProp)
  );

  const dynamicStyles = $derived.by(() => {
    const styles: Record<string, string> = {};

    if (randomColor && randomBg) {
      // Inline style property names must be kebab-case, not JS camelCase.
      // Previously `styles.backgroundColor` serialised as-is, so browsers
      // ignored it and the avatar fell back to surface-interactive + white
      // text (1.15:1 contrast).
      styles['background-color'] = randomBg;
      styles.color = 'white';
    }

    if (ringColor) {
      styles['border-color'] = ringColor;
    }

    return styles;
  });

  const styleString = $derived(
    Object.entries(dynamicStyles)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ')
  );

  $effect(() => {
    if (avatarElement && mint && mint !== 'none' && isInteractive) {
      return mintRegistry.apply(avatarElement, mint);
    }
  });

  function handleMouseEnter() {
    isHovered = true;
    onHover?.(true);
  }

  function handleMouseLeave() {
    isHovered = false;
    onHover?.(false);
  }

  function handleClick(event: MouseEvent) {
    if (onclick) {
      onclick(event);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onclick?.(event as unknown as MouseEvent);
    }
  }

  function handleImageError() {
    imageError = true;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={avatarElement}
  class={[
    `blocks-intent-${intent}`,
    unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })
  ]}
  style={styleString}
  role={isInteractive ? 'button' : undefined}
  tabindex={isInteractive ? 0 : undefined}
  aria-label={isInteractive ? alt || name || bt('accessibility.avatar') : undefined}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onclick={handleClick}
  onkeydown={handleKeydown}
  {...restProps}
>
  {#if src && !imageError}
    <img
      {src}
      alt={alt || name || bt('accessibility.avatar')}
      class={unstyled ? (slotClasses?.image ?? '') : styles.image({ class: slotClasses?.image })}
      onerror={handleImageError}
    />
  {:else if children}
    {@render children()}
  {:else}
    <span
      class={unstyled
        ? (slotClasses?.fallback ?? '')
        : styles.fallback({ class: slotClasses?.fallback })}
    >
      {getInitials(name)}
    </span>
  {/if}

  {#if status}
    <span
      class={unstyled ? (slotClasses?.status ?? '') : styles.status({ class: slotClasses?.status })}
      role="img"
      aria-label={`Status: ${status}`}
    ></span>
  {/if}
</div>

<style>
  /* `.blocks-mint-*` rules live in `packages/blocks/src/lib/mint/styles.css`
     — see XC-12. Previously Avatar duplicated scale/translate/rotate/glow
     and used `currentColor` for the glow, which made it impossible to
     consume the global intent-aware glow token. */
  :global(.blocks-mint-pulse) {
    animation: avatar-pulse 2s var(--blocks-ease-smooth) infinite;
  }

  @keyframes avatar-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.05);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.blocks-mint-pulse) {
      animation: none;
    }
  }

  @media (prefers-contrast: high) {
    :global([class*='blocks-avatar']) {
      outline: 2px solid currentColor;
      outline-offset: -2px;
    }
  }
</style>
